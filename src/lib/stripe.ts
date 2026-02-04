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
 * サブスクリプションのプランを変更（即時適用、按分あり）
 * - アップグレード: 差額を即時請求
 * - ダウングレード: 残り期間分をクレジットとして計算
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
 * サブスクリプションのプランを次回更新時に変更（ダウングレード用）
 * - 現在の請求期間が終了するまで現在のプランを維持
 * - 期間終了時に新しいプランに自動移行
 */
export async function scheduleSubscriptionPlanChange(
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.SubscriptionSchedule> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // SDK v20+では期間情報はitems.data[0]から取得
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
  if (typeof currentPeriodEnd !== "number") {
    throw new Error("Could not determine subscription period end");
  }

  // 既存のスケジュールがあればそれを更新、なければ新規作成
  const schedules = await stripe.subscriptionSchedules.list({
    customer: subscription.customer as string,
  });

  const existingSchedule = schedules.data.find(
    s => s.subscription === subscriptionId && s.status === "active"
  );

  if (existingSchedule) {
    // 既存のスケジュールを更新
    return stripe.subscriptionSchedules.update(existingSchedule.id, {
      phases: [
        {
          items: [{ price: subscription.items.data[0].price.id, quantity: 1 }],
          start_date: existingSchedule.phases[0]?.start_date || Math.floor(Date.now() / 1000),
          end_date: currentPeriodEnd,
        },
        {
          items: [{ price: newPriceId, quantity: 1 }],
          start_date: currentPeriodEnd,
        },
      ],
    });
  }

  // 新しいスケジュールを作成
  return stripe.subscriptionSchedules.create({
    from_subscription: subscriptionId,
    phases: [
      {
        items: [{ price: subscription.items.data[0].price.id, quantity: 1 }],
        end_date: currentPeriodEnd,
      },
      {
        items: [{ price: newPriceId, quantity: 1 }],
      },
    ],
  });
}

/**
 * プラン変更のプレビュー（按分計算の見積もり）
 */
export async function previewSubscriptionChange(
  subscriptionId: string,
  newPriceId: string
): Promise<{
  immediateAmount: number;
  proratedCredit: number;
  nextInvoiceAmount: number;
}> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // SDK v20+では invoices.createPreview を使用
  const upcomingInvoice = await stripe.invoices.createPreview({
    customer: subscription.customer as string,
    subscription: subscriptionId,
    subscription_details: {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: "create_prorations",
    },
  });

  // 按分計算された項目を抽出（SDK v20+ではprorationプロパティを直接確認）
  const prorations = upcomingInvoice.lines.data.filter(
    (line) => (line as unknown as { proration?: boolean }).proration === true
  );

  const proratedCredit = prorations
    .filter((p) => p.amount < 0)
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);

  const immediateCharge = prorations
    .filter((p) => p.amount > 0)
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    immediateAmount: immediateCharge - proratedCredit,
    proratedCredit,
    nextInvoiceAmount: upcomingInvoice.total,
  };
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
