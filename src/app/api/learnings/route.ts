import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Learning } from "@/generated/prisma/client";
import { rateLimiters, rateLimitErrorResponse } from "@/lib/rate-limit";

const validLearningTypes = ["insight", "reflection"] as const;

function parseIntSafe(value: string | null, defaultValue: number): number {
  const parsed = parseInt(value || String(defaultValue), 10);
  return Number.isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
}

const createLearningSchema = z.object({
  content: z.string().min(1, "内容を入力してください").max(10000, "内容が長すぎます"),
  sourceMessage: z.string().max(50000).optional(),
  memo: z.string().max(5000).optional(),
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

    const response = NextResponse.json({
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

    // Cache-Control: private（ユーザー固有のデータ）、60秒キャッシュ、stale-while-revalidate
    response.headers.set(
      "Cache-Control",
      "private, max-age=60, stale-while-revalidate=300"
    );

    return response;
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

    // Rate limiting
    const rateLimitResult = await rateLimiters.learning(session.user.id);
    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult);
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

    const { content, sourceMessage, memo, tags, type, conversationId, projectId } = parsed.data;

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

    const learning = await prisma.learning.create({
      data: {
        userId,
        content,
        sourceMessage: sourceMessage ?? null,
        memo: memo ?? null,
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

    return NextResponse.json({
      success: true,
      data: {
        ...learning,
        createdAt: learning.createdAt.toISOString(),
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
