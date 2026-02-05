import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// GET /api/admin/members - Get all members in organization
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status"); // active, inactive
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get current period for allocation lookup
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get 7 days ago for active status
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Build where clause (include both admin and member)
    const whereClause: Prisma.UserWhereInput = {
      organizationId: session.user.organizationId,
      userType: { in: ["member", "admin"] },
      ...(search && {
        displayName: { contains: search, mode: "insensitive" as const },
      }),
    };

    // Get members with related data
    const members = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true,
        accessKey: {
          select: {
            id: true,
            keyCode: true,
            dailyTokenLimit: true,
            status: true,
            usedAt: true,
          },
        },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true },
        },
        _count: {
          select: {
            conversations: true,
            learnings: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Fetch credit allocations for all members in the current period
    const memberIds = members.map((m) => m.id);
    const allocations = await prisma.creditAllocation.findMany({
      where: {
        organizationId: session.user.organizationId,
        userId: { in: memberIds },
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      select: {
        userId: true,
        allocatedPoints: true,
        usedPoints: true,
      },
    });
    const allocationMap = new Map(
      allocations.map((a) => [a.userId, a])
    );

    // Transform data
    const transformedMembers = members.map((member) => {
      const lastActiveAt = member.conversations[0]?.updatedAt;
      const isActive = lastActiveAt && lastActiveAt >= sevenDaysAgo;
      const allocation = allocationMap.get(member.id);
      const allocatedPoints = allocation?.allocatedPoints ?? member.accessKey?.dailyTokenLimit ?? 0;
      const usedPoints = allocation?.usedPoints ?? 0;

      return {
        id: member.id,
        displayName: member.displayName,
        email: member.email,
        joinedAt: member.createdAt.toISOString(),
        lastActiveAt: lastActiveAt?.toISOString() || null,
        allocatedPoints,
        usedPoints,
        remainingPoints: Math.max(0, allocatedPoints - usedPoints),
        status: isActive ? "active" : "inactive",
        accessKey: member.accessKey
          ? {
              id: member.accessKey.id,
              keyCode: member.accessKey.keyCode,
              status: member.accessKey.status,
            }
          : null,
        stats: {
          totalConversations: member._count.conversations,
          totalLearnings: member._count.learnings,
        },
      };
    });

    // Filter by status if specified
    const filteredMembers = status
      ? transformedMembers.filter((m) => m.status === status)
      : transformedMembers;

    // Get total count
    const totalCount = await prisma.user.count({ where: whereClause });

    // Get active count
    const activeCount = transformedMembers.filter((m) => m.status === "active").length;

    // Get total monthly points used
    const monthlyPointsUsed = transformedMembers.reduce((sum, m) => sum + m.usedPoints, 0);

    return NextResponse.json({
      success: true,
      data: {
        members: filteredMembers,
        pagination: {
          total: totalCount,
          limit,
          offset,
        },
        summary: {
          totalMembers: totalCount,
          activeMembers: activeCount,
          monthlyPointsUsed,
        },
      },
    });
  } catch (error) {
    console.error("Get admin members error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
