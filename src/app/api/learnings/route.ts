import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Learning } from "@/generated/prisma/client";

const validLearningTypes = ["insight", "reflection"] as const;

function parseIntSafe(value: string | null, defaultValue: number): number {
  const parsed = parseInt(value || String(defaultValue), 10);
  return Number.isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
}

const createLearningSchema = z.object({
  content: z.string().min(1, "内容を入力してください").max(10000, "内容が長すぎます"),
  tags: z.array(z.string().min(1).max(50)).max(10, "タグは10個までです"),
  type: z.enum(["insight", "reflection"]),
  conversationId: z.string().optional(),
  projectId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseIntSafe(searchParams.get("limit"), 20), 100);
    const offset = parseIntSafe(searchParams.get("offset"), 0);
    const typeParam = searchParams.get("type");
    const validatedType = validLearningTypes.includes(typeParam as typeof validLearningTypes[number])
      ? (typeParam as "insight" | "reflection")
      : undefined;
    const search = searchParams.get("search");
    const tags = searchParams.get("tags");
    const projectId = searchParams.get("projectId");

    const where = {
      userId: session.user.id,
      ...(validatedType && { type: validatedType }),
      ...(search && {
        content: { contains: search, mode: "insensitive" as const },
      }),
      ...(tags && {
        tags: { hasSome: tags.split(",") },
      }),
      ...(projectId && { projectId }),
    };

    const [learnings, total] = await Promise.all([
      prisma.learning.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          conversation: {
            select: {
              id: true,
              title: true,
              mode: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
              projectType: true,
            },
          },
        },
      }),
      prisma.learning.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: learnings.map((learning: Learning) => ({
          ...learning,
          createdAt: learning.createdAt.toISOString(),
        })),
        total,
        hasMore: offset + learnings.length < total,
      },
    });
  } catch (error) {
    console.error("Get learnings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }
    const parsed = createLearningSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "Invalid request format",
          },
        },
        { status: 400 }
      );
    }

    const { content, tags, type, conversationId, projectId } = parsed.data;

    // Verify conversation ownership if provided
    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: session.user.id },
      });

      if (!conversation) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "会話が見つかりません" } },
          { status: 404 }
        );
      }
    }

    // Verify project ownership if provided
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: session.user.id },
      });

      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
          { status: 404 }
        );
      }
    }

    const userId = session.user.id;

    // Estimate token usage (1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(content.length / 4);

    const learning = await prisma.learning.create({
      data: {
        userId,
        content,
        tags,
        type,
        ...(conversationId && { conversationId }),
        ...(projectId && { projectId }),
      },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            mode: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            projectType: true,
          },
        },
      },
    });

    // Update daily token usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.tokenUsage.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      create: {
        userId,
        date: today,
        tokensUsed: estimatedTokens,
        breakdown: { learning: estimatedTokens },
      },
      update: {
        tokensUsed: { increment: estimatedTokens },
      },
    });

    // Update the breakdown separately to handle JSON update
    const existingUsage = await prisma.tokenUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    if (existingUsage) {
      const breakdown = (existingUsage.breakdown as Record<string, number>) || {};
      breakdown.learning = (breakdown.learning || 0) + estimatedTokens;
      await prisma.tokenUsage.update({
        where: { userId_date: { userId, date: today } },
        data: { breakdown },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...learning,
        createdAt: learning.createdAt.toISOString(),
        tokensUsed: estimatedTokens,
      },
    });
  } catch (error) {
    console.error("Create learning error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
