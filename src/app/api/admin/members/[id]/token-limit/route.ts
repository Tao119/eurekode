import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PLAN_CREDITS } from "@/lib/stripe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/members/:id/token-limit - Update member's monthly token limit
const updateTokenLimitSchema = z.object({
  monthlyTokenLimit: z.number().int().min(0).max(1000000),
});

export async function PUT(request: NextRequest, context: RouteContext) {
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

    const { id: memberId } = await context.params;
    const body = await request.json();
    const parsed = updateTokenLimitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "入力が無効です", details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { monthlyTokenLimit } = parsed.data;

    // Get organization with plan info
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        plan: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "組織が見つかりません" } },
        { status: 404 }
      );
    }

    // Get organization's monthly limit based on plan
    const orgMonthlyLimit = PLAN_CREDITS.organization[organization.plan as keyof typeof PLAN_CREDITS.organization] || 5000;

    // Verify member belongs to organization (or is admin themselves)
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: session.user.organizationId,
        OR: [
          { userType: "member" },
          { userType: "admin" },
        ],
      },
      select: { id: true, displayName: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
        { status: 404 }
      );
    }

    // Calculate current period
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get current allocations for all members (excluding target member)
    const currentAllocations = await prisma.creditAllocation.findMany({
      where: {
        organizationId: session.user.organizationId,
        periodStart: periodStart,
        userId: { not: memberId },
      },
      select: { allocatedPoints: true },
    });

    const totalAllocatedToOthers = currentAllocations.reduce(
      (sum, alloc) => sum + alloc.allocatedPoints,
      0
    );

    // Check if new allocation would exceed organization limit
    if (totalAllocatedToOthers + monthlyTokenLimit > orgMonthlyLimit) {
      const remaining = orgMonthlyLimit - totalAllocatedToOthers;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "LIMIT_EXCEEDED",
            message: `組織の月間上限を超えています。割り当て可能な上限: ${Math.max(0, remaining).toLocaleString()}`,
          },
        },
        { status: 400 }
      );
    }

    // Upsert credit allocation
    const allocation = await prisma.creditAllocation.upsert({
      where: {
        organizationId_userId_periodStart: {
          organizationId: session.user.organizationId,
          userId: memberId,
          periodStart: periodStart,
        },
      },
      create: {
        organizationId: session.user.organizationId,
        userId: memberId,
        allocatedPoints: monthlyTokenLimit,
        periodStart: periodStart,
        periodEnd: periodEnd,
      },
      update: {
        allocatedPoints: monthlyTokenLimit,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        memberId: memberId,
        monthlyTokenLimit: allocation.allocatedPoints,
        usedPoints: allocation.usedPoints,
        remaining: allocation.allocatedPoints - allocation.usedPoints,
      },
    });
  } catch (error) {
    console.error("Update member token limit error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// GET /api/admin/members/:id/token-limit - Get member's token allocation info
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

    const { id: memberId } = await context.params;

    // Get organization with plan info
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        plan: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "組織が見つかりません" } },
        { status: 404 }
      );
    }

    // Verify member belongs to organization
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: session.user.organizationId,
        OR: [
          { userType: "member" },
          { userType: "admin" },
        ],
      },
      select: { id: true, displayName: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
        { status: 404 }
      );
    }

    // Calculate current period
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get organization's monthly limit based on plan
    const orgMonthlyLimit = PLAN_CREDITS.organization[organization.plan as keyof typeof PLAN_CREDITS.organization] || 5000;

    // Get current allocation for member
    const memberAllocation = await prisma.creditAllocation.findUnique({
      where: {
        organizationId_userId_periodStart: {
          organizationId: session.user.organizationId,
          userId: memberId,
          periodStart: periodStart,
        },
      },
    });

    // Get total allocated to all members
    const allAllocations = await prisma.creditAllocation.findMany({
      where: {
        organizationId: session.user.organizationId,
        periodStart: periodStart,
      },
      select: { allocatedPoints: true, userId: true },
    });

    const totalAllocated = allAllocations.reduce(
      (sum, alloc) => sum + alloc.allocatedPoints,
      0
    );

    const totalAllocatedToOthers = allAllocations
      .filter((a) => a.userId !== memberId)
      .reduce((sum, alloc) => sum + alloc.allocatedPoints, 0);

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: member.id,
          displayName: member.displayName,
          monthlyTokenLimit: memberAllocation?.allocatedPoints || 0,
          usedPoints: memberAllocation?.usedPoints || 0,
          remaining: (memberAllocation?.allocatedPoints || 0) - (memberAllocation?.usedPoints || 0),
        },
        organization: {
          plan: organization.plan,
          monthlyLimit: orgMonthlyLimit,
          totalAllocated: totalAllocated,
          availableForAllocation: orgMonthlyLimit - totalAllocatedToOthers,
        },
      },
    });
  } catch (error) {
    console.error("Get member token limit error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
