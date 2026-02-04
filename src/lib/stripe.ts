import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

/**
 * Stripe Price IDs
 * これらはStripeダッシュボードで製品・価格を作成後に設定
 */
export const STRIPE_PRICE_IDS = {
  // 個人プラン（月額）
  individual: {
    starter: {
      monthly: process.env.STRIPE_PRICE_INDIVIDUAL_STARTER_MONTHLY,
      yearly: process.env.STRIPE_PRICE_INDIVIDUAL_STARTER_YEARLY,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_INDIVIDUAL_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_INDIVIDUAL_PRO_YEARLY,
    },
    max: {
      monthly: process.env.STRIPE_PRICE_INDIVIDUAL_MAX_MONTHLY,
      yearly: process.env.STRIPE_PRICE_INDIVIDUAL_MAX_YEARLY,
    },
  },
  // 組織プラン（月額）
  organization: {
    starter: {
      monthly: process.env.STRIPE_PRICE_ORG_STARTER_MONTHLY,
      yearly: process.env.STRIPE_PRICE_ORG_STARTER_YEARLY,
    },
    business: {
      monthly: process.env.STRIPE_PRICE_ORG_BUSINESS_MONTHLY,
      yearly: process.env.STRIPE_PRICE_ORG_BUSINESS_YEARLY,
    },
    // enterprise は応相談のため Price ID なし
  },
} as const;

/**
 * Credit Purchase Product ID
 */
export const STRIPE_CREDIT_PRODUCT_ID = process.env.STRIPE_PRODUCT_CREDIT_PURCHASE;

/**
 * クレジット購入の最低金額（円）
 */
export const MIN_CREDIT_PURCHASE_AMOUNT = 300;

/**
 * 円からクレジットへの変換レート（1円 = 1クレジット）
 */
export const YEN_TO_CREDIT_RATE = 1;

/**
 * プランごとの月間クレジット
 */
export const PLAN_CREDITS = {
  individual: {
    free: 30,
    starter: 300,
    pro: 900,
    max: 3000,
  },
  organization: {
    free: 100,
    starter: 5000,
    business: 15000,
    enterprise: 999999, // Unlimited
  },
} as const;

/**
 * Stripe Checkoutセッションを作成（サブスクリプション用）
 */
export async function createCheckoutSession({
  priceId,
  customerId,
  customerEmail,
  successUrl,
  cancelUrl,
  metadata,
}: {
  priceId: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  };

  if (customerId) {
    sessionParams.customer = customerId;
  } else if (customerEmail) {
    sessionParams.customer_email = customerEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

/**
 * カスタマーポータルセッションを作成
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * サブスクリプションを取得
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return null;
  }
}

/**
 * サブスクリプションをキャンセル（期間終了時）
 */
export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * サブスクリプションのキャンセルを取り消す
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * 顧客を作成
 */
export async function createCustomer({
  email,
  name,
  metadata,
}: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    name,
    metadata,
  });
}

/**
 * Webhook署名を検証
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * クレジット購入用のCheckoutセッションを作成（一回払い）
 */
export async function createCreditPurchaseSession({
  amount,
  customerId,
  customerEmail,
  successUrl,
  cancelUrl,
  metadata,
}: {
  amount: number; // 購入金額（円）
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  if (amount < MIN_CREDIT_PURCHASE_AMOUNT) {
    throw new Error(`最低購入金額は${MIN_CREDIT_PURCHASE_AMOUNT}円です`);
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product: STRIPE_CREDIT_PRODUCT_ID!,
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...metadata,
      type: "credit_purchase",
      credits: String(amount * YEN_TO_CREDIT_RATE),
    },
  };

  if (customerId) {
    sessionParams.customer = customerId;
  } else if (customerEmail) {
    sessionParams.customer_email = customerEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

/**
 * サブスクリプションのプランを変更
 */
export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  return stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: "create_prorations",
  });
}

/**
 * 顧客の支払い方法を取得
 */
export async function getCustomerPaymentMethods(
  customerId: string
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });
  return paymentMethods.data;
}

/**
 * 顧客の請求履歴を取得
 */
export async function getCustomerInvoices(
  customerId: string,
  limit: number = 10
): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data;
}

/**
 * Price IDからプラン情報を逆引き
 */
export function getPlanFromPriceId(priceId: string): {
  type: "individual" | "organization";
  plan: string;
  interval: "monthly" | "yearly";
} | null {
  for (const [type, plans] of Object.entries(STRIPE_PRICE_IDS)) {
    for (const [plan, prices] of Object.entries(plans)) {
      if (prices.monthly === priceId) {
        return { type: type as "individual" | "organization", plan, interval: "monthly" };
      }
      if (prices.yearly === priceId) {
        return { type: type as "individual" | "organization", plan, interval: "yearly" };
      }
    }
  }
  return null;
}
