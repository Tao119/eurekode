import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PeriodType = "week" | "month" | "all";

function getDateRange(period: PeriodType): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case "week":
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start.setMonth(start.getMonth() - 1);
      break;
    case "all":
      start.setFullYear(start.getFullYear() - 10);
      break;
  }

  return { start, end };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "week") as PeriodType;
    const { start, end } = getDateRange(period);

    const userId = session.user.id;

    const [conversations, learnings, tokenUsage] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          userId,
          createdAt: { gte: start, lte: end },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          mode: true,
          tokensConsumed: true,
          createdAt: true,
          metadata: true,
        },
      }),
      prisma.learning.findMany({
        where: {
          userId,
          createdAt: { gte: start, lte: end },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          tags: true,
          type: true,
          createdAt: true,
        },
      }),
      prisma.tokenUsage.findMany({
        where: {
          userId,
          date: { gte: start, lte: end },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    const allLearnings = await prisma.learning.count({
      where: { userId },
    });

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const thisMonthLearnings = await prisma.learning.count({
      where: {
        userId,
        createdAt: { gte: thisMonthStart },
      },
    });

    const dailyLearningTime: Record<string, number> = {};
    const modeUsage: Record<string, number> = {
      explanation: 0,
      generation: 0,
      brainstorm: 0,
    };

    for (const conv of conversations) {
      const dateKey = formatDate(conv.createdAt);
      const estimatedMinutes = Math.ceil(conv.tokensConsumed / 100);
      dailyLearningTime[dateKey] = (dailyLearningTime[dateKey] || 0) + estimatedMinutes;

      if (conv.mode in modeUsage) {
        modeUsage[conv.mode]++;
      }
    }

    const learningTimeData = Object.entries(dailyLearningTime).map(([date, minutes]) => ({
      date,
      minutes,
    }));

    const tagCounts: Record<string, number> = {};
    for (const learning of learnings) {
      for (const tag of learning.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const maxTagCount = Math.max(...topTags.map(([, count]) => count), 1);
    const understandingData = topTags.map(([tag, count]) => ({
      subject: tag,
      value: Math.round((count / maxTagCount) * 100),
      fullMark: 100,
    }));

    if (understandingData.length === 0) {
      const defaultTopics = ["JavaScript", "React", "TypeScript", "CSS", "Node.js", "Git"];
      for (const topic of defaultTopics) {
        understandingData.push({
          subject: topic,
          value: 0,
          fullMark: 100,
        });
      }
    }

    let selfSolveRate = 0;
    let totalSessions = conversations.length;
    let solvedWithoutHints = 0;

    for (const conv of conversations) {
      const metadata = conv.metadata as Record<string, unknown> | null;
      if (metadata?.solvedWithoutHints === true) {
        solvedWithoutHints++;
      }
    }

    if (totalSessions > 0) {
      selfSolveRate = Math.round((solvedWithoutHints / totalSessions) * 100);
    }

    const estimationAccuracyData: Array<{ date: string; predicted: number; actual: number }> = [];
    for (const conv of conversations) {
      const metadata = conv.metadata as Record<string, unknown> | null;
      if (metadata?.estimatedTime && metadata?.actualTime) {
        estimationAccuracyData.push({
          date: formatDate(conv.createdAt),
          predicted: Number(metadata.estimatedTime),
          actual: Number(metadata.actualTime),
        });
      }
    }

    const totalLearningMinutes = Object.values(dailyLearningTime).reduce((sum, mins) => sum + mins, 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalLearningMinutes,
          totalConversations: conversations.length,
          totalLearnings: allLearnings,
          thisMonthLearnings,
          selfSolveRate,
        },
        learningTimeData,
        understandingData,
        estimationAccuracyData,
        modeUsage,
        period,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { success: false, error: { message: "データの取得に失敗しました" } },
      { status: 500 }
    );
  }
}
