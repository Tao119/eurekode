import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent, getSubscription } from "@/lib/stripe";
import { IndividualPlan, OrganizationPlan } from "@/config/plans";

/**
 * 自動ログイン用のトークンを生成して保存
 */
async function createLoginToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10分間有効

  await prisma.verificationToken.create({
    data: {
      identifier: `login:${email}`,
      token,
      expires,
    },
  });

  return token;
}

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
  const { type } = metadata;

  // 新規登録（決済後にユーザー作成）の場合
  if (type === "registration") {
    await handleRegistrationCompleted(session);
    return;
  }

  // クレジット購入の場合
  if (type === "credit_purchase") {
    await handleCreditPurchaseCompleted(session);
    return;
  }

  // 既存ユーザーのサブスクリプション購入の場合
  const { userId, plan, isOrganization } = metadata;

  if (!userId) {
    console.error("Missing userId in checkout session metadata");
    return;
  }

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
 * 新規登録＋決済完了処理
 * 決済が成功した後にユーザーを作成する
 */
async function handleRegistrationCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const { email, passwordHash, displayName, userType, organizationName, plan } = metadata;

  if (!email || !passwordHash || !displayName || !userType || !plan) {
    console.error("Missing registration data in checkout session metadata");
    return;
  }

  // メールアドレスの重複チェック（決済中に別の方法で登録された可能性）
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.error(`User already exists with email: ${email}`);
    // ユーザーが既に存在する場合、サブスクリプションを更新する
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;
    const stripeSubscription = await getSubscription(subscriptionId);

    if (stripeSubscription && existingUser.id) {
      const priceId = stripeSubscription.items.data[0]?.price.id;
      const subAny = stripeSubscription as unknown as { current_period_start: number; current_period_end: number };

      await prisma.subscription.upsert({
        where: { userId: existingUser.id },
        create: {
          userId: existingUser.id,
          individualPlan: userType === "individual" ? (plan as IndividualPlan) : null,
          organizationPlan: userType === "admin" ? (plan as OrganizationPlan) : null,
          status: "active",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId,
          currentPeriodStart: new Date(subAny.current_period_start * 1000),
          currentPeriodEnd: new Date(subAny.current_period_end * 1000),
        },
        update: {
          individualPlan: userType === "individual" ? (plan as IndividualPlan) : null,
          organizationPlan: userType === "admin" ? (plan as OrganizationPlan) : null,
          status: "active",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId,
        },
      });
    }
    return;
  }

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;
  const stripeSubscription = await getSubscription(subscriptionId);

  if (!stripeSubscription) {
    console.error("Could not retrieve subscription from Stripe for registration");
    return;
  }

  const priceId = stripeSubscription.items.data[0]?.price.id;
  const subAny = stripeSubscription as unknown as { current_period_start: number; current_period_end: number };
  const currentPeriodStart = new Date(subAny.current_period_start * 1000);
  const currentPeriodEnd = new Date(subAny.current_period_end * 1000);

  try {
    if (userType === "admin") {
      // 組織管理者の場合: Organization + User + Subscription を作成
      const organization = await prisma.organization.create({
        data: {
          name: organizationName || "未設定",
          plan: plan as OrganizationPlan,
          settings: {
            allowedModes: ["explanation", "generation", "brainstorm"],
            allowedTechStacks: [],
            unlockSkipAllowed: false,
            reflectionRequired: false,
            defaultDailyTokenLimit: 1000,
          },
          users: {
            create: {
              email,
              passwordHash,
              displayName,
              userType: "admin",
              emailVerified: new Date(),
            },
          },
          subscription: {
            create: {
              organizationPlan: plan as OrganizationPlan,
              status: "active",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              currentPeriodStart,
              currentPeriodEnd,
            },
          },
        },
        include: {
          users: true,
        },
      });

      // クレジット残高を初期化
      if (organization.users[0]) {
        await initializeCreditBalance(organization.users[0].id, currentPeriodStart, currentPeriodEnd);
      }

      console.log(`Registration completed for admin user: ${email}, organization: ${organizationName}`);
    } else {
      // 個人ユーザーの場合: User + Subscription を作成
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName,
          userType: "individual",
          emailVerified: new Date(),
          subscription: {
            create: {
              individualPlan: plan as IndividualPlan,
              status: "active",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              currentPeriodStart,
              currentPeriodEnd,
            },
          },
        },
      });

      // クレジット残高を初期化
      await initializeCreditBalance(user.id, currentPeriodStart, currentPeriodEnd);

      console.log(`Registration completed for individual user: ${email}, plan: ${plan}`);
    }
  } catch (error) {
    console.error("Error creating user from registration checkout:", error);
    // Note: 決済は成功しているため、サポートに連絡するなどの対応が必要
    // TODO: アラート通知を送信
  }
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
