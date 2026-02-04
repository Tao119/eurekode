import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/stripe";

const confirmSchema = z.object({
  confirmText: z.literal("組織を解散する"),
});

/**
 * POST /api/user/organization/convert-to-individual
 * 組織管理者を個人アカウントに変換
 * - すべてのメンバーを削除
 * - すべてのアクセスキーを削除
 * - 組織を削除
 * - サブスクリプションをキャンセル
 */
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
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "確認テキストが正しくありません" } },
        { status: 400 }
      );
    }

    // 現在のユーザー情報を取得
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        organization: {
          include: {
            users: true,
            accessKeys: true,
            subscription: true,
          },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    // 管理者のみ実行可能
    if (currentUser.userType !== "admin") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "この操作は組織管理者のみ実行できます" } },
        { status: 403 }
      );
    }

    if (!currentUser.organization) {
      return NextResponse.json(
        { success: false, error: { code: "NO_ORGANIZATION", message: "組織が見つかりません" } },
        { status: 400 }
      );
    }

    const organization = currentUser.organization;

    // トランザクションで全ての削除を実行
    await prisma.$transaction(async (tx) => {
      // 1. 組織の他のメンバー（管理者以外）の関連データを削除
      const memberIds = organization.users
        .filter(u => u.id !== session.user!.id)
        .map(u => u.id);

      if (memberIds.length > 0) {
        // メンバーの会話履歴を削除
        await tx.conversation.deleteMany({
          where: { userId: { in: memberIds } },
        });

        // メンバーの学びを削除
        await tx.learning.deleteMany({
          where: { userId: { in: memberIds } },
        });

        // メンバーのプロジェクトを削除
        await tx.project.deleteMany({
          where: { userId: { in: memberIds } },
        });

        // メンバーのアーティファクトを削除
        await tx.artifact.deleteMany({
          where: { userId: { in: memberIds } },
        });

        // メンバーのトークン使用履歴を削除
        await tx.tokenUsage.deleteMany({
          where: { userId: { in: memberIds } },
        });

        // メンバーのクレジット残高を削除
        await tx.creditBalance.deleteMany({
          where: { userId: { in: memberIds } },
        });

        // メンバーを削除（cascade deleteで他の関連データも削除される）
        await tx.user.deleteMany({
          where: { id: { in: memberIds } },
        });
      }

      // 2. すべてのアクセスキーを削除
      await tx.accessKey.deleteMany({
        where: { organizationId: organization.id },
      });

      // 3. 組織のサブスクリプションを削除
      if (organization.subscription) {
        await tx.subscription.delete({
          where: { id: organization.subscription.id },
        });
      }

      // 4. 管理者を個人に変換
      await tx.user.update({
        where: { id: session.user!.id },
        data: {
          userType: "individual",
          organizationId: null,
        },
      });

      // 5. 個人サブスクリプションを作成（フリープラン）
      const now = new Date();
      const oneMonthLater = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      await tx.subscription.create({
        data: {
          userId: session.user!.id,
          individualPlan: "free",
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: oneMonthLater,
        },
      });

      // 6. 組織を削除
      await tx.organization.delete({
        where: { id: organization.id },
      });
    });

    // Stripeサブスクリプションをキャンセル（トランザクション外で実行）
    if (organization.subscription?.stripeSubscriptionId) {
      try {
        await cancelSubscriptionAtPeriodEnd(organization.subscription.stripeSubscriptionId);
      } catch (stripeError) {
        console.error("Failed to cancel Stripe subscription:", stripeError);
        // Stripeのキャンセルに失敗しても、DB側の変更は維持
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        userType: "individual",
        message: "組織を解散し、個人アカウントに変換しました",
      },
    });
  } catch (error) {
    console.error("Convert to individual error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "変換中にエラーが発生しました" } },
      { status: 500 }
    );
  }
}
