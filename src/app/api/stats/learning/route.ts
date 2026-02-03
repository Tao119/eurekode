import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface LearningStats {
  consecutiveDays: number;
  monthlyInsights: number;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Calculate consecutive learning days
    const consecutiveDays = await calculateConsecutiveDays(userId);

    // Count monthly insights
    const monthlyInsights = await countMonthlyInsights(userId);

    const stats: LearningStats = {
      consecutiveDays,
      monthlyInsights,
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("Failed to get learning stats:", error);
    return NextResponse.json(
      { success: false, error: { message: "統計情報の取得に失敗しました" } },
      { status: 500 }
    );
  }
}

async function calculateConsecutiveDays(userId: string): Promise<number> {
  // Get all unique learning dates for the user (conversations or learnings)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get learning activity dates from conversations
  const conversationDates = await prisma.conversation.findMany({
    where: { userId },
    select: { updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // Get learning activity dates from learnings (insights/reflections)
  const learningDates = await prisma.learning.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Combine and normalize dates to day-level
  const activityDatesSet = new Set<string>();

  for (const conv of conversationDates) {
    const date = new Date(conv.updatedAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    activityDatesSet.add(dateKey);
  }

  for (const learning of learningDates) {
    const date = new Date(learning.createdAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    activityDatesSet.add(dateKey);
  }

  // Convert to sorted array of dates
  const activityDates = Array.from(activityDatesSet)
    .map((dateKey) => {
      const [year, month, day] = dateKey.split("-").map(Number);
      return new Date(year, month, day);
    })
    .sort((a, b) => b.getTime() - a.getTime()); // Most recent first

  if (activityDates.length === 0) {
    return 0;
  }

  // Check if the user had activity today or yesterday
  const mostRecentActivity = activityDates[0];
  const daysSinceLastActivity = Math.floor(
    (today.getTime() - mostRecentActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If last activity was more than 1 day ago, streak is broken
  if (daysSinceLastActivity > 1) {
    return 0;
  }

  // Count consecutive days
  let consecutiveDays = 1;
  let previousDate = mostRecentActivity;

  for (let i = 1; i < activityDates.length; i++) {
    const currentDate = activityDates[i];
    const daysDiff = Math.floor(
      (previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      consecutiveDays++;
      previousDate = currentDate;
    } else if (daysDiff > 1) {
      // Streak is broken
      break;
    }
    // If daysDiff === 0, same day, skip
  }

  return consecutiveDays;
}

async function countMonthlyInsights(userId: string): Promise<number> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const count = await prisma.learning.count({
    where: {
      userId,
      type: "insight",
      createdAt: {
        gte: firstDayOfMonth,
      },
    },
  });

  return count;
}
