import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Generate access key in format: XXXXX-XXXXX-XXXXX-XXXXX
function generateKeyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars (0, O, 1, I)
  const segments: string[] = [];

  for (let s = 0; s < 4; s++) {
    let segment = "";
    for (let i = 0; i < 5; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      segment += chars[randomIndex];
    }
    segments.push(segment);
  }

  return segments.join("-");
}

// POST /api/admin/members/:id/regenerate-key - Regenerate a new access key for member
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    if (session.user.userType !== "admin") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "管理者権限が必要です" } },
        { status: 403 }
      );
    }

    if (!session.user.organizationId) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "組織が見つかりません" } },
        { status: 404 }
      );
    }

    const { id: memberId } = await context.params;

    // Verify member belongs to organization
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: session.user.organizationId,
        userType: "member",
      },
      include: {
        accessKey: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
        { status: 404 }
      );
    }

    // Generate new key code
    const newKeyCode = generateKeyCode();

    // Use transaction to ensure consistency
    const newKey = await prisma.$transaction(async (tx) => {
      // Revoke old key if exists
      if (member.accessKey) {
        await tx.accessKey.update({
          where: { id: member.accessKey.id },
          data: {
            status: "revoked",
            userId: null,
          },
        });
      }

      // Create new access key
      const createdKey = await tx.accessKey.create({
        data: {
          organizationId: session.user.organizationId!,
          userId: memberId,
          keyCode: newKeyCode,
          dailyTokenLimit: member.accessKey?.dailyTokenLimit || 1000,
          status: "used",
          usedAt: new Date(),
          settings: member.accessKey?.settings || {},
        },
      });

      return createdKey;
    });

    return NextResponse.json({
      success: true,
      data: {
        keyCode: newKey.keyCode,
        message: "新しいアクセスキーを発行しました。このキーは一度だけ表示されます。",
      },
    });
  } catch (error) {
    console.error("Regenerate member key error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
