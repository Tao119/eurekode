import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import crypto from "crypto";
import { getOrganizationPlan } from "@/config/plans";

// Generate access key in format: XXXXX-XXXXX-XXXXX-XXXXX
function generateKeyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars (0, O, 1, I)
  const segments: string[] = [];

  for (let s = 0; s < 4; s++) {
    let segment = "";
    for (let i = 0; i < 5; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      segment += chars[randomIndex];
    }
    segments.push(segment);
  }

  return segments.join("-");
}

// GET /api/admin/keys - Get all access keys in organization
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
    const status = searchParams.get("status"); // active, used, expired, revoked
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get organization info for plan limits
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { plan: true },
    });

    const orgPlanConfig = organization
      ? getOrganizationPlan(organization.plan)
      : null;

    // Build where clause
    const whereClause: Prisma.AccessKeyWhereInput = {
      organizationId: session.user.organizationId,
      ...(status && { status: status as "active" | "used" | "expired" | "revoked" }),
      ...(search && {
        OR: [
          { keyCode: { contains: search, mode: "insensitive" as const } },
          { user: { displayName: { contains: search, mode: "insensitive" as const } } },
          { user: { email: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
    };

    // Get access keys with user info (including email)
    const keys = await prisma.accessKey.findMany({
      where: whereClause,
      select: {
        id: true,
        keyCode: true,
        status: true,
        dailyTokenLimit: true,
        settings: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Transform data
    const transformedKeys = keys.map((key) => ({
      id: key.id,
      keyCode: key.keyCode,
      status: key.status,
      dailyTokenLimit: key.dailyTokenLimit,
      settings: key.settings,
      expiresAt: key.expiresAt?.toISOString() || null,
      usedAt: key.usedAt?.toISOString() || null,
      createdAt: key.createdAt.toISOString(),
      user: key.user
        ? {
            id: key.user.id,
            displayName: key.user.displayName,
            email: key.user.email,
          }
        : null,
    }));

    // Get total count
    const totalCount = await prisma.accessKey.count({ where: whereClause });

    // Get status counts
    const statusCounts = await prisma.accessKey.groupBy({
      by: ["status"],
      where: { organizationId: session.user.organizationId },
      _count: { id: true },
    });

    const statusSummary = {
      active: 0,
      used: 0,
      expired: 0,
      revoked: 0,
    };
    for (const stat of statusCounts) {
      statusSummary[stat.status as keyof typeof statusSummary] = stat._count.id;
    }

    return NextResponse.json({
      success: true,
      data: {
        keys: transformedKeys,
        pagination: {
          total: totalCount,
          limit,
          offset,
        },
        summary: statusSummary,
        organizationPlan: orgPlanConfig
          ? {
              plan: orgPlanConfig.id,
              name: orgPlanConfig.nameJa,
              maxCreditsPerMember: orgPlanConfig.features.monthlyConversationPoints,
              maxMembers: orgPlanConfig.maxMembers,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get admin keys error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// POST /api/admin/keys - Create new access key(s)
const createKeySchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
  dailyTokenLimit: z.number().int().min(100).max(100000).default(1000),
  expiresIn: z.enum(["1week", "1month", "3months", "never"]).default("1month"),
  settings: z.object({
    allowedModes: z.array(z.enum(["explanation", "generation", "brainstorm"])).optional(),
    allowedTechStacks: z.array(z.string()).optional(),
    unlockSkipAllowed: z.boolean().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
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
    const parsed = createKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request format", details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { count, dailyTokenLimit, expiresIn, settings } = parsed.data;

    // Calculate expiration date
    let expiresAt: Date | null = null;
    const now = new Date();
    switch (expiresIn) {
      case "1week":
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case "1month":
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case "3months":
        expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case "never":
        expiresAt = null;
        break;
    }

    // Generate unique keys
    const keysToCreate: Prisma.AccessKeyCreateManyInput[] = [];
    const generatedKeyCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      let keyCode = generateKeyCode();
      // Ensure uniqueness (very unlikely collision but let's be safe)
      while (generatedKeyCodes.includes(keyCode)) {
        keyCode = generateKeyCode();
      }
      generatedKeyCodes.push(keyCode);

      keysToCreate.push({
        organizationId: session.user.organizationId,
        keyCode,
        dailyTokenLimit,
        expiresAt,
        status: "active",
        settings: settings as Prisma.InputJsonValue,
      });
    }

    // Create keys in batch
    await prisma.accessKey.createMany({
      data: keysToCreate,
    });

    // Fetch created keys for response
    const createdKeys = await prisma.accessKey.findMany({
      where: {
        keyCode: { in: generatedKeyCodes },
      },
      select: {
        id: true,
        keyCode: true,
        dailyTokenLimit: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        count: createdKeys.length,
        keys: createdKeys.map((k) => ({
          id: k.id,
          keyCode: k.keyCode,
          dailyTokenLimit: k.dailyTokenLimit,
          expiresAt: k.expiresAt?.toISOString() || null,
          createdAt: k.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Create admin keys error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
