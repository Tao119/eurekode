import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { DEFAULT_ORGANIZATION_SETTINGS, type OrganizationSettings } from "@/types/user";

// GET /api/admin/settings - Get organization settings
export async function GET() {
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

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        plan: true,
        settings: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "組織が見つかりません" } },
        { status: 404 }
      );
    }

    // Merge with defaults
    const settings: OrganizationSettings = {
      ...DEFAULT_ORGANIZATION_SETTINGS,
      ...(organization.settings as Partial<OrganizationSettings> | null),
    };

    return NextResponse.json({
      success: true,
      data: {
        organizationId: organization.id,
        organizationName: organization.name,
        plan: organization.plan,
        settings,
      },
    });
  } catch (error) {
    console.error("Get admin settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/settings - Update organization settings
const updateSettingsSchema = z.object({
  organizationName: z.string().min(1).max(100).optional(),
  settings: z.object({
    allowedModes: z.array(z.enum(["explanation", "generation", "brainstorm"])).optional(),
    allowedTechStacks: z.array(z.string()).optional(),
    unlockSkipAllowed: z.boolean().optional(),
    reflectionRequired: z.boolean().optional(),
    defaultDailyTokenLimit: z.number().int().min(100).max(100000).optional(),
  }).optional(),
});

export async function PATCH(request: NextRequest) {
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
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request format", details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { organizationName, settings } = parsed.data;

    // Get current settings
    const currentOrg = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });

    // Merge settings
    const currentSettings = {
      ...DEFAULT_ORGANIZATION_SETTINGS,
      ...(currentOrg?.settings as Partial<OrganizationSettings> | null),
    };
    const newSettings = settings
      ? { ...currentSettings, ...settings }
      : currentSettings;

    const organization = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        ...(organizationName && { name: organizationName }),
        ...(settings && { settings: newSettings as unknown as Prisma.InputJsonValue }),
      },
      select: {
        id: true,
        name: true,
        plan: true,
        settings: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        organizationId: organization.id,
        organizationName: organization.name,
        plan: organization.plan,
        settings: {
          ...DEFAULT_ORGANIZATION_SETTINGS,
          ...(organization.settings as Partial<OrganizationSettings> | null),
        },
      },
    });
  } catch (error) {
    console.error("Update admin settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
