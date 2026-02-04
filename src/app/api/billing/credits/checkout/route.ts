/**
 * Credit Purchase Checkout API
 *
 * クレジット（ポイント）購入のための Stripe Checkout セッション作成
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import {
  CREDIT_PACKS,
  CREDIT_MIN_PURCHASE_AMOUNT,
  CREDIT_CUSTOM_UNIT_PRICE,
  calculatePointsFromAmount,
  getCreditPack,
} from "@/config/plans";

interface CheckoutRequest {
  /** パックID（プリセット購入の場合） */
  packId?: string;
  /** カスタム金額（円） */
  customAmount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 組織メンバーは購入不可
    const userType = session.user.userType;
    if (userType === "member") {
      return NextResponse.json(
        {
          error: "Organization members cannot purchase credits",
          errorJa: "組織メンバーはクレジットを購入できません",
        },
        { status: 403 }
      );
    }

    const body: CheckoutRequest = await request.json();
    const { packId, customAmount } = body;

    let points: number;
    let amount: number;
    let unitPrice: number;
    let productName: string;
    let productDescription: string;

    if (packId) {
      // プリセットパック購入
      const pack = getCreditPack(packId);
      if (!pack) {
        return NextResponse.json(
          { error: "Invalid pack ID" },
          { status: 400 }
        );
      }
      points = pack.points;
      amount = pack.price;
      unitPrice = pack.unitPrice;
      productName = `Eurecode クレジット - ${pack.nameJa}`;
      productDescription = `${pack.points}ポイント（¥${pack.unitPrice}/pt）`;
    } else if (customAmount !== undefined) {
      // カスタム金額購入
      if (customAmount < CREDIT_MIN_PURCHASE_AMOUNT) {
        return NextResponse.json(
          {
            error: `Minimum purchase amount is ¥${CREDIT_MIN_PURCHASE_AMOUNT}`,
            errorJa: `最低購入金額は¥${CREDIT_MIN_PURCHASE_AMOUNT}です`,
          },
          { status: 400 }
        );
      }
      points = calculatePointsFromAmount(customAmount);
      amount = customAmount;
      unitPrice = CREDIT_CUSTOM_UNIT_PRICE;
      productName = "Eurecode クレジット - カスタム";
      productDescription = `${points}ポイント（¥${unitPrice}/pt）`;
    } else {
      return NextResponse.json(
        { error: "packId or customAmount is required" },
        { status: 400 }
      );
    }

    // 既存のStripe顧客IDを取得（サブスクリプションから）
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { stripeCustomerId: true },
    });
    const stripeCustomerId = subscription?.stripeCustomerId ?? null;

    const requestUrl = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;

    // Stripe Checkout セッション作成
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId || undefined,
      customer_email: stripeCustomerId ? undefined : session.user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "jpy",
            unit_amount: amount,
            product_data: {
              name: productName,
              description: productDescription,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.user.id,
        type: "credit_purchase",
        packId: packId || "custom",
        points: points.toString(),
        unitPrice: unitPrice.toString(),
      },
      success_url: `${baseUrl}/settings/billing?credit_purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/billing?credit_purchase=canceled`,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Credit checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

/**
 * GET: クレジットパック一覧を取得
 */
export async function GET() {
  return NextResponse.json({
    packs: CREDIT_PACKS,
    minPurchaseAmount: CREDIT_MIN_PURCHASE_AMOUNT,
    customUnitPrice: CREDIT_CUSTOM_UNIT_PRICE,
  });
}
