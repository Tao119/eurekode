import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { systemPrompts } from "@/lib/prompts";

const chatRequestSchema = z.object({
  mode: z.enum(["explanation", "generation", "brainstorm"]),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  conversationId: z.string().optional(),
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
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request format" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { mode, messages, conversationId } = parsed.data;
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

    // Create or get conversation
    let currentConversationId = conversationId;
    if (conversationId) {
      // Update generation status to generating
      await prisma.conversation.update({
        where: { id: conversationId, userId },
        data: {
          generationStatus: "generating",
          pendingContent: "",
          generationError: null,
        },
      });
    }

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
                prisma.conversation.update({
                  where: { id: currentConversationId },
                  data: { pendingContent: fullContent },
                }).catch(console.error);
              }
            }
          }

          // Calculate token usage (rough estimate: 1 token ≈ 4 characters)
          const estimatedTokens = Math.ceil(
            (messages.reduce((sum, m) => sum + m.content.length, 0) + fullContent.length) / 4
          );

          // Mark generation as completed and save final content
          if (currentConversationId) {
            const updatedMessages = [
              ...messages,
              { role: "assistant", content: fullContent, timestamp: new Date().toISOString() },
            ];

            await prisma.conversation.update({
              where: { id: currentConversationId },
              data: {
                generationStatus: "completed",
                pendingContent: null,
                messages: updatedMessages,
                tokensConsumed: { increment: estimatedTokens },
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
              breakdown: {
                // Update breakdown for this mode
                set: undefined, // Will be handled below
              },
            },
          });

          // Update the breakdown separately to handle JSON update
          const existingUsage = await prisma.tokenUsage.findUnique({
            where: { userId_date: { userId, date: today } },
          });
          if (existingUsage) {
            const breakdown = (existingUsage.breakdown as Record<string, number>) || {};
            breakdown[mode] = (breakdown[mode] || 0) + estimatedTokens;
            await prisma.tokenUsage.update({
              where: { userId_date: { userId, date: today } },
              data: { breakdown },
            });
          }

          // Send conversation ID in the done message
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: currentConversationId })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          // Update generation status to failed
          if (currentConversationId) {
            await prisma.conversation.update({
              where: { id: currentConversationId },
              data: {
                generationStatus: "failed",
                generationError: errorMessage,
              },
            }).catch(console.error);
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorMessage })}\n\n`
            )
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
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
