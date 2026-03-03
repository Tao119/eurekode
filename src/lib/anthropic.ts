/**
 * Anthropic Client Factory & Error Classification
 *
 * - maxRetries: 3 でSDKの自動リトライ（429, 5xx にexponential backoff）
 * - classifyApiError: リトライ耗尽時にユーザーフレンドリーなエラーを返す
 */

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MAX_RETRIES = 3;

/**
 * 標準設定のAnthropicクライアントを作成する。
 * SDKが429/5xxエラーをexponential backoffで自動リトライする。
 */
export function createAnthropicClient(apiKey?: string): Anthropic {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return new Anthropic({
    apiKey: key,
    maxRetries: DEFAULT_MAX_RETRIES,
  });
}

interface ClassifiedError {
  message: string;
  code: string;
  retryable: boolean;
}

/**
 * Anthropic APIエラーを分類し、ユーザー向けメッセージを返す。
 * SDKの自動リトライが全て失敗した後に呼ばれる想定。
 */
export function classifyApiError(error: unknown): ClassifiedError {
  if (error instanceof Anthropic.RateLimitError) {
    return {
      message:
        "サーバーが混雑しています。しばらくしてからもう一度お試しください。",
      code: "RATE_LIMITED",
      retryable: true,
    };
  }

  if (error instanceof Anthropic.AuthenticationError) {
    return {
      message:
        "AIサービスの認証に失敗しました。管理者にお問い合わせください。",
      code: "AUTH_ERROR",
      retryable: false,
    };
  }

  if (error instanceof Anthropic.APIError && error.status === 529) {
    return {
      message: "AIサービスが一時的に過負荷状態です。少々お待ちください。",
      code: "OVERLOADED",
      retryable: true,
    };
  }

  if (error instanceof Anthropic.APIError) {
    return {
      message: "AIサービスでエラーが発生しました。",
      code: "API_ERROR",
      retryable: error.status >= 500,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown error",
    code: "UNKNOWN_ERROR",
    retryable: false,
  };
}
