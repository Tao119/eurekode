import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ChatMode } from "@/generated/prisma/client";

// GET: プロジェクト内の会話一覧
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
    const mode = searchParams.get("mode") as ChatMode | null;
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
      ...(mode && { mode }),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          mode: true,
          title: true,
          tokensConsumed: true,
          generationStatus: true,
          isOrganized: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              learnings: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    // 会話をフォーマット
    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      mode: conv.mode,
      title: conv.title,
      tokensConsumed: conv.tokensConsumed,
      generationStatus: conv.generationStatus,
      isOrganized: conv.isOrganized,
      learningsCount: conv._count.learnings,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: formattedConversations,
        total,
        hasMore: offset + limit < total,
        projectId,
        projectTitle: project.title,
      },
    });
  } catch (error) {
    console.error("Get project conversations error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "会話一覧の取得に失敗しました" } },
      { status: 500 }
    );
  }
}
