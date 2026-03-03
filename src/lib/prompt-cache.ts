/**
 * Anthropic Prompt Caching utilities
 *
 * システムプロンプトと会話履歴のキャッシュ制御を提供する。
 * キャッシュにより同一コンテンツの再処理を避け、入力トークンコストを最大90%削減できる。
 * TTLはデフォルト5分（ephemeral）。
 */

import type {
  MessageParam,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages";

const CACHE_CONTROL_EPHEMERAL = { type: "ephemeral" as const };

/**
 * システムプロンプトを cache_control 付きコンテンツブロック配列に変換する。
 * Sonnet/Opus: 1024トークン以上、Haiku: 2048トークン以上でキャッシュが有効になる。
 */
export function withSystemCacheControl(
  systemPrompt: string
): TextBlockParam[] {
  return [
    {
      type: "text",
      text: systemPrompt,
      cache_control: CACHE_CONTROL_EPHEMERAL,
    },
  ];
}

/**
 * 会話メッセージにキャッシュブレークポイントを追加する。
 * 最後から2番目のメッセージにブレークポイントを設定し、
 * システムプロンプト + 過去の会話履歴をキャッシュ可能にする。
 *
 * これにより後続のターンでは新しいユーザーメッセージ分のみが
 * 入力トークンとして課金される。
 */
export function addCacheBreakpoints(
  messages: MessageParam[]
): MessageParam[] {
  if (messages.length < 2) return messages;

  const targetIndex = messages.length - 2;

  return messages.map((msg, index) => {
    if (index !== targetIndex) return msg;

    const content = msg.content;

    if (typeof content === "string") {
      return {
        ...msg,
        content: [
          {
            type: "text" as const,
            text: content,
            cache_control: CACHE_CONTROL_EPHEMERAL,
          },
        ],
      };
    }

    if (Array.isArray(content) && content.length > 0) {
      const lastIndex = content.length - 1;
      const blocks = content.map((block, i) =>
        i === lastIndex
          ? { ...block, cache_control: CACHE_CONTROL_EPHEMERAL }
          : block
      );
      return { ...msg, content: blocks };
    }

    return msg;
  });
}
