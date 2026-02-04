import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, createCustomer, STRIPE_PRICE_IDS } from "@/lib/stripe";
import {
  IndividualPlan,
  OrganizationPlan,
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
} from "@/config/plans";

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
    const { plan, billingPeriod = "monthly", isOrganization = false } = body as {
      plan: string;
      billingPeriod: "monthly" | "yearly";
      isOrganization: boolean;
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

    // Stripe顧客IDを取得または作成
    let stripeCustomerId = user.subscription?.stripeCustomerId;

    if (!stripeCustomerId && user.email) {
      const customer = await createCustomer({
        email: user.email,
        name: user.displayName,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
    }

    // Checkoutセッションを作成
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
