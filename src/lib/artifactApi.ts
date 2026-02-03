/**
 * Artifact API Client
 *
 * フロントエンドからArtifact APIを呼び出すためのユーティリティ関数
 */

import type { Artifact } from "@/types/chat";

// API response types
export interface ArtifactApiResponse {
  id: string;
  conversationId: string;
  type: "code" | "component" | "config";
  title: string;
  content: string;
  language: string | null;
  version: number;
  unlockLevel: number;
  totalQuestions: number;
  quizHistory: QuizHistoryItem[];
  currentQuiz: UnlockQuiz | null;
  isUnlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizHistoryItem {
  level: number;
  question: string;
  userAnswer: string;
  isCorrect: boolean;
}

export interface UnlockQuiz {
  level: number;
  question: string;
  options: { label: string; text: string }[];
  correctLabel: string;
  hint?: string;
}

export interface ArtifactProgress {
  unlockLevel: number;
  totalQuestions: number;
  currentQuiz: UnlockQuiz | null;
  quizHistory: QuizHistoryItem[];
  isUnlocked: boolean;
  progressPercentage: number;
}

export interface FetchArtifactsResponse {
  items: ArtifactApiResponse[];
  total: number;
  activeArtifactId: string | null;
}

// Error class for API errors
export class ArtifactApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ArtifactApiError";
  }
}

/**
 * Fetch all artifacts for a conversation
 */
export async function fetchArtifacts(conversationId: string): Promise<FetchArtifactsResponse> {
  const response = await fetch(`/api/conversations/${conversationId}/artifacts`);
  const data = await response.json();

  if (!data.success) {
    throw new ArtifactApiError(
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "アーティファクトの取得に失敗しました"
    );
  }

  return data.data;
}

/**
 * Create or update an artifact (upsert)
 */
export async function upsertArtifact(
  conversationId: string,
  artifact: {
    id: string;
    type?: "code" | "component" | "config";
    title: string;
    content: string;
    language?: string;
    totalQuestions?: number;
  }
): Promise<ArtifactApiResponse> {
  const response = await fetch(`/api/conversations/${conversationId}/artifacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(artifact),
  });

  const data = await response.json();

  if (!data.success) {
    throw new ArtifactApiError(
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "アーティファクトの保存に失敗しました",
      data.error?.details
    );
  }

  return data.data;
}

/**
 * Update artifact content
 */
export async function updateArtifact(
  conversationId: string,
  artifactId: string,
  updates: {
    title?: string;
    content?: string;
    language?: string;
    type?: "code" | "component" | "config";
  }
): Promise<ArtifactApiResponse> {
  const response = await fetch(`/api/conversations/${conversationId}/artifacts/${artifactId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!data.success) {
    throw new ArtifactApiError(
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "アーティファクトの更新に失敗しました",
      data.error?.details
    );
  }

  return data.data;
}

/**
 * Update artifact progress (unlock level, quiz state)
 */
export async function updateArtifactProgress(
  conversationId: string,
  artifactId: string,
  progress: {
    unlockLevel?: number;
    totalQuestions?: number;
    currentQuiz?: UnlockQuiz | null;
    quizHistoryItem?: QuizHistoryItem;
  }
): Promise<ArtifactProgress> {
  const response = await fetch(`/api/conversations/${conversationId}/artifacts/${artifactId}/progress`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(progress),
  });

  const data = await response.json();

  if (!data.success) {
    throw new ArtifactApiError(
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "進捗の更新に失敗しました",
      data.error?.details
    );
  }

  return data.data;
}

/**
 * Delete an artifact
 */
export async function deleteArtifact(
  conversationId: string,
  artifactId: string
): Promise<void> {
  const response = await fetch(`/api/conversations/${conversationId}/artifacts/${artifactId}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!data.success) {
    throw new ArtifactApiError(
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "アーティファクトの削除に失敗しました"
    );
  }
}

/**
 * Convert API response to local Artifact type
 */
export function apiResponseToArtifact(response: ArtifactApiResponse): Artifact {
  return {
    id: response.id,
    type: response.type,
    title: response.title,
    content: response.content,
    language: response.language || undefined,
    version: response.version,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

/**
 * Convert API response to ArtifactProgress for useGenerationMode
 */
export function apiResponseToProgress(response: ArtifactApiResponse): {
  unlockLevel: number;
  totalQuestions: number;
  currentQuiz: UnlockQuiz | null;
  quizHistory: QuizHistoryItem[];
} {
  return {
    unlockLevel: response.unlockLevel,
    totalQuestions: response.totalQuestions,
    currentQuiz: response.currentQuiz,
    quizHistory: response.quizHistory,
  };
}
