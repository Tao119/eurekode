import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createCheckoutSession,
  createCustomer,
  changeSubscriptionPlan,
  scheduleSubscriptionPlanChange,
  previewSubscriptionChange,
  STRIPE_PRICE_IDS,
} from "@/lib/stripe";
import {
  IndividualPlan,
  OrganizationPlan,
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
} from "@/config/plans";

/**
 * プランの価格順位を取得（比較用）
 */
function getPlanPriority(plan: string, isOrganization: boolean): number {
  if (isOrganization) {
    const priorities: Record<string, number> = { free: 0, starter: 1, business: 2, enterprise: 3 };
    return priorities[plan] ?? 0;
  }
  const priorities: Record<string, number> = { free: 0, starter: 1, pro: 2, max: 3 };
  return priorities[plan] ?? 0;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", errorJa: "ログインが必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      plan,
      billingPeriod = "monthly",
      isOrganization = false,
      preview = false, // trueの場合、プレビューのみ返す
      scheduleForNextPeriod = false, // trueの場合、次回更新時に適用
    } = body as {
      plan: string;
      billingPeriod: "monthly" | "yearly";
      isOrganization: boolean;
      preview?: boolean;
      scheduleForNextPeriod?: boolean;
    };

    // プランの検証
    let priceId: string | undefined;

    if (isOrganization) {
      const orgPlan = plan as OrganizationPlan;
      if (!ORGANIZATION_PLANS[orgPlan]) {
        return NextResponse.json(
          { error: "Invalid organization plan", errorJa: "無効な組織プランです" },
          { status: 400 }
        );
      }
      if (orgPlan === "free" || orgPlan === "enterprise") {
        return NextResponse.json(
          {
            error: "This plan cannot be purchased through checkout",
            errorJa: "このプランはチェックアウトでは購入できません",
          },
          { status: 400 }
        );
      }
      priceId = STRIPE_PRICE_IDS.organization[orgPlan]?.[billingPeriod];
    } else {
      const indPlan = plan as IndividualPlan;
      if (!INDIVIDUAL_PLANS[indPlan]) {
        return NextResponse.json(
          { error: "Invalid individual plan", errorJa: "無効なプランです" },
          { status: 400 }
        );
      }
      if (indPlan === "free") {
        return NextResponse.json(
          {
            error: "Free plan does not require checkout",
            errorJa: "フリープランでは購入は不要です",
          },
          { status: 400 }
        );
      }
      priceId = STRIPE_PRICE_IDS.individual[indPlan]?.[billingPeriod];
    }

    if (!priceId) {
      console.error(`Stripe Price ID not configured for plan: ${plan}, period: ${billingPeriod}, isOrg: ${isOrganization}`);
      return NextResponse.json(
        {
          error: "Price not configured for this plan",
          errorJa: "このプランの価格が設定されていません。管理者にお問い合わせください。",
        },
        { status: 400 }
      );
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found", errorJa: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // 既存のStripeサブスクリプションがあるかチェック
    const hasActiveSubscription =
      user.subscription?.stripeSubscriptionId &&
      user.subscription?.status === "active";

    // 既存サブスクリプションがある場合はプラン変更
    if (hasActiveSubscription && user.subscription?.stripeSubscriptionId) {
      const subscriptionId = user.subscription.stripeSubscriptionId;
      const currentPlan = user.subscription.individualPlan || user.subscription.organizationPlan || "free";
      const currentPriority = getPlanPriority(currentPlan, isOrganization);
      const newPriority = getPlanPriority(plan, isOrganization);
      const isUpgrade = newPriority > currentPriority;
      const isDowngrade = newPriority < currentPriority;

      // プレビューモードの場合は見積もりを返す
      if (preview) {
        try {
          const previewData = await previewSubscriptionChange(subscriptionId, priceId);
          return NextResponse.json({
            type: "preview",
            isUpgrade,
            isDowngrade,
            ...previewData,
            message: isUpgrade
              ? `アップグレードすると、今すぐ¥${previewData.immediateAmount.toLocaleString()}が請求されます（差額の按分）。`
              : isDowngrade
              ? `ダウングレードすると、¥${previewData.proratedCredit.toLocaleString()}分のクレジットが次回請求に適用されます。`
              : "同じプランに変更しても料金は変わりません。",
          });
        } catch (error) {
          console.error("Preview error:", error);
          return NextResponse.json(
            { error: "Failed to preview", errorJa: "見積もりの取得に失敗しました" },
            { status: 500 }
          );
        }
      }

      // ダウングレードで次回更新時に適用する場合
      if (isDowngrade && scheduleForNextPeriod) {
        try {
          await scheduleSubscriptionPlanChange(subscriptionId, priceId);

          // DBの更新は行わない（Webhookで処理される）
          return NextResponse.json({
            success: true,
            type: "scheduled",
            message: "プランの変更が次回更新時に適用されるよう予約されました。",
          });
        } catch (error) {
          console.error("Schedule error:", error);
          return NextResponse.json(
            { error: "Failed to schedule", errorJa: "プラン変更の予約に失敗しました" },
            { status: 500 }
          );
        }
      }

      // 即時プラン変更（アップグレードまたは即時ダウングレード）
      try {
        await changeSubscriptionPlan(subscriptionId, priceId);

        // DBを更新
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: isOrganization
            ? { organizationPlan: plan as OrganizationPlan, individualPlan: null }
            : { individualPlan: plan as IndividualPlan, organizationPlan: null },
        });

        return NextResponse.json({
          success: true,
          type: isUpgrade ? "upgraded" : "downgraded",
          message: isUpgrade
            ? "プランがアップグレードされました。差額が請求されます。"
            : "プランがダウングレードされました。残り期間分のクレジットが適用されます。",
        });
      } catch (error) {
        console.error("Plan change error:", error);
        return NextResponse.json(
          { error: "Failed to change plan", errorJa: "プランの変更に失敗しました" },
          { status: 500 }
        );
      }
    }

    // 新規サブスクリプションの場合はCheckoutセッションを作成
    let stripeCustomerId = user.subscription?.stripeCustomerId;

    if (!stripeCustomerId && user.email) {
      const customer = await createCustomer({
        email: user.email,
        name: user.displayName,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
    }

    const requestUrl = new URL(request.url);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;
    const checkoutSession = await createCheckoutSession({
      priceId,
      customerId: stripeCustomerId || undefined,
      customerEmail: !stripeCustomerId ? user.email || undefined : undefined,
      successUrl: `${appUrl}/settings/billing?success=true`,
      cancelUrl: `${appUrl}/settings/billing?canceled=true`,
      metadata: {
        userId: user.id,
        plan,
        isOrganization: String(isOrganization),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        errorJa: `決済セッションの作成に失敗しました: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
