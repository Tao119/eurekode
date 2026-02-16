import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/types/user";
import type { ChatMode } from "@/types/chat";

const updateSettingsSchema = z.object({
  quizEnabled: z.boolean().optional(),
  explanationDetail: z.enum(["simple", "standard", "detailed"]).optional(),
  unlockMethod: z.enum(["quiz", "explanation", "skip"]).optional(),
  hintSpeed: z.enum(["immediate", "30sec", "none"]).optional(),
  estimationTraining: z.boolean().optional(),
  unlockSkipAllowed: z.boolean().optional(),
  developmentLevel: z.enum(["beginner", "elementary", "intermediate", "advanced", "expert"]).optional(),
});

// GET /api/user/settings - Get user settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        settings: true,
        userType: true,
        accessKey: {
          select: {
            settings: true,
            dailyTokenLimit: true,
            organization: {
              select: {
                name: true,
                settings: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    // Get today's token usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tokenUsage = await prisma.tokenUsage.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date: today,
        },
      },
    });

    // Merge with defaults to ensure all fields are present
    const userSettings = user.settings as Partial<UserSettings> & { skipAllowed?: boolean } | null;
    const settings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      ...(userSettings || {}),
    };

    // For member users, compute unlockSkipAllowed from organization/accessKey settings
    // Priority: organization settings -> access key settings -> user settings (same as allowedModes)
    if (user.userType === "member") {
      // Start with organization settings
      const orgSettings = user.accessKey?.organization?.settings as Record<string, unknown> | null;
      if (typeof orgSettings?.unlockSkipAllowed === "boolean") {
        settings.unlockSkipAllowed = orgSettings.unlockSkipAllowed;
      }

      // Override with access key settings
      const akSettings = user.accessKey?.settings as Record<string, unknown> | null;
      if (typeof akSettings?.unlockSkipAllowed === "boolean") {
        settings.unlockSkipAllowed = akSettings.unlockSkipAllowed;
      }

      // Legacy: check skipAllowed field in user settings (for backwards compatibility)
      if (userSettings?.skipAllowed !== undefined) {
        settings.unlockSkipAllowed = userSettings.skipAllowed;
      }
    }

    // Get dailyTokenLimit from AccessKey or use default
    const defaultLimit = Number(process.env.DEFAULT_DAILY_TOKEN_LIMIT) || 10000;
    const dailyTokenLimit = user.accessKey?.dailyTokenLimit || defaultLimit;

    // Get organization name for member users
    const organizationName = user.userType === "member" ? user.accessKey?.organization?.name : null;

    // Compute effective allowedModes for the user
    const allModes: ChatMode[] = ["explanation", "generation", "brainstorm"];
    const validModes = new Set<string>(allModes);
    const filterValidModes = (modes: unknown): ChatMode[] | null => {
      if (!Array.isArray(modes)) return null;
      const filtered = modes.filter((m): m is ChatMode => typeof m === "string" && validModes.has(m));
      return filtered.length > 0 ? filtered : null;
    };

    let allowedModes: ChatMode[] = allModes;

    if (user.userType === "member") {
      // Start with organization-level defaults
      const orgSettings = user.accessKey?.organization?.settings as Record<string, unknown> | null;
      const orgModes = filterValidModes(orgSettings?.allowedModes);
      if (orgModes) {
        allowedModes = orgModes;
      }

      // Override with access key-level settings
      const akSettings = user.accessKey?.settings as Record<string, unknown> | null;
      const akModes = filterValidModes(akSettings?.allowedModes);
      if (akModes) {
        allowedModes = akModes;
      }

      // Override with per-member settings (highest priority)
      const memberModes = filterValidModes((userSettings as Record<string, unknown> | null)?.allowedModes);
      if (memberModes) {
        allowedModes = memberModes;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        tokenUsage: tokenUsage?.tokensUsed || 0,
        dailyTokenLimit,
        organizationName,
        allowedModes,
      },
    });
  } catch (error) {
    console.error("Get user settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// PATCH /api/user/settings - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request format", details: parsed.error.issues } },
        { status: 400 }
      );
    }

    // Get current settings and user type
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { settings: true, userType: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    // unlockSkipAllowed can only be modified by individual users (not members)
    const updateData = { ...parsed.data };
    if (user.userType === "member" && updateData.unlockSkipAllowed !== undefined) {
      delete updateData.unlockSkipAllowed;
    }

    // Merge settings
    const currentSettings = (user.settings as Partial<UserSettings> | null) || {};
    const newSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      ...currentSettings,
      ...updateData,
    };

    // Update user settings (cast to Prisma JSON type via unknown)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { settings: newSettings as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      success: true,
      data: newSettings,
    });
  } catch (error) {
    console.error("Update user settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
