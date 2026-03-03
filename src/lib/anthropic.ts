/**
 * Anthropic Bedrock Client Factory & Error Classification
 *
 * Amazon Bedrock経由でClaude APIを呼び出す。
 * - maxRetries: 3 でSDKの自動リトライ（429, 5xx にexponential backoff）
 * - classifyApiError: リトライ耗尽時にユーザーフレンドリーなエラーを返す
 */

import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import Anthropic from "@anthropic-ai/sdk";

/** Bedrock経由のAnthropicクライアント型 */
export type AnthropicClient = AnthropicBedrock;

const DEFAULT_MAX_RETRIES = 3;

/**
 * Amazon Bedrock経由のAnthropicクライアントを作成する。
 * SDKが429/5xxエラーをexponential backoffで自動リトライする。
 *
 * Vercel等のサーバーレス環境ではAWS credential chainが使えないため、
 * 環境変数から明示的にクレデンシャルを渡す。
 * ローカル開発ではAWS_PROFILE経由のcredential chainにフォールバック。
 */
export function createAnthropicClient(): AnthropicBedrock {
  const accessKey = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const region = (process.env.AWS_REGION || "us-east-1").trim();

  if (accessKey && secretKey) {
    return new AnthropicBedrock({
      awsAccessKey: accessKey,
      awsSecretKey: secretKey,
      awsRegion: region,
      maxRetries: DEFAULT_MAX_RETRIES,
    });
  }

  return new AnthropicBedrock({
    awsRegion: region,
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

  // AWS ThrottlingException (Bedrock固有)
  if (
    error instanceof Error &&
    error.message.includes("ThrottlingException")
  ) {
    return {
      message:
        "サーバーが混雑しています。しばらくしてからもう一度お試しください。",
      code: "RATE_LIMITED",
      retryable: true,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown error",
    code: "UNKNOWN_ERROR",
    retryable: false,
  };
}
