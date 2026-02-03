import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// User settings type
interface UserSettings {
  skipAllowed?: boolean;
  isEnabled?: boolean;
  allowedModes?: ("explanation" | "generation" | "brainstorm")[];
  [key: string]: unknown;
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

    const memberSettings = (member.settings as UserSettings) || {};

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
          skipAllowed: memberSettings.skipAllowed ?? false,
          isEnabled: memberSettings.isEnabled !== false, // default to true
          allowedModes: memberSettings.allowedModes ?? ["explanation", "generation", "brainstorm"],
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

// PATCH /api/admin/members/:id - Update member settings
const updateMemberSchema = z.object({
  skipAllowed: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  allowedModes: z.array(z.enum(["explanation", "generation", "brainstorm"])).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
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
    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "入力が無効です", details: parsed.error.issues } },
        { status: 400 }
      );
    }

    // Verify member belongs to organization
    const member = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        userType: "member",
      },
      select: { id: true, settings: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
        { status: 404 }
      );
    }

    // Merge settings
    const currentSettings = (member.settings as UserSettings) || {};
    const newSettings: UserSettings = {
      ...currentSettings,
      ...(parsed.data.skipAllowed !== undefined && { skipAllowed: parsed.data.skipAllowed }),
      ...(parsed.data.isEnabled !== undefined && { isEnabled: parsed.data.isEnabled }),
      ...(parsed.data.allowedModes !== undefined && { allowedModes: parsed.data.allowedModes }),
    };

    // Update member settings
    const updated = await prisma.user.update({
      where: { id },
      data: { settings: newSettings as unknown as Prisma.InputJsonValue },
      select: { id: true, settings: true },
    });

    const updatedSettings = (updated.settings as UserSettings) || {};

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        skipAllowed: updatedSettings.skipAllowed ?? false,
        isEnabled: updatedSettings.isEnabled !== false,
        allowedModes: updatedSettings.allowedModes ?? ["explanation", "generation", "brainstorm"],
      },
    });
  } catch (error) {
    console.error("Update admin member error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/members/:id - Delete member
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    // Verify member belongs to organization
    const member = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        userType: "member",
      },
      include: {
        accessKey: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
        { status: 404 }
      );
    }

    // Delete member and related data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete artifacts
      await tx.artifact.deleteMany({
        where: { userId: id },
      });

      // Delete conversations
      await tx.conversation.deleteMany({
        where: { userId: id },
      });

      // Delete learnings
      await tx.learning.deleteMany({
        where: { userId: id },
      });

      // Delete token usage
      await tx.tokenUsage.deleteMany({
        where: { userId: id },
      });

      // Revoke access key if exists (don't delete, keep for audit)
      if (member.accessKey) {
        await tx.accessKey.update({
          where: { id: member.accessKey.id },
          data: {
            userId: null,
            status: "revoked",
          },
        });
      }

      // Delete the user
      await tx.user.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      data: { message: "メンバーを削除しました" },
    });
  } catch (error) {
    console.error("Delete admin member error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
