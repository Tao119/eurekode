import { NextRequest } from "next/server";
import type { MessageParam, ContentBlockParam, ImageBlockParam, DocumentBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { createAnthropicClient, classifyApiError } from "@/lib/anthropic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { systemPrompts, brainstormSubModePrompts, LEVEL_PROMPT_MODIFIERS, QUIZ_DIFFICULTY_PROMPTS } from "@/lib/prompts";
import { DEVELOPMENT_LEVELS, type DevelopmentLevel } from "@/types/user";
import type { BrainstormSubMode, ClaudeModel } from "@/types/chat";
import { getModelId, DEFAULT_MODEL } from "@/types/chat";
import { estimateTokens } from "@/lib/token-limit";
import { compactConversationIfNeeded } from "@/lib/conversation-compactor";
import type { ConversationMetadata } from "@/types/chat";
import {
  canStartConversation,
  consumePoints,
  isModelAccessible,
  getAvailableModels,
} from "@/lib/point-service";
import type { AIModel } from "@/config/plans";
import { buildProjectContext } from "@/lib/rag-service";
import { embedConversationMessages } from "@/lib/embedding-service";
import { rateLimiters, rateLimitErrorResponse } from "@/lib/rate-limit";
import { withSystemCacheControl, addCacheBreakpoints } from "@/lib/prompt-cache";

// Map ClaudeModel to AIModel for point consumption
// haiku is treated as sonnet for billing purposes
function mapToAIModel(claudeModel: ClaudeModel): AIModel {
  return claudeModel === "opus" ? "opus" : "sonnet";
}

// Supported media types for Claude API
const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const DOCUMENT_MEDIA_TYPES = ["application/pdf"] as const;

type ImageMediaType = typeof IMAGE_MEDIA_TYPES[number];
type DocumentMediaType = typeof DOCUMENT_MEDIA_TYPES[number];

function isImageMediaType(type: string): type is ImageMediaType {
  return IMAGE_MEDIA_TYPES.includes(type as ImageMediaType);
}

function isDocumentMediaType(type: string): type is DocumentMediaType {
  return DOCUMENT_MEDIA_TYPES.includes(type as DocumentMediaType);
}

// Loose attachment type for Zod-parsed data (type is string, not FileMediaType)
interface LooseFileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data?: string;
  previewUrl?: string;
}

// Convert file attachments to Claude API content blocks
function attachmentsToContentBlocks(attachments: LooseFileAttachment[]): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];

  for (const attachment of attachments) {
    if (!attachment.data) continue;

    if (isImageMediaType(attachment.type)) {
      // Image content block
      const imageBlock: ImageBlockParam = {
        type: "image",
        source: {
          type: "base64",
          media_type: attachment.type as ImageMediaType,
          data: attachment.data,
        },
      };
      blocks.push(imageBlock);
    } else if (isDocumentMediaType(attachment.type)) {
      // Document (PDF) content block
      const documentBlock: DocumentBlockParam = {
        type: "document",
        source: {
          type: "base64",
          media_type: attachment.type as DocumentMediaType,
          data: attachment.data,
        },
      };
      blocks.push(documentBlock);
    } else {
      // Text-based files - decode and add as text
      try {
        const text = Buffer.from(attachment.data, "base64").toString("utf-8");
        const textBlock: TextBlockParam = {
          type: "text",
          text: `--- ${attachment.name} ---\n${text}\n--- End of ${attachment.name} ---`,
        };
        blocks.push(textBlock);
      } catch {
        // Skip files that can't be decoded as text
      }
    }
  }

  return blocks;
}

// Convert messages to Claude API format with attachments support
// Filters out assistant messages with empty content (can happen when user cancels)
function messagesToAnthropicFormat(messages: Array<{ role: "user" | "assistant"; content: string; attachments?: LooseFileAttachment[] }>): MessageParam[] {
  return messages
    // Filter out assistant messages with empty content (happens on cancel)
    .filter((msg) => msg.role === "user" || msg.content.trim().length > 0)
    .map((msg) => {
      // If message has attachments and is from user, create multimodal content
      if (msg.role === "user" && msg.attachments && msg.attachments.length > 0) {
        const contentBlocks: ContentBlockParam[] = [];

        // Add file attachments first
        const attachmentBlocks = attachmentsToContentBlocks(msg.attachments);
        contentBlocks.push(...attachmentBlocks);

        // Add text content if present
        if (msg.content.trim()) {
          contentBlocks.push({
            type: "text",
            text: msg.content,
          });
        }

        return {
          role: msg.role,
          content: contentBlocks,
        };
      }

      // Simple text message
      return {
        role: msg.role,
        content: msg.content,
      };
    });
}

// Allowed file types for attachments
const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/markdown",
] as const;

const fileAttachmentSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(255),
  type: z.string().refine((t) => ALLOWED_FILE_TYPES.includes(t as typeof ALLOWED_FILE_TYPES[number]), {
    message: "Unsupported file type",
  }),
  size: z.number().max(10_000_000), // 10MB max
  data: z.string().max(20_000_000).optional(), // Base64 encoded, ~15MB
  previewUrl: z.string().max(500).optional(),
});

const chatRequestSchema = z.object({
  mode: z.enum(["explanation", "generation", "brainstorm"]),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(100000), // 100KB max per message
      attachments: z.array(fileAttachmentSchema).max(5).optional(), // Max 5 attachments
    })
  ).max(100), // Max 100 messages in context
  conversationId: z.string().max(100).optional(),
  // 壁打ちモードのサブモード（casual/planning）
  brainstormSubMode: z.enum(["casual", "planning"]).optional(),
  // 生成モード: 現在アクティブなアーティファクトの情報
  activeArtifact: z.object({
    id: z.string().max(100),
    title: z.string().max(200),
    language: z.string().max(50).optional(),
  }).optional(),
  // Claude モデル選択
  model: z.enum(["opus", "sonnet", "haiku"]).optional(),
  // プロジェクトID（RAGコンテキスト注入用）
  projectId: z.string().max(100).optional(),
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

    // Rate limiting
    const rateLimitResult = await rateLimiters.chat(session.user.id);
    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult);
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

    const { mode, messages, conversationId, brainstormSubMode, activeArtifact, model, projectId } = parsed.data;
    const selectedModel: ClaudeModel = model || DEFAULT_MODEL;
    const userId = session.user.id;

    // ユーザー設定を取得（スキップモードの判定用 + 組織ID + モード制限）
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        settings: true,
        userType: true,
        organizationId: true,
        accessKey: {
          select: {
            settings: true,
            organization: {
              select: {
                settings: true,
              },
            },
          },
        },
      },
    });

    // スキップモードと開発レベルを判定
    let isSkipMode = false;
    let developmentLevel: DevelopmentLevel = "intermediate"; // デフォルトは中級
    if (user) {
      const userSettings = user.settings as { unlockSkipAllowed?: boolean; allowedModes?: string[]; developmentLevel?: DevelopmentLevel } | null;
      isSkipMode = userSettings?.unlockSkipAllowed ?? false;
      developmentLevel = userSettings?.developmentLevel ?? "intermediate";

      // メンバーユーザーはAPIキーの設定を優先
      if (user.userType === "member" && user.accessKey?.settings) {
        const accessKeySettings = user.accessKey.settings as { unlockSkipAllowed?: boolean };
        if (accessKeySettings.unlockSkipAllowed !== undefined) {
          isSkipMode = accessKeySettings.unlockSkipAllowed;
        }
      }

      // メンバーユーザーの利用可能モードを検証
      if (user.userType === "member") {
        // 優先順位: ユーザー設定 > アクセスキー設定 > 組織設定
        let effectiveAllowedModes: string[] = ["explanation", "generation", "brainstorm"];

        // 組織設定をチェック（最低優先）
        if (user.accessKey?.organization?.settings) {
          const orgSettings = user.accessKey.organization.settings as { allowedModes?: string[] };
          if (orgSettings.allowedModes && orgSettings.allowedModes.length > 0) {
            effectiveAllowedModes = orgSettings.allowedModes;
          }
        }

        // アクセスキーの設定をチェック（中優先）
        if (user.accessKey?.settings) {
          const akSettings = user.accessKey.settings as { allowedModes?: string[] };
          if (akSettings.allowedModes && akSettings.allowedModes.length > 0) {
            effectiveAllowedModes = akSettings.allowedModes;
          }
        }

        // ユーザー個別設定が最優先
        if (userSettings?.allowedModes && userSettings.allowedModes.length > 0) {
          effectiveAllowedModes = userSettings.allowedModes;
        }

        if (!effectiveAllowedModes.includes(mode)) {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "MODE_NOT_ALLOWED",
                message: "このモードは利用できません",
              },
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // サブモードに応じたシステムプロンプトを選択
    const getSystemPrompt = async (): Promise<string> => {
      if (mode === "brainstorm" && brainstormSubMode) {
        return brainstormSubModePrompts[brainstormSubMode];
      }
      let basePrompt = systemPrompts[mode];

      // 生成モードで現在のアーティファクト情報がある場合、コンテキストを追加
      if (mode === "generation" && activeArtifact) {
        basePrompt += `

【現在のアーティファクト情報】
- ID: "${activeArtifact.id}"
- タイトル: "${activeArtifact.title}"
${activeArtifact.language ? `- 言語: ${activeArtifact.language}` : ""}

**重要**: ユーザーが明示的に「新しいスクリプト」「別のファイル」と言わない限り、
上記のアーティファクトID "${activeArtifact.id}" を使用してコードを更新してください。`;
      }

      // 生成モードでスキップモードの場合、クイズを出さない指示を追加
      if (mode === "generation" && isSkipMode) {
        basePrompt += `

【最重要: 制限解除モード - 上記の「ステップ3」は完全に無視すること】

このユーザーは「制限解除モード」が有効です。

**絶対に守ること:**
1. 上記プロンプトの「ステップ3: 理解度クイズ」は完全にスキップする
2. <!--QUIZ:...-->形式のタグは絶対に出力しない
3. 「クイズ」「理解度確認」「問題を出します」などの言葉を一切使わない
4. コードを生成したら、そのまま使用方法と注意点を説明する

**対話フロー（制限解除モード）:**
- ステップ1: 環境確認（通常通り）
- ステップ2: コード生成（Artifact形式で出力）
- ステップ3: **スキップ** - クイズは出さない
- 代わりに: コードの使い方、注意点、カスタマイズ方法を説明

このユーザーへの応答では、理解度テストや確認クイズは一切行わないでください。`;
      }

      // プロジェクトに紐づいている場合、RAGコンテキストを注入
      if (projectId) {
        const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
        try {
          const ragContext = await buildProjectContext(projectId, lastUserMessage, conversationId);
          if (ragContext) {
            basePrompt += ragContext;
          }
        } catch (error) {
          console.error("Failed to build RAG context:", error);
        }
      }

      // 開発レベルに応じたプロンプト補足を追加
      basePrompt += LEVEL_PROMPT_MODIFIERS[developmentLevel];

      // 生成モードでクイズが有効な場合、クイズ難易度のプロンプトも追加
      if (mode === "generation" && !isSkipMode) {
        const levelConfig = DEVELOPMENT_LEVELS[developmentLevel];
        basePrompt += QUIZ_DIFFICULTY_PROMPTS[levelConfig.quizDifficulty];
      }

      return basePrompt;
    };

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "CONFIG_ERROR", message: "AI service is not configured" },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // === Point-based billing check ===
    const aiModel = mapToAIModel(selectedModel);
    const organizationId = user?.organizationId ?? null;

    // Check model access permission
    const modelAccess = await isModelAccessible(userId, aiModel);
    if (!modelAccess.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "MODEL_NOT_AVAILABLE",
            message: modelAccess.reasonJa || "このモデルはご利用いただけません",
            availableModels: await getAvailableModels(userId),
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check point balance
    const pointCheck = await canStartConversation(userId, aiModel, organizationId);
    if (!pointCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INSUFFICIENT_POINTS",
            message: pointCheck.reasonJa || "ポイントが不足しています",
          },
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create or get conversation
    let currentConversationId = conversationId;
    let existingConvMetadata: ConversationMetadata | null = null;

    if (conversationId) {
      // Load metadata and update generation status
      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
        select: { metadata: true },
      });
      existingConvMetadata = (conv?.metadata as ConversationMetadata | null) ?? null;

      await prisma.conversation.update({
        where: { id: conversationId, userId },
        data: {
          generationStatus: "generating",
          pendingContent: "",
          generationError: null,
        },
      });
    } else {
      // Create new conversation immediately for first message
      const newConv = await prisma.conversation.create({
        data: {
          userId,
          mode,
          projectId: projectId || null,
          isOrganized: !!projectId,
          title: null, // Will be generated by AI later
          messages: [],
          generationStatus: "generating",
        },
      });
      currentConversationId = newConv.id;
    }

    // Initialize Anthropic client (maxRetries: 3, exponential backoff for 429/5xx)
    const anthropic = createAnthropicClient();

    // Build system prompt (may include async RAG context)
    const systemPrompt = await getSystemPrompt();

    // Compact conversation if needed (summarize old messages to reduce token usage)
    let compactResult: Awaited<ReturnType<typeof compactConversationIfNeeded>> | null = null;
    let messagesForApi;
    try {
      compactResult = await compactConversationIfNeeded(
        messages,
        mode,
        systemPrompt,
        existingConvMetadata,
        anthropic,
      );
      messagesForApi = compactResult.messagesForApi;
    } catch {
      // Compacting failed — fall back to full message history
      messagesForApi = messagesToAnthropicFormat(messages);
    }

    // Create streaming response
    const encoder = new TextEncoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.stream({
            model: getModelId(selectedModel),
            max_tokens: 4096,
            system: withSystemCacheControl(systemPrompt),
            messages: addCacheBreakpoints(messagesForApi),
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

            // Merge compact summary into metadata in the same atomic update
            const metadataUpdate = compactResult?.wasCompacted && compactResult.newSummary
              ? {
                  ...((existingConvMetadata as unknown as Record<string, unknown>) || {}),
                  compactSummary: { ...compactResult.newSummary },
                }
              : undefined;

            await prisma.conversation.update({
              where: { id: currentConversationId },
              data: {
                generationStatus: "completed",
                pendingContent: null,
                messages: updatedMessages,
                tokensConsumed: { increment: estimatedTokens },
                ...(metadataUpdate && { metadata: metadataUpdate }),
              },
            });

            // 非同期でembedding生成（プロジェクト紐付き会話のみ対象）
            embedConversationMessages(currentConversationId).catch((err) => {
              console.error("[Chat API] Embedding generation failed:", err);
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

          // === Consume points for this conversation (token-based) ===
          const pointConsumption = await consumePoints(
            userId,
            aiModel,
            currentConversationId || undefined,
            organizationId,
            estimatedTokens // Pass actual token usage for gradual consumption
          );

          // Send conversation ID, tokens used, and point info in the done message
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            conversationId: currentConversationId,
            tokensUsed: estimatedTokens,
            pointsUsed: pointConsumption.consumed,
            remainingPoints: pointConsumption.remainingBalance,
            lowBalanceWarning: pointConsumption.lowBalanceWarning,
          })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const classified = classifyApiError(error);

          // Update generation status to failed
          if (currentConversationId) {
            await prisma.conversation.update({
              where: { id: currentConversationId },
              data: {
                generationStatus: "failed",
                generationError: classified.message,
              },
            }).catch(console.error);
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: classified.message,
                errorCode: classified.code,
                retryable: classified.retryable,
              })}\n\n`
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
