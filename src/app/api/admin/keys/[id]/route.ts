import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/keys/:id - Get key details
export async function GET(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    const key = await prisma.accessKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!key) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "キーが見つかりません" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: key.id,
        keyCode: key.keyCode,
        status: key.status,
        dailyTokenLimit: key.dailyTokenLimit,
        settings: key.settings,
        expiresAt: key.expiresAt?.toISOString() || null,
        usedAt: key.usedAt?.toISOString() || null,
        createdAt: key.createdAt.toISOString(),
        user: key.user
          ? {
              id: key.user.id,
              displayName: key.user.displayName,
              email: key.user.email,
              joinedAt: key.user.createdAt.toISOString(),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get admin key detail error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/keys/:id - Update key
const updateKeySchema = z.object({
  dailyTokenLimit: z.number().int().min(100).max(100000).optional(),
  // Accept null, undefined, or any string that can be parsed as a date
  expiresAt: z.union([z.string(), z.null()]).optional(),
  settings: z.object({
    allowedModes: z.array(z.enum(["explanation", "generation", "brainstorm"])).optional(),
    allowedTechStacks: z.array(z.string()).optional(),
    unlockSkipAllowed: z.boolean().optional(),
  }).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request format", details: parsed.error.issues } },
        { status: 400 }
      );
    }

    // Check key exists and belongs to organization
    const existingKey = await prisma.accessKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingKey) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "キーが見つかりません" } },
        { status: 404 }
      );
    }

    const { dailyTokenLimit, expiresAt, settings } = parsed.data;

    // Validate expiresAt if provided
    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      const date = new Date(expiresAt);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date format for expiresAt" } },
          { status: 400 }
        );
      }
      parsedExpiresAt = date;
    }

    // Merge settings
    const updatedSettings = settings
      ? { ...(existingKey.settings as object || {}), ...settings }
      : existingKey.settings;

    const key = await prisma.accessKey.update({
      where: { id },
      data: {
        ...(dailyTokenLimit !== undefined && { dailyTokenLimit }),
        ...(expiresAt !== undefined && { expiresAt: parsedExpiresAt }),
        ...(settings && { settings: updatedSettings as Prisma.InputJsonValue }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: key.id,
        keyCode: key.keyCode,
        dailyTokenLimit: key.dailyTokenLimit,
        expiresAt: key.expiresAt?.toISOString() || null,
        settings: key.settings,
      },
    });
  } catch (error) {
    console.error("Update admin key error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// POST /api/admin/keys/:id/reissue - Re-issue key (reset for new registration)
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

    const { id } = await context.params;

    // Check key exists and belongs to organization
    const existingKey = await prisma.accessKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!existingKey) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "キーが見つかりません" } },
        { status: 404 }
      );
    }

    // Only allow re-issue for used or revoked keys
    if (existingKey.status !== "used" && existingKey.status !== "revoked") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATE", message: "このキーは再発行できません（使用済みまたは無効化済みのキーのみ再発行可能）" } },
        { status: 400 }
      );
    }

    // Use transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // If key has an associated user, clear their email and password
      // This forces re-registration with new credentials
      if (existingKey.userId) {
        await tx.user.update({
          where: { id: existingKey.userId },
          data: {
            email: null,
            passwordHash: null,
          },
        });
      }

      // Reset the key to active state
      await tx.accessKey.update({
        where: { id },
        data: {
          status: "active",
          usedAt: null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: { message: "キーを再発行しました。新しいメールアドレスとパスワードで登録できます。" },
    });
  } catch (error) {
    console.error("Re-issue admin key error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/keys/:id - Revoke key
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    // Check key exists and belongs to organization
    const existingKey = await prisma.accessKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingKey) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "キーが見つかりません" } },
        { status: 404 }
      );
    }

    // Revoke key (not delete, for audit trail)
    await prisma.accessKey.update({
      where: { id },
      data: { status: "revoked" },
    });

    return NextResponse.json({
      success: true,
      data: { message: "キーを無効化しました" },
    });
  } catch (error) {
    console.error("Revoke admin key error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
