import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent, getSubscription } from "@/lib/stripe";
import { IndividualPlan, OrganizationPlan } from "@/config/plans";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const { userId, type } = metadata;

  if (!userId) {
    console.error("Missing userId in checkout session metadata");
    return;
  }

  // クレジット購入の場合
  if (type === "credit_purchase") {
    await handleCreditPurchaseCompleted(session);
    return;
  }

  // サブスクリプション購入の場合
  const { plan, isOrganization } = metadata;

  if (!plan) {
    console.error("Missing plan in checkout session metadata");
    return;
  }

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // Stripeからサブスクリプション詳細を取得
  const stripeSubscription = await getSubscription(subscriptionId);
  if (!stripeSubscription) {
    console.error("Could not retrieve subscription from Stripe");
    return;
  }

  const priceId = stripeSubscription.items.data[0]?.price.id;
  // Access period timestamps from subscription (cast needed for Stripe SDK v20+)
  const subAny = stripeSubscription as unknown as { current_period_start: number; current_period_end: number };
  const currentPeriodStart = new Date(subAny.current_period_start * 1000);
  const currentPeriodEnd = new Date(subAny.current_period_end * 1000);

  // サブスクリプションをDBに保存/更新
  const subscriptionData = {
    status: "active" as const,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    currentPeriodStart,
    currentPeriodEnd,
    ...(isOrganization === "true"
      ? { organizationPlan: plan as OrganizationPlan, individualPlan: null }
      : { individualPlan: plan as IndividualPlan, organizationPlan: null }),
  };

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      ...subscriptionData,
    },
    update: subscriptionData,
  });

  // 新規サブスクリプション時にクレジット残高を初期化
  await initializeCreditBalance(userId, currentPeriodStart, currentPeriodEnd);

  console.log(`Subscription created/updated for user ${userId}: ${plan}`);
}

/**
 * クレジット購入完了処理
 */
async function handleCreditPurchaseCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const { userId, packId, points, unitPrice } = metadata;

  if (!userId || !points) {
    console.error("Missing credit purchase metadata");
    return;
  }

  const pointsNum = parseFloat(points);
  const unitPriceNum = parseFloat(unitPrice || "3.0");
  const amountPaid = session.amount_total || 0;

  // クレジット購入履歴を作成
  await prisma.creditPurchase.create({
    data: {
      userId,
      packId: packId !== "custom" ? packId : null,
      pointsPurchased: pointsNum,
      amountPaid,
      unitPrice: unitPriceNum,
      stripePaymentId: session.payment_intent as string,
      stripeSessionId: session.id,
      status: "completed",
      completedAt: new Date(),
    },
  });

  // クレジット残高を更新
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  await prisma.creditBalance.upsert({
    where: { userId },
    create: {
      userId,
      balance: pointsNum,
      monthlyUsed: 0,
      purchasedUsed: 0,
      periodStart: monthStart,
      periodEnd: monthEnd,
    },
    update: {
      balance: { increment: pointsNum },
    },
  });

  console.log(`Credit purchase completed for user ${userId}: ${pointsNum} points`);
}

/**
 * クレジット残高を初期化
 */
async function initializeCreditBalance(
  userId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const existing = await prisma.creditBalance.findUnique({
    where: { userId },
  });

  if (!existing) {
    await prisma.creditBalance.create({
      data: {
        userId,
        balance: 0,
        monthlyUsed: 0,
        purchasedUsed: 0,
        periodStart,
        periodEnd,
      },
    });
  } else if (existing.periodEnd < new Date()) {
    // 期間が過ぎている場合はリセット
    await prisma.creditBalance.update({
      where: { userId },
      data: {
        monthlyUsed: 0,
        purchasedUsed: 0,
        periodStart,
        periodEnd,
      },
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSubscription) {
    console.log(`No subscription found for Stripe ID: ${subscription.id}`);
    return;
  }

  const status = mapStripeStatus(subscription.status);
  // Cast for Stripe SDK v20+ type compatibility
  const subAny = subscription as unknown as { current_period_start: number; current_period_end: number };
  const currentPeriodStart = new Date(subAny.current_period_start * 1000);
  const currentPeriodEnd = new Date(subAny.current_period_end * 1000);

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status,
      currentPeriodStart,
      currentPeriodEnd,
    },
  });

  console.log(`Subscription updated: ${subscription.id} -> ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSubscription) {
    console.log(`No subscription found for Stripe ID: ${subscription.id}`);
    return;
  }

  // サブスクリプションをキャンセル状態に更新（削除はしない）
  // ユーザーはfreeプランに戻る
  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: "canceled",
      individualPlan: existingSubscription.userId ? "free" : null,
      organizationPlan: existingSubscription.organizationId ? "free" : null,
    },
  });

  console.log(`Subscription canceled: ${subscription.id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Cast for Stripe SDK v20+ type compatibility
  const invoiceAny = invoice as unknown as { subscription: string | null };
  const subscriptionId = invoiceAny.subscription;

  if (!subscriptionId) return;

  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!existingSubscription) {
    console.log(`No subscription found for Stripe ID: ${subscriptionId}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: { status: "past_due" },
  });

  console.log(`Payment failed for subscription: ${subscriptionId}`);

  // TODO: ユーザーにメール通知を送信
}

function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): "active" | "canceled" | "past_due" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
    case "unpaid":
      return "canceled";
    case "past_due":
    case "incomplete":
    case "incomplete_expired":
      return "past_due";
    default:
      return "active";
  }
}
