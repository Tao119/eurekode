import { NextRequest, NextResponse } from "next/server";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for account deletion confirmation
const deleteAccountSchema = z.object({
  confirmText: z.string(),
});

// DELETE /api/user/account - Delete account
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    // Members cannot delete their accounts
    if (session.user.userType === "member") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "メンバーはアカウントを削除できません。管理者にお問い合わせください。" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = deleteAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "確認テキストを入力してください" } },
        { status: 400 }
      );
    }

    const { confirmText } = parsed.data;

    // Verify confirmation text
    const expectedText = "アカウントを削除する";
    if (confirmText !== expectedText) {
      return NextResponse.json(
        { success: false, error: { code: "CONFIRMATION_FAILED", message: "確認テキストが一致しません" } },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Delete all user data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete artifacts first (depends on conversations)
      await tx.artifact.deleteMany({
        where: { userId },
      });

      // Delete conversations (messages are stored as JSON in conversation)
      await tx.conversation.deleteMany({
        where: { userId },
      });

      // Delete learnings
      await tx.learning.deleteMany({
        where: { userId },
      });

      // Delete token usage records
      await tx.tokenUsage.deleteMany({
        where: { userId },
      });

      // Delete subscription if exists
      await tx.subscription.deleteMany({
        where: { userId },
      });

      // Delete access key association if exists
      await tx.accessKey.updateMany({
        where: { userId },
        data: { userId: null, status: "revoked" },
      });

      // Finally delete the user (settings are stored as JSON in user)
      await tx.user.delete({
        where: { id: userId },
      });
    });

    // Sign out the user
    await signOut({ redirect: false });

    return NextResponse.json({
      success: true,
      data: { message: "アカウントを削除しました" },
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
