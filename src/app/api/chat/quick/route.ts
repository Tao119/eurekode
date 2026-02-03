import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { systemPrompts } from "@/lib/prompts";
import { detectChatMode, detectChatModeWithDetails } from "@/lib/mode-detector";
import type { ChatMode } from "@/types/chat";

const quickChatRequestSchema = z.object({
  content: z.string().min(1).max(10000),
  // 明示的にモードを指定する場合（オプション）
  mode: z.enum(["explanation", "generation", "brainstorm"]).optional(),
  // 既存会話を継続する場合
  conversationId: z.string().optional(),
  // プロジェクトに紐づける場合
  projectId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "UNAUTHORIZED", message: "認証が必要です" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = quickChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request format" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { content, mode: explicitMode, conversationId, projectId } = parsed.data;
    const userId = session.user.id;

    // Check if API key is configured
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "CONFIG_ERROR", message: "AI service is not configured" },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Detect mode automatically or use explicit mode
    const modeDetection = detectChatModeWithDetails(content);
    const mode: ChatMode = explicitMode || modeDetection.mode;

    // Prepare messages
    let messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    let currentConversationId = conversationId;

    if (conversationId) {
      // Load existing conversation
      const existingConv = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
      });

      if (!existingConv) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: "NOT_FOUND", message: "会話が見つかりません" },
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Restore messages from existing conversation
      const existingMessages = existingConv.messages as Array<{
        role: "user" | "assistant";
        content: string;
      }> | null;
      messages = existingMessages || [];

      // Update generation status
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          generationStatus: "generating",
          pendingContent: "",
          generationError: null,
        },
      });
    } else {
      // Create new conversation
      const newConv = await prisma.conversation.create({
        data: {
          userId,
          mode,
          projectId: projectId || null,
          isOrganized: !!projectId, // PJ紐づけがあれば整理済み
          title: null, // 後でAIが生成
          messages: [],
          generationStatus: "generating",
        },
      });
      currentConversationId = newConv.id;
    }

    // Add user message
    messages.push({ role: "user", content });

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send mode detection info first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "mode_detected",
                mode,
                confidence: modeDetection.confidence,
                conversationId: currentConversationId,
              })}\n\n`
            )
          );

          const response = await anthropic.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompts[mode],
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          });

          let chunkCount = 0;

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullContent += event.delta.text;
              chunkCount++;

              const data = JSON.stringify({ content: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));

              // Save pending content every 10 chunks (for recovery)
              if (currentConversationId && chunkCount % 10 === 0) {
                prisma.conversation
                  .update({
                    where: { id: currentConversationId },
                    data: { pendingContent: fullContent },
                  })
                  .catch(console.error);
              }
            }
          }

          // Calculate token usage (rough estimate: 1 token ≈ 4 characters)
          const estimatedTokens = Math.ceil(
            (messages.reduce((sum, m) => sum + m.content.length, 0) +
              fullContent.length) /
              4
          );

          // Generate title for new conversations
          let generatedTitle: string | null = null;
          if (!conversationId && fullContent) {
            // 最初のユーザーメッセージから簡易タイトルを生成
            generatedTitle = generateTitle(content);
          }

          // Update conversation with final content
          if (currentConversationId) {
            const updatedMessages = [
              ...messages,
              {
                role: "assistant" as const,
                content: fullContent,
                timestamp: new Date().toISOString(),
              },
            ];

            await prisma.conversation.update({
              where: { id: currentConversationId },
              data: {
                generationStatus: "completed",
                pendingContent: null,
                messages: updatedMessages,
                tokensConsumed: { increment: estimatedTokens },
                ...(generatedTitle && { title: generatedTitle }),
              },
            });
          }

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
              breakdown: { [mode]: estimatedTokens },
            },
            update: {
              tokensUsed: { increment: estimatedTokens },
            },
          });

          // Update the breakdown separately
          const existingUsage = await prisma.tokenUsage.findUnique({
            where: { userId_date: { userId, date: today } },
          });
          if (existingUsage) {
            const breakdown =
              (existingUsage.breakdown as Record<string, number>) || {};
            breakdown[mode] = (breakdown[mode] || 0) + estimatedTokens;
            await prisma.tokenUsage.update({
              where: { userId_date: { userId, date: today } },
              data: { breakdown },
            });
          }

          // Send done message with conversation info
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                conversationId: currentConversationId,
                mode,
                title: generatedTitle,
                isOrganized: !!projectId,
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          // Update generation status to failed
          if (currentConversationId) {
            await prisma.conversation
              .update({
                where: { id: currentConversationId },
                data: {
                  generationStatus: "failed",
                  generationError: errorMessage,
                },
              })
              .catch(console.error);
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Quick chat API error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * ユーザーメッセージから簡易タイトルを生成
 */
function generateTitle(content: string): string {
  // 最初の行または最初の50文字を取得
  const firstLine = content.split("\n")[0];
  let title = firstLine.slice(0, 50);

  // 長すぎる場合は省略
  if (firstLine.length > 50) {
    title = title.slice(0, 47) + "...";
  }

  // コードブロックの開始を除去
  title = title.replace(/^```\w*\s*/, "").trim();

  // 空の場合はデフォルト
  if (!title) {
    return "新しい会話";
  }

  return title;
}
