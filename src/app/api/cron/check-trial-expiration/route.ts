import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Check for expired trials and downgrade to free plan.
 * This endpoint is called by Vercel Cron.
 *
 * Downgrade rules:
 * - If trialEnd is past and stripeSubscriptionId is null, downgrade to free
 * - Individual users: individualPlan -> "free"
 * - Organizations: organizationPlan -> "free"
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find expired trials (trialEnd is past, no Stripe subscription, not already free)
    const expiredIndividualTrials = await prisma.subscription.findMany({
      where: {
        userId: { not: null },
        trialEnd: { lt: now },
        stripeSubscriptionId: null,
        individualPlan: { not: "free" },
      },
      select: {
        id: true,
        userId: true,
        individualPlan: true,
        trialEnd: true,
      },
    });

    const expiredOrganizationTrials = await prisma.subscription.findMany({
      where: {
        organizationId: { not: null },
        trialEnd: { lt: now },
        stripeSubscriptionId: null,
        organizationPlan: { not: "free" },
      },
      select: {
        id: true,
        organizationId: true,
        organizationPlan: true,
        trialEnd: true,
      },
    });

    const totalExpired = expiredIndividualTrials.length + expiredOrganizationTrials.length;

    if (totalExpired === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired trials to process",
        downgradedCount: 0,
      });
    }

    // Downgrade individual users
    let individualDowngraded = 0;
    for (const sub of expiredIndividualTrials) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          individualPlan: "free",
          trialEnd: null, // Clear trial end to mark as processed
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free plan
        },
      });
      individualDowngraded++;
      console.log(`[Trial] Downgraded individual user ${sub.userId} from ${sub.individualPlan} to free`);
    }

    // Downgrade organizations
    let organizationDowngraded = 0;
    for (const sub of expiredOrganizationTrials) {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: sub.id },
          data: {
            organizationPlan: "free",
            trialEnd: null, // Clear trial end to mark as processed
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        }),
        // Also update organization's plan field
        prisma.organization.update({
          where: { id: sub.organizationId! },
          data: { plan: "free" },
        }),
      ]);
      organizationDowngraded++;
      console.log(`[Trial] Downgraded organization ${sub.organizationId} from ${sub.organizationPlan} to free`);
    }

    return NextResponse.json({
      success: true,
      message: `Downgraded ${totalExpired} expired trials`,
      downgradedCount: totalExpired,
      individual: individualDowngraded,
      organization: organizationDowngraded,
    });
  } catch (error) {
    console.error("Trial expiration check error:", error);
    return NextResponse.json(
      { success: false, error: "Trial check failed" },
      { status: 500 }
    );
  }
}
