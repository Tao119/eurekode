import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/types/user";

const updateSettingsSchema = z.object({
  quizEnabled: z.boolean().optional(),
  explanationDetail: z.enum(["simple", "standard", "detailed"]).optional(),
  unlockMethod: z.enum(["quiz", "explanation", "skip"]).optional(),
  hintSpeed: z.enum(["immediate", "30sec", "none"]).optional(),
  estimationTraining: z.boolean().optional(),
  unlockSkipAllowed: z.boolean().optional(),
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
      select: { settings: true },
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
    const settings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      ...(user.settings as Partial<UserSettings> | null),
    };

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        tokenUsage: tokenUsage?.tokensUsed || 0,
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
