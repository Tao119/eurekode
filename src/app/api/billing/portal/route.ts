import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPortalSession } from "@/lib/stripe";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ユーザーのサブスクリプション情報を取得
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    // カスタマーポータルセッションを作成
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const portalSession = await createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
