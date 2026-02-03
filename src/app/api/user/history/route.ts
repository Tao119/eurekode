import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for history deletion confirmation
const deleteHistorySchema = z.object({
  confirmText: z.string(),
});

// DELETE /api/user/history - Delete all conversation history
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = deleteHistorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "確認テキストを入力してください" } },
        { status: 400 }
      );
    }

    const { confirmText } = parsed.data;

    // Verify confirmation text
    const expectedText = "履歴を削除する";
    if (confirmText !== expectedText) {
      return NextResponse.json(
        { success: false, error: { code: "CONFIRMATION_FAILED", message: "確認テキストが一致しません" } },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Delete all conversation data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete artifacts first (depends on conversations)
      await tx.artifact.deleteMany({
        where: { userId },
      });

      // Delete conversations (messages are stored as JSON in conversation)
      await tx.conversation.deleteMany({
        where: { userId },
      });

      // Also delete learnings (as they are part of history)
      await tx.learning.deleteMany({
        where: { userId },
      });
    });

    return NextResponse.json({
      success: true,
      data: { message: "すべての会話履歴を削除しました" },
    });
  } catch (error) {
    console.error("History deletion error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
