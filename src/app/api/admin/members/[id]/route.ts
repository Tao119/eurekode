import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/members/:id - Get member details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    if (session.user.userType !== "admin") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "管理者権限が必要です" } },
        { status: 403 }
      );
    }

    if (!session.user.organizationId) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "組織が見つかりません" } },
        { status: 404 }
      );
    }

    const { id } = await context.params;

    // Get member with full details
    const member = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        userType: "member",
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true,
        settings: true,
        accessKey: {
          select: {
            id: true,
            keyCode: true,
            dailyTokenLimit: true,
            status: true,
            settings: true,
            expiresAt: true,
            usedAt: true,
            createdAt: true,
          },
        },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: {
            id: true,
            mode: true,
            title: true,
            tokensConsumed: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        learnings: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            type: true,
            content: true,
            tags: true,
            createdAt: true,
          },
        },
        tokenUsage: {
          orderBy: { date: "desc" },
          take: 30,
          select: {
            date: true,
            tokensUsed: true,
            breakdown: true,
          },
        },
        _count: {
          select: {
            conversations: true,
            learnings: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
        { status: 404 }
      );
    }

    // Calculate statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const todayUsage = member.tokenUsage.find(
      (u) => new Date(u.date).toDateString() === today.toDateString()
    );

    const weeklyUsage = member.tokenUsage
      .filter((u) => new Date(u.date) >= sevenDaysAgo)
      .reduce((sum, u) => sum + u.tokensUsed, 0);

    const monthlyUsage = member.tokenUsage.reduce((sum, u) => sum + u.tokensUsed, 0);

    const lastActiveAt = member.conversations[0]?.updatedAt;
    const isActive = lastActiveAt && new Date(lastActiveAt) >= sevenDaysAgo;

    // Mode breakdown
    const modeBreakdown = member.conversations.reduce(
      (acc, conv) => {
        acc[conv.mode] = (acc[conv.mode] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: member.id,
          displayName: member.displayName,
          email: member.email,
          joinedAt: member.createdAt.toISOString(),
          lastActiveAt: lastActiveAt?.toISOString() || null,
          status: isActive ? "active" : "inactive",
        },
        accessKey: member.accessKey
          ? {
              id: member.accessKey.id,
              keyCode: member.accessKey.keyCode,
              dailyTokenLimit: member.accessKey.dailyTokenLimit,
              status: member.accessKey.status,
              expiresAt: member.accessKey.expiresAt?.toISOString() || null,
              usedAt: member.accessKey.usedAt?.toISOString() || null,
            }
          : null,
        statistics: {
          tokensUsedToday: todayUsage?.tokensUsed || 0,
          tokensUsedWeek: weeklyUsage,
          tokensUsedMonth: monthlyUsage,
          totalConversations: member._count.conversations,
          totalLearnings: member._count.learnings,
          modeBreakdown,
        },
        tokenHistory: member.tokenUsage.map((u) => ({
          date: u.date.toISOString().split("T")[0],
          tokensUsed: u.tokensUsed,
          breakdown: u.breakdown,
        })),
        recentConversations: member.conversations.map((c) => ({
          id: c.id,
          mode: c.mode,
          title: c.title,
          tokensConsumed: c.tokensConsumed,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
        recentLearnings: member.learnings.map((l) => ({
          id: l.id,
          type: l.type,
          content: l.content,
          tags: l.tags,
          createdAt: l.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Get admin member detail error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
