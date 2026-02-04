import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import type { ApiResponse } from "@/types/api";
import type { IndividualPlan, OrganizationPlan } from "@/config/plans";

const registerCheckoutSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .regex(
      /^(?=.*[a-zA-Z])(?=.*\d)/,
      "パスワードは英字と数字を含める必要があります"
    ),
  displayName: z
    .string()
    .min(1, "表示名を入力してください")
    .max(100, "表示名は100文字以内で入力してください"),
  userType: z.enum(["individual", "admin"]),
  organizationName: z.string().optional(),
  plan: z.string(),
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const parsed = registerCheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const { email, password, displayName, userType, organizationName, plan, billingInterval } =
      parsed.data;

    // Validate organization name for admin users
    if (userType === "admin" && !organizationName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "組織名を入力してください",
          },
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_EXISTS",
            message: "このメールアドレスは既に登録されています",
          },
        },
        { status: 409 }
      );
    }

    // Get Stripe Price ID
    let priceId: string | undefined;

    if (userType === "admin") {
      const orgPlan = plan as OrganizationPlan;
      if (orgPlan !== "free" && orgPlan !== "enterprise") {
        const prices = STRIPE_PRICE_IDS.organization[orgPlan as keyof typeof STRIPE_PRICE_IDS.organization];
        priceId = billingInterval === "yearly" ? prices?.yearly : prices?.monthly;
      }
    } else {
      const indPlan = plan as IndividualPlan;
      if (indPlan !== "free") {
        const prices = STRIPE_PRICE_IDS.individual[indPlan as keyof typeof STRIPE_PRICE_IDS.individual];
        priceId = billingInterval === "yearly" ? prices?.yearly : prices?.monthly;
      }
    }

    if (!priceId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PLAN",
            message: "選択されたプランの価格IDが設定されていません",
          },
        },
        { status: 400 }
      );
    }

    // Hash password for metadata (we'll store it encrypted)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create Stripe Checkout session with registration data in metadata
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${appUrl}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/register?cancelled=true`,
      metadata: {
        type: "registration",
        email,
        passwordHash,
        displayName,
        userType,
        organizationName: organizationName || "",
        plan,
        billingInterval,
      },
      subscription_data: {
        metadata: {
          type: "registration",
          email,
          userType,
          plan,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  } catch (error) {
    console.error("Register checkout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "決済セッションの作成に失敗しました",
        },
      },
      { status: 500 }
    );
  }
}
