import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { DEFAULT_ORGANIZATION_SETTINGS, type OrganizationSettings } from "@/types/user";

// GET /api/admin/organization - Get organization info and statistics
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    // Check if user is admin
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

    // Get organization with related data
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        subscription: true,
        _count: {
          select: {
            users: true,
            accessKeys: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "組織が見つかりません" } },
        { status: 404 }
      );
    }

    // Get active members count (members who have been active in the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeMembers = await prisma.user.count({
      where: {
        organizationId: session.user.organizationId,
        conversations: {
          some: {
            updatedAt: { gte: sevenDaysAgo },
          },
        },
      },
    });

    // Get issued keys count by status
    const keyStats = await prisma.accessKey.groupBy({
      by: ["status"],
      where: { organizationId: session.user.organizationId },
      _count: { id: true },
    });

    const keyStatusCounts = {
      active: 0,
      used: 0,
      expired: 0,
      revoked: 0,
    };
    for (const stat of keyStats) {
      keyStatusCounts[stat.status as keyof typeof keyStatusCounts] = stat._count.id;
    }

    // Get this month's token usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyTokenUsage = await prisma.tokenUsage.aggregate({
      where: {
        user: { organizationId: session.user.organizationId },
        date: { gte: startOfMonth },
      },
      _sum: { tokensUsed: true },
    });

    // Get total conversations count
    const totalConversations = await prisma.conversation.count({
      where: {
        user: { organizationId: session.user.organizationId },
      },
    });

    // Get recent activity for alerts
    const inactiveMembers = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        userType: "member",
        conversations: {
          none: {
            updatedAt: { gte: sevenDaysAgo },
          },
        },
      },
      select: {
        id: true,
        displayName: true,
      },
      take: 5,
    });

    // Get members with low token remaining today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const membersWithUsage = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        userType: "member",
      },
      select: {
        id: true,
        displayName: true,
        accessKey: {
          select: { dailyTokenLimit: true },
        },
        tokenUsage: {
          where: { date: today },
          select: { tokensUsed: true },
        },
      },
    });

    const lowTokenMembers = membersWithUsage
      .filter((member) => {
        const limit = member.accessKey?.dailyTokenLimit || 1000;
        const used = member.tokenUsage[0]?.tokensUsed || 0;
        return used >= limit * 0.8; // 80% or more used
      })
      .map((m) => ({ id: m.id, displayName: m.displayName }))
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          plan: organization.plan,
          settings: {
            ...DEFAULT_ORGANIZATION_SETTINGS,
            ...(organization.settings as Partial<OrganizationSettings> | null),
          },
          createdAt: organization.createdAt.toISOString(),
        },
        subscription: organization.subscription
          ? {
              plan: organization.subscription.organizationPlan,
              status: organization.subscription.status,
              currentPeriodEnd: organization.subscription.currentPeriodEnd?.toISOString(),
            }
          : null,
        statistics: {
          totalMembers: organization._count.users,
          activeMembers,
          totalKeys: organization._count.accessKeys,
          keysByStatus: keyStatusCounts,
          monthlyTokenUsage: monthlyTokenUsage._sum.tokensUsed || 0,
          totalConversations,
        },
        alerts: {
          inactiveMembers,
          lowTokenMembers,
        },
      },
    });
  } catch (error) {
    console.error("Get admin organization error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/organization - Update organization info
const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const parsed = updateOrganizationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request format" } },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: parsed.data,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        plan: organization.plan,
      },
    });
  } catch (error) {
    console.error("Update admin organization error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
