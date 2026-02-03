import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Schema for self password change
const selfPasswordChangeSchema = z.object({
  currentPassword: z.string().min(8, "現在のパスワードを入力してください"),
  newPassword: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .regex(/[a-zA-Z]/, "パスワードには英字を含めてください")
    .regex(/[0-9]/, "パスワードには数字を含めてください"),
});

// Schema for admin password reset
const adminPasswordResetSchema = z.object({
  targetUserId: z.string().uuid("無効なユーザーIDです"),
  newPassword: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .regex(/[a-zA-Z]/, "パスワードには英字を含めてください")
    .regex(/[0-9]/, "パスワードには数字を含めてください"),
});

// PUT /api/user/password - Change password
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Check if this is an admin resetting another user's password
    if (body.targetUserId && body.targetUserId !== session.user.id) {
      // Admin password reset
      if (session.user.userType !== "admin") {
        return NextResponse.json(
          { success: false, error: { code: "FORBIDDEN", message: "管理者権限が必要です" } },
          { status: 403 }
        );
      }

      const parsed = adminPasswordResetSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "入力内容を確認してください" } },
          { status: 400 }
        );
      }

      const { targetUserId, newPassword } = parsed.data;

      // Verify target user exists and belongs to the same organization
      const targetUser = await prisma.user.findFirst({
        where: {
          id: targetUserId,
          organizationId: session.user.organizationId,
        },
      });

      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
          { status: 404 }
        );
      }

      // Hash and update password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: targetUserId },
        data: { passwordHash },
      });

      return NextResponse.json({
        success: true,
        data: { message: "パスワードをリセットしました" },
      });
    }

    // Self password change
    const parsed = selfPasswordChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "入力内容を確認してください" } },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_PASSWORD", message: "現在のパスワードが正しくありません" } },
        { status: 400 }
      );
    }

    // Hash and update new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      data: { message: "パスワードを変更しました" },
    });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
