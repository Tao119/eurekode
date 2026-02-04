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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        return NextResponse.json({ error: "Invalid organization plan" }, { status: 400 });
      }
      if (orgPlan === "free" || orgPlan === "enterprise") {
        return NextResponse.json(
          { error: "This plan cannot be purchased through checkout" },
          { status: 400 }
        );
      }
      priceId = STRIPE_PRICE_IDS.organization[orgPlan]?.[billingPeriod];
    } else {
      const indPlan = plan as IndividualPlan;
      if (!INDIVIDUAL_PLANS[indPlan]) {
        return NextResponse.json({ error: "Invalid individual plan" }, { status: 400 });
      }
      if (indPlan === "free") {
        return NextResponse.json(
          { error: "Free plan does not require checkout" },
          { status: 400 }
        );
      }
      priceId = STRIPE_PRICE_IDS.individual[indPlan]?.[billingPeriod];
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "Price not configured for this plan" },
        { status: 400 }
      );
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
