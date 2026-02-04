import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getIndividualPlan,
  getOrganizationPlan,
  IndividualPlan,
  OrganizationPlan,
} from "@/config/plans";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ユーザー情報とサブスクリプションを取得
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        subscription: true,
        organization: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 個人サブスクリプション
    const individualSubscription = user.subscription;
    const individualPlan: IndividualPlan =
      (individualSubscription?.individualPlan as IndividualPlan) || "free";
    const individualPlanConfig = getIndividualPlan(individualPlan);

    // 組織サブスクリプション（メンバーの場合）
    const orgSubscription = user.organization?.subscription;
    const orgPlan: OrganizationPlan | null = orgSubscription?.organizationPlan
      ? (orgSubscription.organizationPlan as OrganizationPlan)
      : null;
    const orgPlanConfig = orgPlan ? getOrganizationPlan(orgPlan) : null;

    // 実際に適用されるプランを決定
    const isOrganization = !!orgPlanConfig;
    const effectivePlan = isOrganization ? orgPlan : individualPlan;
    const effectiveSubscription = isOrganization ? orgSubscription : individualSubscription;

    // トライアル情報を計算
    const trialEnd = effectiveSubscription?.trialEnd;
    const isTrialing = trialEnd ? new Date() < new Date(trialEnd) : false;
    const trialDaysRemaining = trialEnd
      ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;
    const hasStripeSubscription = !!effectiveSubscription?.stripeSubscriptionId;

    // Stripe APIでcancel_at_period_endを確認する必要があるが、
    // ここではDBの状態のみを返す（cancel_at_period_endはStripe Portalで確認）
    return NextResponse.json({
      // シンプルな形式（billing pageで使用）
      plan: effectivePlan,
      planType: isOrganization ? "organization" : "individual",
      status: effectiveSubscription?.status || "active",
      currentPeriodEnd: effectiveSubscription?.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: false, // TODO: Stripe APIから取得
      // トライアル情報
      trial: {
        isTrialing,
        trialEnd: trialEnd?.toISOString() || null,
        daysRemaining: trialDaysRemaining,
        isPaid: hasStripeSubscription,
      },
      // 詳細情報
      individual: {
        plan: individualPlan,
        planConfig: individualPlanConfig,
        status: individualSubscription?.status || "active",
        currentPeriodEnd: individualSubscription?.currentPeriodEnd,
        trialEnd: individualSubscription?.trialEnd,
        hasStripeSubscription: !!individualSubscription?.stripeSubscriptionId,
      },
      organization: orgPlanConfig
        ? {
            plan: orgPlan,
            planConfig: orgPlanConfig,
            status: orgSubscription?.status || "active",
            currentPeriodEnd: orgSubscription?.currentPeriodEnd,
            trialEnd: orgSubscription?.trialEnd,
          }
        : null,
      // 実際に適用されるプラン（組織プランがあれば組織、なければ個人）
      effectivePlan: orgPlanConfig
        ? {
            type: "organization" as const,
            plan: orgPlan,
            features: orgPlanConfig.features,
          }
        : {
            type: "individual" as const,
            plan: individualPlan,
            features: individualPlanConfig.features,
          },
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription" },
      { status: 500 }
    );
  }
}
