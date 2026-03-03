import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAnthropicClient } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import type { Message } from "@/types/chat";

type RouteContext = { params: Promise<{ id: string }> };

// タイトルの類似度を計算（簡易版）
function isSimilarTitle(existingTitle: string | null, newTitle: string): boolean {
  if (!existingTitle) return false;

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[。、！？\s]/g, "").trim();

  const existing = normalize(existingTitle);
  const generated = normalize(newTitle);

  // 完全一致
  if (existing === generated) return true;

  // 既存タイトルが新タイトルに含まれる、またはその逆
  if (existing.includes(generated) || generated.includes(existing)) return true;

  // 共通部分が70%以上なら類似とみなす
  const minLen = Math.min(existing.length, generated.length);
  const maxLen = Math.max(existing.length, generated.length);
  if (minLen === 0) return false;

  let commonChars = 0;
  for (const char of existing) {
    if (generated.includes(char)) commonChars++;
  }

  const similarity = commonChars / maxLen;
  return similarity > 0.7;
}

// POST /api/conversations/:id/generate-title
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // 会話を取得
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        title: true,
        messages: true,
        mode: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "会話が見つかりません" } },
        { status: 404 }
      );
    }

    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "この会話にアクセスする権限がありません" } },
        { status: 403 }
      );
    }

    const messages = conversation.messages as unknown as Message[];

    // メッセージが少なすぎる場合はスキップ
    if (messages.length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          title: conversation.title,
          updated: false,
          reason: "メッセージが少なすぎます",
        },
      });
    }

    // 会話の内容を要約用に抽出（最大10メッセージ）
    const recentMessages = messages.slice(0, 10);
    const conversationSummary = recentMessages
      .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content.slice(0, 200)}`)
      .join("\n");

    // Anthropic クライアント (maxRetries: 3)
    const anthropic = createAnthropicClient();

    // AIでタイトルを生成（Haiku を使用してコスト削減）
    const completion = await anthropic.messages.create({
      model: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      max_tokens: 50,
      system: `あなたは会話のタイトルを生成するアシスタントです。
以下の会話の内容を分析し、簡潔で分かりやすいタイトルを生成してください。

ルール:
- 15文字以内で簡潔に
- 会話の主要なトピックや目的を反映
- 日本語で生成
- 句読点は不要
- 「について」「に関する」などの冗長な表現を避ける
- タイトルのみを出力（説明不要）

例:
- Reactでのログイン実装
- 配列ソートの最適化
- TypeScript型定義の質問`,
      messages: [
        {
          role: "user",
          content: `以下の会話のタイトルを生成してください:\n\n${conversationSummary}`,
        },
      ],
    });

    // レスポンスからテキストを抽出
    const textBlock = completion.content.find((block) => block.type === "text");
    const generatedTitle = textBlock && "text" in textBlock ? textBlock.text.trim() : "";

    if (!generatedTitle) {
      return NextResponse.json({
        success: true,
        data: {
          title: conversation.title,
          updated: false,
          reason: "タイトル生成に失敗しました",
        },
      });
    }

    // 既存タイトルと比較
    if (isSimilarTitle(conversation.title, generatedTitle)) {
      return NextResponse.json({
        success: true,
        data: {
          title: conversation.title,
          generatedTitle,
          updated: false,
          reason: "既存タイトルと類似しています",
        },
      });
    }

    // タイトルを更新
    const updated = await prisma.conversation.update({
      where: { id },
      data: { title: generatedTitle },
      select: { id: true, title: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        title: updated.title,
        previousTitle: conversation.title,
        updated: true,
      },
    });
  } catch (error) {
    console.error("Generate title error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "タイトル生成に失敗しました" } },
      { status: 500 }
    );
  }
}
