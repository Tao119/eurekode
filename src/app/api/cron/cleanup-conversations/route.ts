import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRetentionCutoffDate, getRetentionDays } from "@/lib/retention";

/**
 * Cleanup old conversations based on retention policy.
 * This endpoint is called by Vercel Cron.
 *
 * Retention rules:
 * - Conversations older than retention period are deleted
 * - Related learnings and artifacts are cascade-deleted by Prisma
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

    const retentionDays = getRetentionDays();
    const cutoffDate = getRetentionCutoffDate();

    // Count conversations to be deleted (for logging)
    const countToDelete = await prisma.conversation.count({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    if (countToDelete === 0) {
      return NextResponse.json({
        success: true,
        message: "No conversations to clean up",
        deletedCount: 0,
        retentionDays,
      });
    }

    // Delete old conversations
    // Note: Related learnings and artifacts are cascade-deleted via Prisma relations
    const result = await prisma.conversation.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    console.log(`[Cleanup] Deleted ${result.count} conversations older than ${retentionDays} days`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.count} old conversations`,
      deletedCount: result.count,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error("Conversation cleanup error:", error);
    return NextResponse.json(
      { success: false, error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
