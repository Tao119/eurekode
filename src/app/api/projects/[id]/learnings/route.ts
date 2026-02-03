import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { LearningType } from "@/generated/prisma/client";

const validLearningTypes = ["insight", "reflection"] as const;

// GET: プロジェクト内の学び一覧
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const validatedType = validLearningTypes.includes(typeParam as typeof validLearningTypes[number])
      ? (typeParam as LearningType)
      : undefined;
    const tags = searchParams.get("tags");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // プロジェクトの所有権を確認
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
        { status: 404 }
      );
    }

    const where = {
      projectId,
      userId: session.user.id,
      ...(validatedType && { type: validatedType }),
      ...(tags && {
        tags: { hasSome: tags.split(",") },
      }),
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
        },
      }),
      prisma.learning.count({ where }),
    ]);

    // 学びをフォーマット
    const formattedLearnings = learnings.map((learning) => ({
      id: learning.id,
      content: learning.content,
      tags: learning.tags,
      type: learning.type,
      conversationId: learning.conversationId,
      conversation: learning.conversation,
      createdAt: learning.createdAt.toISOString(),
    }));

    // タグの集計
    const allTags = await prisma.learning.findMany({
      where: {
        projectId,
        userId: session.user.id,
      },
      select: {
        tags: true,
      },
    });

    const tagCounts = allTags
      .flatMap((l) => l.tags)
      .reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return NextResponse.json({
      success: true,
      data: {
        items: formattedLearnings,
        total,
        hasMore: offset + limit < total,
        projectId,
        projectTitle: project.title,
        topTags,
        stats: {
          total,
          insights: learnings.filter((l) => l.type === "insight").length,
          reflections: learnings.filter((l) => l.type === "reflection").length,
        },
      },
    });
  } catch (error) {
    console.error("Get project learnings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "学び一覧の取得に失敗しました" } },
      { status: 500 }
    );
  }
}
