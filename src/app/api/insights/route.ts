import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const insightSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(500),
  tags: z.array(z.string()).max(10),
  conversationId: z.string().uuid().optional(),
});

// Create insight
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = insightSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { title, content, tags, conversationId } = parsed.data;

    // Combine title and content for storage
    const fullContent = `## ${title}\n\n${content}`;

    const insight = await prisma.learning.create({
      data: {
        userId: session.user.id,
        content: fullContent,
        tags,
        type: "insight",
        conversationId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: insight.id,
        title,
        content,
        tags: insight.tags,
        createdAt: insight.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Insight creation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "気づきの保存に失敗しました" } },
      { status: 500 }
    );
  }
}

// Get user's insights
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const tag = searchParams.get("tag");

    const where = {
      userId: session.user.id,
      type: "insight" as const,
      ...(tag && { tags: { has: tag } }),
    };

    const [insights, total] = await Promise.all([
      prisma.learning.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          content: true,
          tags: true,
          createdAt: true,
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

    // Parse title from content
    const formattedInsights = insights.map((insight) => {
      const lines = insight.content.split("\n");
      const titleMatch = lines[0]?.match(/^##\s*(.+)$/);
      const title = titleMatch ? titleMatch[1] : "無題";
      const content = lines.slice(2).join("\n").trim();

      return {
        id: insight.id,
        title,
        content,
        tags: insight.tags,
        createdAt: insight.createdAt.toISOString(),
        conversation: insight.conversation,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        insights: formattedInsights,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get insights error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "気づきの取得に失敗しました" } },
      { status: 500 }
    );
  }
}
