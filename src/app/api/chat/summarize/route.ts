import { NextRequest, NextResponse } from "next/server";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { auth } from "@/lib/auth";
import { createAnthropicClient } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { ConversationMetadata, ConversationSummary } from "@/types/chat";
import { rateLimiters, rateLimitErrorResponse } from "@/lib/rate-limit";

// 要約生成用のシステムプロンプト
const SUMMARIZE_SYSTEM_PROMPT = `あなたは優秀な要約者です。ユーザーとAIの壁打ち（ブレインストーミング）の会話を分析し、重要なポイントを抽出して要約してください。

## 出力フォーマット

### 要約の構成
1. **アイデアの概要**: 議論されたアイデアやプロジェクトの簡潔な説明（2-3文）
2. **主要なポイント**: 会話で出た重要な洞察や決定事項（箇条書き、3-5項目）
3. **次のステップ**: 議論された今後のアクションや課題（箇条書き、2-3項目）
4. **キーワード**: 会話に登場した重要な用語やコンセプト（カンマ区切り）

## ルール
- 会話の流れを尊重しつつ、冗長な部分は省く
- 具体的な数値や固有名詞があれば保持する
- ユーザーの意図や目標を正確に捉える
- 日本語で出力する
- Markdown形式で出力する（見出しは##を使用）`;

// 企画書モード用の詳細要約プロンプト
const PLANNING_SUMMARIZE_PROMPT = `あなたは優秀な企画書作成者です。ブレインストーミングの会話を分析し、企画書形式で要約してください。

## 出力フォーマット

### 企画書の構成
1. **プロジェクト概要**: アイデアの一言説明
2. **解決する課題**: ターゲットユーザーが抱える問題
3. **ターゲットユーザー**: 誰のためのサービス・プロダクトか
4. **ソリューション**: 課題をどう解決するか
5. **差別化ポイント**: 競合との違い、独自の価値
6. **技術スタック**: 使用予定の技術やプラットフォーム
7. **MVP機能**: 最小限必要な機能リスト
8. **実装タスク**: 開発ステップ（優先度順）
9. **リスクと対策**: 想定される課題と対応策
10. **成功指標**: プロジェクトの成功をどう測定するか

## ルール
- 会話で明確に議論されていない項目は「未定義」と記載
- 具体的な情報があれば詳細に記載
- 日本語で出力する
- Markdown形式で出力する（見出しは##を使用）`;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const summarizeRequestSchema = z.object({
  conversationId: z.string().optional(),
  messages: z.array(messageSchema).min(1).max(100),
  brainstormState: z.object({
    subMode: z.enum(["casual", "planning"]),
    ideaSummary: z.string().nullable().optional(),
    persona: z.string().nullable().optional(),
    planSteps: z.array(z.object({
      id: z.string(),
      title: z.string(),
      completed: z.boolean(),
      order: z.number(),
      description: z.string().optional(),
      estimatedTime: z.string().optional(),
    })).optional(),
  }).optional(),
  saveSummary: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimiters.chat(session.user.id);
    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult);
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = summarizeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request format" } },
        { status: 400 }
      );
    }

    const { conversationId, messages, brainstormState, saveSummary } = parsed.data;

    // Check if AWS credentials are configured (profile or env vars)
    if (!process.env.AWS_PROFILE && !process.env.AWS_ACCESS_KEY_ID) {
      return NextResponse.json(
        { success: false, error: { code: "CONFIG_ERROR", message: "AI service is not configured" } },
        { status: 500 }
      );
    }

    // Initialize Anthropic client (maxRetries: 3)
    const anthropic = createAnthropicClient();

    // Select system prompt based on subMode
    const systemPrompt = brainstormState?.subMode === "planning"
      ? PLANNING_SUMMARIZE_PROMPT
      : SUMMARIZE_SYSTEM_PROMPT;

    // Build conversation context
    const conversationText = messages
      .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`)
      .join("\n\n");

    // Add brainstorm state context if available
    let contextAddition = "";
    if (brainstormState) {
      if (brainstormState.ideaSummary) {
        contextAddition += `\n\n【アイデアサマリー】: ${brainstormState.ideaSummary}`;
      }
      if (brainstormState.persona) {
        contextAddition += `\n【ターゲット】: ${brainstormState.persona}`;
      }
      if (brainstormState.planSteps && brainstormState.planSteps.length > 0) {
        contextAddition += `\n【計画ステップ】:\n${brainstormState.planSteps
          .map((s, i) => `${i + 1}. ${s.title}${s.completed ? " ✓" : ""}`)
          .join("\n")}`;
      }
    }

    const userMessage = `以下の壁打ち会話を要約してください：\n\n${conversationText}${contextAddition}`;

    // Generate summary using Claude (non-streaming for simplicity)
    const response = await anthropic.messages.create({
      model: "us.anthropic.claude-sonnet-4-6", // Use Sonnet for cost efficiency
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text content
    const summary = response.content
      .filter((block): block is TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    // Save summary to conversation metadata if conversationId is provided
    let savedSummary: ConversationSummary | null = null;
    if (conversationId && saveSummary) {
      try {
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            userId: session.user.id,
          },
          select: { metadata: true },
        });

        if (conversation) {
          const metadata = (conversation.metadata as unknown as ConversationMetadata) || {};
          const existingSummaries = metadata.summaries || [];

          savedSummary = {
            id: crypto.randomUUID(),
            content: summary,
            createdAt: new Date().toISOString(),
            subMode: brainstormState?.subMode,
          };

          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              metadata: {
                ...metadata,
                summaries: [...existingSummaries, savedSummary],
              } as any,
            },
          });
        }
      } catch (saveError) {
        console.error("Failed to save summary:", saveError);
        // Continue without saving - not a critical error
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        summaryId: savedSummary?.id || null,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("Summarize API error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// GET /api/chat/summarize?conversationId=xxx - Get past summaries for a conversation
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "conversationId is required" } },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
      select: { metadata: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    const metadata = (conversation.metadata as unknown as ConversationMetadata) || {};
    const summaries = metadata.summaries || [];

    return NextResponse.json({
      success: true,
      data: {
        summaries: summaries.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      },
    });
  } catch (error) {
    console.error("Get summaries error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
