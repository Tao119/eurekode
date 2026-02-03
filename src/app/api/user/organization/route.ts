import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Access key format validation
const accessKeySchema = z.object({
  keyCode: z.string().regex(/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/),
});

// GET /api/user/organization - Get current organization info
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        userType: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
        accessKey: {
          select: {
            id: true,
            keyCode: true,
            dailyTokenLimit: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        userType: user.userType,
        organization: user.organization,
        accessKey: user.accessKey ? {
          keyCode: maskAccessKey(user.accessKey.keyCode),
          dailyTokenLimit: user.accessKey.dailyTokenLimit,
          expiresAt: user.accessKey.expiresAt,
        } : null,
      },
    });
  } catch (error) {
    console.error("Get organization info error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// POST /api/user/organization - Join an organization with access key
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = accessKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "アクセスキーの形式が正しくありません" } },
        { status: 400 }
      );
    }

    const { keyCode } = parsed.data;

    // Check current user status
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true, organizationId: true, email: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    // Only individual users can join organizations
    if (currentUser.userType !== "individual") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATE", message: "既に組織に所属しています" } },
        { status: 400 }
      );
    }

    // Find and validate access key
    const accessKey = await prisma.accessKey.findUnique({
      where: { keyCode },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!accessKey) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_KEY", message: "無効なアクセスキーです" } },
        { status: 400 }
      );
    }

    // Check key status
    if (accessKey.status === "revoked") {
      return NextResponse.json(
        { success: false, error: { code: "KEY_REVOKED", message: "このアクセスキーは無効化されています" } },
        { status: 400 }
      );
    }

    if (accessKey.status === "used" && accessKey.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "KEY_ALREADY_USED", message: "このアクセスキーは既に使用されています" } },
        { status: 400 }
      );
    }

    // Check expiration
    if (accessKey.expiresAt && accessKey.expiresAt < new Date()) {
      await prisma.accessKey.update({
        where: { id: accessKey.id },
        data: { status: "expired" },
      });
      return NextResponse.json(
        { success: false, error: { code: "KEY_EXPIRED", message: "このアクセスキーは有効期限が切れています" } },
        { status: 400 }
      );
    }

    // Join organization - update user and access key in a transaction
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          userType: "member",
          organizationId: accessKey.organizationId,
        },
        include: {
          organization: {
            select: { id: true, name: true, plan: true },
          },
        },
      }),
      prisma.accessKey.update({
        where: { id: accessKey.id },
        data: {
          userId: session.user.id,
          usedAt: new Date(),
          status: "used",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        userType: updatedUser.userType,
        organization: updatedUser.organization,
        message: `${updatedUser.organization?.name || "組織"}に参加しました`,
      },
    });
  } catch (error) {
    console.error("Join organization error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// DELETE /api/user/organization - Leave the organization
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    // Check current user status
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        userType: true,
        organizationId: true,
        email: true,
        accessKey: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    // Only members can leave organizations
    if (currentUser.userType !== "member") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATE", message: "組織に所属していません" } },
        { status: 400 }
      );
    }

    // Members without email cannot leave (they have nowhere to go)
    if (!currentUser.email) {
      return NextResponse.json(
        { success: false, error: { code: "NO_EMAIL", message: "個人利用に切り替えるには、先にメールアドレスを登録してください" } },
        { status: 400 }
      );
    }

    // Leave organization - update user and revoke access key in a transaction
    await prisma.$transaction(async (tx) => {
      // Update user to individual
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          userType: "individual",
          organizationId: null,
        },
      });

      // Revoke the access key if exists
      if (currentUser.accessKey) {
        await tx.accessKey.update({
          where: { id: currentUser.accessKey.id },
          data: {
            userId: null,
            status: "revoked",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        userType: "individual",
        organization: null,
        message: "組織から退出しました",
      },
    });
  } catch (error) {
    console.error("Leave organization error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// Helper function to mask access key for display
function maskAccessKey(keyCode: string): string {
  const parts = keyCode.split("-");
  return parts.map((part, index) =>
    index === 0 ? part : "•••••"
  ).join("-");
}
