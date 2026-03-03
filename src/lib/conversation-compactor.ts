import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { createAnthropicClient as createClient, type AnthropicClient } from "@/lib/anthropic";
import type { ChatMode } from "@/generated/prisma/client";
import type { ConversationCompactSummary, ConversationMetadata } from "@/types/chat";
import { estimateTokens } from "@/lib/token-limit";

// --- Configuration ---

const COMPACTING_CONFIG = {
  /** Token threshold for message content to trigger compacting */
  TOKEN_THRESHOLD: 40_000,
  /** Number of recent messages to preserve as-is */
  RECENT_MESSAGES_TO_KEEP: 6,
  /** Minimum messages before compacting is considered */
  MIN_MESSAGES_FOR_COMPACT: 10,
  /** Claude model for summarization (Haiku for speed and cost) */
  SUMMARY_MODEL: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  /** Max tokens for the summary response */
  SUMMARY_MAX_TOKENS: 512,
} as const;

// --- Types ---

interface CompactableMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{ id: string; name: string; type: string; size: number; data?: string; previewUrl?: string }>;
}

interface CompactResult {
  /** Messages formatted for the Claude API call */
  messagesForApi: MessageParam[];
  /** New summary to persist (only set when a new summary was generated) */
  newSummary?: ConversationCompactSummary;
  /** Whether compacting was applied */
  wasCompacted: boolean;
}

type CompactDecision = "no_compact" | "reuse_existing" | "regenerate";

// --- Public API ---

/**
 * Check if compacting is needed and return appropriately formatted messages.
 *
 * Three outcomes:
 * - no_compact: messages are below threshold, return as-is
 * - reuse_existing: existing summary is fresh enough, use it without calling Haiku
 * - regenerate: generate a new summary via Haiku, then build compacted messages
 */
export async function compactConversationIfNeeded(
  messages: CompactableMessage[],
  mode: ChatMode,
  systemPrompt: string,
  existingMetadata?: ConversationMetadata | null,
  /** Pass the caller's Anthropic client to avoid creating a new instance */
  anthropicClient?: AnthropicClient,
): Promise<CompactResult> {
  const existingSummary = existingMetadata?.compactSummary;
  const decision = getCompactDecision(messages, systemPrompt, existingSummary);

  if (decision === "no_compact") {
    return {
      messagesForApi: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      wasCompacted: false,
    };
  }

  // Determine split point ensuring recent messages start with "user" role
  const keepCount = computeKeepCount(messages);
  const splitIndex = messages.length - keepCount;
  const recentMessages = messages.slice(splitIndex);

  if (decision === "reuse_existing" && existingSummary) {
    // Existing summary is still fresh — reuse without calling Haiku
    const messagesForApi = buildCompactedMessages(
      existingSummary.content,
      recentMessages,
    );
    return { messagesForApi, wasCompacted: true };
  }

  // decision === "regenerate": Generate a new summary via Haiku
  const messagesToSummarize = messages.slice(0, splitIndex);
  const summaryContent = await generateSummary(
    messagesToSummarize,
    mode,
    existingSummary?.content,
    anthropicClient,
  );

  const newSummary: ConversationCompactSummary = {
    content: summaryContent,
    generatedAt: new Date().toISOString(),
    lastSummarizedMessageIndex: splitIndex - 1,
    summarizedMessageCount: splitIndex, // Cumulative count from the full message array
    summaryTokens: estimateTokens(summaryContent),
  };

  const messagesForApi = buildCompactedMessages(summaryContent, recentMessages);

  return { messagesForApi, newSummary, wasCompacted: true };
}

// --- Internal functions ---

/**
 * Determine whether compacting is needed and which strategy to use.
 */
function getCompactDecision(
  messages: Array<{ content: string }>,
  systemPrompt: string,
  existingSummary?: ConversationCompactSummary,
): CompactDecision {
  if (messages.length < COMPACTING_CONFIG.MIN_MESSAGES_FOR_COMPACT) {
    return "no_compact";
  }

  // Estimate tokens for messages only (system prompt excluded from threshold)
  const messageTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  );

  if (messageTokens < COMPACTING_CONFIG.TOKEN_THRESHOLD) {
    return "no_compact";
  }

  // Threshold exceeded — check if existing summary is still fresh enough
  if (existingSummary) {
    const messagesSinceSummary =
      messages.length - (existingSummary.lastSummarizedMessageIndex + 1);
    // If fewer new messages than 2x our keep window, reuse the existing summary
    if (messagesSinceSummary <= COMPACTING_CONFIG.RECENT_MESSAGES_TO_KEEP * 2) {
      return "reuse_existing";
    }
  }

  return "regenerate";
}

/**
 * Compute how many recent messages to keep, ensuring the kept slice starts
 * with a "user" message so the injected [summary user, summary assistant]
 * prefix maintains valid alternating roles for the Claude API.
 */
function computeKeepCount(messages: CompactableMessage[]): number {
  let keepCount = Math.min(
    COMPACTING_CONFIG.RECENT_MESSAGES_TO_KEEP,
    messages.length - 1,
  );

  // Ensure the first kept message is "user" (Claude API requires alternating roles)
  const startIndex = messages.length - keepCount;
  if (startIndex >= 0 && startIndex < messages.length && messages[startIndex].role === "assistant") {
    // Include one more message so we start on a "user" message
    keepCount = Math.min(keepCount + 1, messages.length - 1);
  }

  return keepCount;
}

/**
 * Build the compacted message array for the Claude API.
 * Injects [summary user, summary assistant] prefix then appends recent messages.
 */
function buildCompactedMessages(
  summary: string,
  recentMessages: CompactableMessage[],
): MessageParam[] {
  return [
    {
      role: "user" as const,
      content: `[これまでの会話の要約]\n\n${summary}\n\n[要約ここまで]\n\n上記の要約はこれまでの会話の内容です。この文脈を踏まえて会話を続けてください。`,
    },
    {
      role: "assistant" as const,
      content:
        "これまでの会話の内容を把握しました。上記の文脈を踏まえて、引き続きお手伝いします。",
    },
    ...recentMessages.map((msg): MessageParam => ({
      role: msg.role,
      content: msg.content,
    })),
  ];
}

/**
 * Generate a summary of the given messages using Claude Haiku.
 * Throws on failure so the caller can fall back to full messages.
 */
async function generateSummary(
  messages: CompactableMessage[],
  mode: ChatMode,
  previousSummary?: string,
  existingClient?: AnthropicClient,
): Promise<string> {
  const anthropic = existingClient ?? createAnthropicClientFallback();
  const prompt = buildSummarizationPrompt(messages, mode, previousSummary);

  const response = await anthropic.messages.create({
    model: COMPACTING_CONFIG.SUMMARY_MODEL,
    max_tokens: COMPACTING_CONFIG.SUMMARY_MAX_TOKENS,
    system:
      "あなたは会話要約の専門家です。与えられた会話履歴を正確かつ簡潔に要約してください。技術的な用語やコード名はそのまま保持してください。",
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new Error("Summary generation returned no text content");
  }
  return textBlock.text;
}

function createAnthropicClientFallback(): AnthropicClient {
  return createClient();
}

function buildSummarizationPrompt(
  messages: CompactableMessage[],
  mode: ChatMode,
  previousSummary?: string,
): string {
  const modeInstructions: Record<ChatMode, string> = {
    explanation: `- 解説モード: 現在の学習トピック、ユーザーの理解度、出題されたクイズの結果を含める`,
    generation: `- 生成モード: 生成されたコード/アーティファクトの概要、使用言語・フレームワーク、クイズの進捗を含める`,
    brainstorm: `- 壁打ちモード: 現在のフェーズ、これまでに決定した情報（アイデア概要、ターゲット、技術スタック等）を含める`,
  };

  const previousSummarySection = previousSummary
    ? `\n\n【既存の要約（これまでの会話の前半部分）】\n${previousSummary}\n\n上記の既存要約を踏まえ、以下の新しいメッセージも統合した要約を作成してください。`
    : "";

  const conversationText = messages
    .map((msg) => {
      const attachmentNote =
        msg.attachments && msg.attachments.length > 0
          ? ` [添付: ${msg.attachments.map((a) => `${a.name}(${a.type})`).join(", ")}]`
          : "";
      return `${msg.role === "user" ? "ユーザー" : "AI"}:${attachmentNote} ${msg.content}`;
    })
    .join("\n\n");

  return `以下の会話履歴を簡潔に要約してください。

【要約に含める内容】
1. 会話の主要トピックと流れ
2. ユーザーの質問とAIの回答の要点
3. 未解決の質問や進行中のタスク
4. ユーザーの理解度や学習進捗
${modeInstructions[mode]}
${previousSummarySection}

【出力ルール】
- 日本語で要約
- 500文字以内
- 箇条書きを活用
- 技術用語・コード名はそのまま保持
- 添付ファイルがあった場合はその内容にも言及

【会話履歴】
${conversationText}`;
}
