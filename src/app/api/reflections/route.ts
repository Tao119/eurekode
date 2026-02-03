import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const reflectionSchema = z.object({
  quickReflection: z.enum(["good", "okay", "difficult"]).optional(),
  detailedReflection: z.object({
    whatDid: z.string().max(1000),
    whatLearned: z.string().max(1000),
    whyHappened: z.string().max(1000),
    whatNext: z.string().max(1000),
  }).optional(),
  conversationId: z.string().uuid().optional(),
});

// Create reflection
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
    const parsed = reflectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { quickReflection, detailedReflection, conversationId } = parsed.data;

    // Build content from reflection data
    const contentParts: string[] = [];

    if (quickReflection) {
      const emojiMap = {
        good: "😊 よく理解できた",
        okay: "🤔 まあまあ",
        difficult: "😅 難しかった",
      };
      contentParts.push(`## 今日の振り返り: ${emojiMap[quickReflection]}`);
    }

    if (detailedReflection) {
      if (detailedReflection.whatDid) {
        contentParts.push(`### 何をした？\n${detailedReflection.whatDid}`);
      }
      if (detailedReflection.whatLearned) {
        contentParts.push(`### 何がわかった？\n${detailedReflection.whatLearned}`);
      }
      if (detailedReflection.whyHappened) {
        contentParts.push(`### なぜそうなった？\n${detailedReflection.whyHappened}`);
      }
      if (detailedReflection.whatNext) {
        contentParts.push(`### 次どうする？\n${detailedReflection.whatNext}`);
      }
    }

    const content = contentParts.join("\n\n");

    // Generate tags based on content
    const tags: string[] = [];
    if (quickReflection) {
      tags.push(quickReflection);
    }
    tags.push(new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric" }));

    const reflection = await prisma.learning.create({
      data: {
        userId: session.user.id,
        content,
        tags,
        type: "reflection",
        conversationId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: reflection.id,
        quickReflection,
        detailedReflection,
        createdAt: reflection.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Reflection creation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "振り返りの保存に失敗しました" } },
      { status: 500 }
    );
  }
}

// Get user's reflections
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where = {
      userId: session.user.id,
      type: "reflection" as const,
      ...(startDate && { createdAt: { gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { lte: new Date(endDate) } }),
    };

    const [reflections, total] = await Promise.all([
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

    // Parse reflection content
    const formattedReflections = reflections.map((reflection) => {
      const content = reflection.content;

      // Extract quick reflection
      const quickMatch = content.match(/## 今日の振り返り: [^\n]+ (good|okay|difficult)/);
      const quickReflection = quickMatch ? quickMatch[1] as "good" | "okay" | "difficult" : undefined;

      // Extract detailed sections
      const whatDidMatch = content.match(/### 何をした？\n([^#]+)/);
      const whatLearnedMatch = content.match(/### 何がわかった？\n([^#]+)/);
      const whyHappenedMatch = content.match(/### なぜそうなった？\n([^#]+)/);
      const whatNextMatch = content.match(/### 次どうする？\n([^#]+)/);

      const detailedReflection = {
        whatDid: whatDidMatch ? whatDidMatch[1].trim() : "",
        whatLearned: whatLearnedMatch ? whatLearnedMatch[1].trim() : "",
        whyHappened: whyHappenedMatch ? whyHappenedMatch[1].trim() : "",
        whatNext: whatNextMatch ? whatNextMatch[1].trim() : "",
      };

      return {
        id: reflection.id,
        quickReflection,
        detailedReflection,
        tags: reflection.tags,
        createdAt: reflection.createdAt.toISOString(),
        conversation: reflection.conversation,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        reflections: formattedReflections,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get reflections error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "振り返りの取得に失敗しました" } },
      { status: 500 }
    );
  }
}
