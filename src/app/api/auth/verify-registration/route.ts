import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types/api";

/**
 * 自動ログイン用のトークンを生成して保存
 */
async function createLoginToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10分間有効

  // 既存のログイントークンを削除
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: `login:${email}`,
    },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: `login:${email}`,
      token,
      expires,
    },
  });

  return token;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_SESSION_ID",
            message: "セッションIDが必要です",
          },
        },
        { status: 400 }
      );
    }

    // Stripeからセッション情報を取得
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_NOT_FOUND",
            message: "セッションが見つかりません",
          },
        },
        { status: 404 }
      );
    }

    // セッションが完了しているか確認
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PAYMENT_NOT_COMPLETED",
            message: "決済が完了していません",
          },
        },
        { status: 400 }
      );
    }

    const metadata = session.metadata || {};
    const { email, type } = metadata;

    // 登録タイプでない場合はエラー
    if (type !== "registration") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SESSION_TYPE",
            message: "無効なセッションタイプです",
          },
        },
        { status: 400 }
      );
    }

    // ユーザーが作成されているか確認（Webhookが先に処理している場合）
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        displayName: true,
        subscription: {
          select: {
            individualPlan: true,
            organizationPlan: true,
            status: true,
          },
        },
      },
    });

    if (user && user.email) {
      // ログイントークンを生成
      const loginToken = await createLoginToken(user.email);

      return NextResponse.json({
        success: true,
        data: {
          email: user.email,
          displayName: user.displayName,
          status: "completed",
          plan: user.subscription?.individualPlan || user.subscription?.organizationPlan,
          loginToken, // 自動ログイン用トークン
        },
      });
    }

    // ユーザーがまだ作成されていない場合（Webhookが遅延している可能性）
    // 決済は完了しているため、成功として返す
    return NextResponse.json({
      success: true,
      data: {
        email,
        status: "pending",
        message: "アカウントを作成中です。数分後にログインをお試しください。",
      },
    });
  } catch (error) {
    console.error("Verify registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "確認中にエラーが発生しました",
        },
      },
      { status: 500 }
    );
  }
}
