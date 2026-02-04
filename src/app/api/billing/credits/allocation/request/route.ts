/**
 * Credit Allocation Request API (Organization Members)
 *
 * 組織メンバーが管理者にクレジット割り当てをリクエスト
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET: 自分のリクエスト一覧を取得
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "Not an organization member" },
        { status: 403 }
      );
    }

    const userType = session.user.userType;

    if (userType === "admin") {
      // 管理者：全リクエストを取得
      const requests = await prisma.creditAllocationRequest.findMany({
        where: {
          organizationId: user.organizationId,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // リクエスター情報を取得
      const requesterIds = [...new Set(requests.map((r) => r.requesterId))];
      const requesters = await prisma.user.findMany({
        where: { id: { in: requesterIds } },
        select: { id: true, displayName: true, email: true },
      });
      const requesterMap = new Map(requesters.map((r) => [r.id, r]));

      const requestsWithRequester = requests.map((r) => ({
        ...r,
        requester: requesterMap.get(r.requesterId) || null,
      }));

      return NextResponse.json({ requests: requestsWithRequester });
    } else {
      // メンバー：自分のリクエストのみ
      const requests = await prisma.creditAllocationRequest.findMany({
        where: {
          requesterId: session.user.id,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return NextResponse.json({ requests });
    }
  } catch (error) {
    console.error("Get allocation requests error:", error);
    return NextResponse.json(
      { error: "Failed to get allocation requests" },
      { status: 500 }
    );
  }
}

/**
 * POST: 割り当てリクエストを作成（メンバーのみ）
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userType = session.user.userType;
    if (userType !== "member") {
      return NextResponse.json(
        { error: "Only organization members can request allocations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestedPoints, reason } = body;

    if (!requestedPoints || requestedPoints <= 0) {
      return NextResponse.json(
        { error: "requestedPoints must be a positive number" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "Not an organization member" },
        { status: 403 }
      );
    }

    // 保留中のリクエストがあるかチェック
    const pendingRequest = await prisma.creditAllocationRequest.findFirst({
      where: {
        requesterId: session.user.id,
        status: "pending",
      },
    });

    if (pendingRequest) {
      return NextResponse.json(
        {
          error: "You already have a pending request",
          errorJa: "保留中のリクエストがあります",
        },
        { status: 400 }
      );
    }

    const allocationRequest = await prisma.creditAllocationRequest.create({
      data: {
        organizationId: user.organizationId,
        requesterId: session.user.id,
        requestedPoints,
        reason,
        status: "pending",
      },
    });

    return NextResponse.json({ request: allocationRequest });
  } catch (error) {
    console.error("Create allocation request error:", error);
    return NextResponse.json(
      { error: "Failed to create allocation request" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: リクエストを承認/却下（管理者のみ）
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userType = session.user.userType;
    if (userType !== "admin") {
      return NextResponse.json(
        { error: "Only admins can review allocation requests" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestId, action, rejectionReason } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: "requestId and action are required" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!admin?.organizationId) {
      return NextResponse.json(
        { error: "Not an organization admin" },
        { status: 403 }
      );
    }

    // リクエストを取得
    const allocationRequest = await prisma.creditAllocationRequest.findFirst({
      where: {
        id: requestId,
        organizationId: admin.organizationId,
        status: "pending",
      },
    });

    if (!allocationRequest) {
      return NextResponse.json(
        { error: "Request not found or already processed" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (action === "approve") {
      // 承認：割り当てを作成
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // 既存の割り当てを取得
      const existingAllocation = await prisma.creditAllocation.findFirst({
        where: {
          organizationId: admin.organizationId,
          userId: allocationRequest.requesterId,
          periodStart: { lte: now },
          periodEnd: { gte: now },
        },
      });

      // 割り当てを追加または更新
      const allocation = await prisma.creditAllocation.upsert({
        where: {
          organizationId_userId_periodStart: {
            organizationId: admin.organizationId,
            userId: allocationRequest.requesterId,
            periodStart,
          },
        },
        update: {
          allocatedPoints: {
            increment: allocationRequest.requestedPoints,
          },
        },
        create: {
          organizationId: admin.organizationId,
          userId: allocationRequest.requesterId,
          allocatedPoints: allocationRequest.requestedPoints,
          usedPoints: 0,
          periodStart,
          periodEnd,
        },
      });

      // リクエストを承認済みに更新
      await prisma.creditAllocationRequest.update({
        where: { id: requestId },
        data: {
          status: "approved",
          reviewedBy: session.user.id,
          reviewedAt: now,
          allocationId: allocation.id,
        },
      });

      return NextResponse.json({
        status: "approved",
        allocation,
      });
    } else {
      // 却下
      await prisma.creditAllocationRequest.update({
        where: { id: requestId },
        data: {
          status: "rejected",
          reviewedBy: session.user.id,
          reviewedAt: now,
          rejectionReason,
        },
      });

      return NextResponse.json({
        status: "rejected",
      });
    }
  } catch (error) {
    console.error("Review allocation request error:", error);
    return NextResponse.json(
      { error: "Failed to review allocation request" },
      { status: 500 }
    );
  }
}
