/**
 * Credit Allocation API (Organization)
 *
 * 組織管理者：メンバーへのクレジット割り当て管理
 * 組織メンバー：割り当てリクエスト
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET: 割り当て一覧を取得（管理者：全メンバー、メンバー：自分の割り当て）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userType = session.user.userType;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "Not an organization member" },
        { status: 403 }
      );
    }

    const now = new Date();

    if (userType === "admin") {
      // 管理者：全メンバーの割り当て一覧
      const allocations = await prisma.creditAllocation.findMany({
        where: {
          organizationId: user.organizationId,
          periodStart: { lte: now },
          periodEnd: { gte: now },
        },
        orderBy: { createdAt: "desc" },
      });

      // メンバー情報を取得
      const members = await prisma.user.findMany({
        where: {
          organizationId: user.organizationId,
          userType: "member",
        },
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      });

      // 割り当て情報とメンバー情報をマージ
      const allocationMap = new Map(allocations.map((a) => [a.userId, a]));
      const memberAllocations = members.map((member) => ({
        member,
        allocation: allocationMap.get(member.id) || null,
      }));

      return NextResponse.json({
        allocations: memberAllocations,
        period: {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        },
      });
    } else {
      // メンバー：自分の割り当て
      const allocation = await prisma.creditAllocation.findFirst({
        where: {
          organizationId: user.organizationId,
          userId: userId,
          periodStart: { lte: now },
          periodEnd: { gte: now },
        },
      });

      return NextResponse.json({
        allocation,
        period: {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        },
      });
    }
  } catch (error) {
    console.error("Get allocations error:", error);
    return NextResponse.json(
      { error: "Failed to get allocations" },
      { status: 500 }
    );
  }
}

/**
 * POST: 割り当てを作成/更新（管理者のみ）
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userType = session.user.userType;
    if (userType !== "admin") {
      return NextResponse.json(
        { error: "Only admins can allocate credits" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { memberId, points, note } = body;

    if (!memberId || points === undefined) {
      return NextResponse.json(
        { error: "memberId and points are required" },
        { status: 400 }
      );
    }

    if (points < 0) {
      return NextResponse.json(
        { error: "Points must be non-negative" },
        { status: 400 }
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: { include: { creditBalance: true } } },
    });

    if (!admin?.organizationId) {
      return NextResponse.json(
        { error: "Not an organization admin" },
        { status: 403 }
      );
    }

    // 対象ユーザーが組織に所属しているか確認（メンバーまたは管理者自身）
    const targetUser = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: admin.organizationId,
        userType: { in: ["member", "admin"] },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found in organization" },
        { status: 404 }
      );
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 既存の割り当てを更新または新規作成
    const allocation = await prisma.creditAllocation.upsert({
      where: {
        organizationId_userId_periodStart: {
          organizationId: admin.organizationId,
          userId: memberId,
          periodStart,
        },
      },
      update: {
        allocatedPoints: points,
        note,
      },
      create: {
        organizationId: admin.organizationId,
        userId: memberId,
        allocatedPoints: points,
        usedPoints: 0,
        periodStart,
        periodEnd,
        note,
      },
    });

    return NextResponse.json({ allocation });
  } catch (error) {
    console.error("Create allocation error:", error);
    return NextResponse.json(
      { error: "Failed to create allocation" },
      { status: 500 }
    );
  }
}
