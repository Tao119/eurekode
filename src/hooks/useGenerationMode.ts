"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Artifact, UnlockQuizOption } from "@/types/chat";
import {
  upsertArtifact as apiUpsertArtifact,
  updateArtifactProgress as apiUpdateProgress,
  fetchArtifacts as apiFetchArtifacts,
  apiResponseToArtifact,
  apiResponseToProgress,
  // New Quiz API
  fetchQuizzes as apiFetchQuizzes,
  generateQuizzes as apiGenerateQuizzes,
  answerQuiz as apiAnswerQuiz,
  quizApiToUnlockQuiz,
  type QuizApiResponse,
} from "@/lib/artifactApi";
import { estimateQuizCount } from "@/lib/quiz-generator";

// 生成モードのフェーズ
export type GenerationPhase =
  | "initial"       // 初期状態（要求入力待ち）
  | "planning"      // 計画立案中
  | "coding"        // コード生成完了、クイズ待ち
  | "unlocking"     // アンロッククイズ進行中
  | "unlocked";     // 完全アンロック済み

// アンロックレベル（現在の正解数、0から始まる）
export type UnlockLevel = number;

// クイズの選択肢（types/chat.tsから再エクスポート）
export type QuizOption = UnlockQuizOption;

// クイズの質問タイプ
export interface UnlockQuiz {
  level: number;
  totalQuestions?: number;
  question: string;
  options: QuizOption[];
  correctLabel: string;
  hint?: string;
  detailedExplanation?: string;
  codeSnippet?: string;
  codeLanguage?: string;
}

// 生成されたコード情報
export interface GeneratedCode {
  language: string;
  code: string;
  filename?: string;
  explanation?: string;
}

// 計画情報
export interface Plan {
  steps: string[];
  estimatedTime?: number;
}

// クイズ履歴アイテム
export interface QuizHistoryItem {
  level: number;
  question: string;
  userAnswer: string;
  isCorrect: boolean;
  /** 回答時点でのメッセージ数（インライン表示位置の計算用） */
  answeredAtMessageCount?: number;
  /** 完了したクイズの全データ（再表示用） */
  completedQuiz?: UnlockQuiz;
}

// アーティファクトごとの進行状況
export interface ArtifactProgress {
  unlockLevel: UnlockLevel;
  totalQuestions: number;
  currentQuiz: UnlockQuiz | null;
  quizHistory: QuizHistoryItem[];
}

// 生成モードの状態
export interface GenerationModeState {
  phase: GenerationPhase;
  unlockLevel: UnlockLevel;
  totalQuestions: number;
  generatedCode: GeneratedCode | null;
  plan: Plan | null;
  quizHistory: QuizHistoryItem[];
  currentQuiz: UnlockQuiz | null;
  hintVisible: boolean;
  hintTimer: number | null;
  artifacts: Record<string, Artifact>;
  activeArtifactId: string | null;
  artifactProgress: Record<string, ArtifactProgress>;
}

// オプション設定
export interface GenerationOptions {
  unlockMethod: "quiz" | "explanation" | "skip";
  hintSpeed: "immediate" | "30sec" | "none";
}

const DEFAULT_OPTIONS: GenerationOptions = {
  unlockMethod: "quiz",
  hintSpeed: "30sec",
};

// 永続化する状態の型
export interface PersistedGenerationState {
  phase: GenerationPhase;
  unlockLevel: UnlockLevel;
  totalQuestions?: number;
  artifacts: Record<string, Artifact>;
  activeArtifactId: string | null;
  artifactProgress: Record<string, ArtifactProgress>;
  quizHistory: GenerationModeState["quizHistory"];
}

// 動的なぼかし強度を計算（totalQuestions=0 で即アンロック）
export function getBlurLevel(currentLevel: number, totalQuestions: number): string {
  if (totalQuestions === 0 || currentLevel >= totalQuestions) return "blur-none";
  const progress = currentLevel / totalQuestions;
  if (progress >= 0.66) return "blur-[4px]";
  if (progress >= 0.33) return "blur-[8px]";
  return "blur-[12px]";
}

// 動的なレベルラベルを取得
export function getLevelLabel(currentLevel: number, totalQuestions: number): { title: string; description: string } {
  if (totalQuestions === 0 || currentLevel >= totalQuestions) {
    return { title: "完了", description: "コピー可能" };
  }
  return {
    title: `質問 ${currentLevel + 1}/${totalQuestions}`,
    description: `残り${totalQuestions - currentLevel}問`,
  };
}

// 後方互換性のための固定ラベル（動的な質問数に対応）
export const LEVEL_LABELS: Record<number, { title: string; description: string }> = {
  1: { title: "質問 1", description: "なぜこの実装？" },
  2: { title: "質問 2", description: "なぜこの書き方？" },
  3: { title: "質問 3", description: "なぜこの構造？" },
  4: { title: "完了", description: "コピー可能" },
};

// API経由で生成モード状態を保存
async function saveGenerationStateToAPI(
  conversationId: string,
  state: GenerationModeState
): Promise<void> {
  try {
    const generationState: PersistedGenerationState = {
      phase: state.phase,
      unlockLevel: state.unlockLevel,
      totalQuestions: state.totalQuestions,
      artifacts: state.artifacts,
      activeArtifactId: state.activeArtifactId,
      artifactProgress: state.artifactProgress,
      quizHistory: state.quizHistory,
    };

    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: {
          generationState,
        },
      }),
    });
  } catch (e) {
    console.error("Failed to save generation state:", e);
  }
}

export interface UseGenerationModeOptions extends Partial<GenerationOptions> {
  conversationId?: string;
  initialState?: PersistedGenerationState;
  skipAllowed?: boolean; // true の場合 totalQuestions=0 で即アンロック
}

export function useGenerationMode(options: UseGenerationModeOptions = {}) {
  const { conversationId, initialState, skipAllowed = false, ...generationOptions } = options;
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>("");
  const initialStateAppliedRef = useRef(false);
  // 初期状態の読み込みが完了するまで保存をブロック
  // conversationId がある場合、初期状態が適用されるまで待機
  const canSaveRef = useRef(!conversationId);
  // skipAllowed をコールバック内で参照するためのref
  const skipAllowedRef = useRef(skipAllowed);
  skipAllowedRef.current = skipAllowed;

  // skipAllowed の場合: totalQuestions=0, unlockLevel=0 → 0 >= 0 で即アンロック
  // Default to 2 questions; actual count is determined dynamically when artifact is created
  const defaultTotalQuestions = skipAllowed ? 0 : 2;

  const [state, setState] = useState<GenerationModeState>(() => {
    const defaultState: GenerationModeState = {
      phase: "initial",
      unlockLevel: 0,
      totalQuestions: defaultTotalQuestions,
      generatedCode: null,
      plan: null,
      quizHistory: [],
      currentQuiz: null,
      hintVisible: false,
      hintTimer: null,
      artifacts: {},
      activeArtifactId: null,
      artifactProgress: {},
    };

    if (initialState) {
      initialStateAppliedRef.current = true;
      canSaveRef.current = true; // 初期状態が同期的に適用された場合は保存許可
      return {
        ...defaultState,
        phase: initialState.phase || "initial",
        unlockLevel: initialState.unlockLevel ?? 0,
        totalQuestions: skipAllowed ? 0 : (initialState.totalQuestions ?? 2),
        artifacts: initialState.artifacts || {},
        activeArtifactId: initialState.activeArtifactId || null,
        artifactProgress: initialState.artifactProgress || {},
        quizHistory: initialState.quizHistory || [],
        currentQuiz: null,
      };
    }

    return defaultState;
  });

  const [currentOptions, setCurrentOptions] = useState<GenerationOptions>({
    ...DEFAULT_OPTIONS,
    ...generationOptions,
  });

  // アンロック済みかどうか（totalQuestions=0 の場合は常に true）
  const isUnlocked = state.totalQuestions === 0 || state.unlockLevel >= state.totalQuestions;

  // 非同期で読み込まれた初期状態を適用
  useEffect(() => {
    if (!initialState || initialStateAppliedRef.current) return;

    initialStateAppliedRef.current = true;
    canSaveRef.current = true; // 初期状態が適用されたので保存を許可

    setState((prev) => ({
      ...prev,
      phase: initialState.phase || prev.phase,
      unlockLevel: initialState.unlockLevel ?? prev.unlockLevel,
      totalQuestions: skipAllowed ? 0 : (initialState.totalQuestions ?? prev.totalQuestions),
      artifacts: { ...prev.artifacts, ...initialState.artifacts },
      activeArtifactId: initialState.activeArtifactId || prev.activeArtifactId,
      // 重要: 初期状態の進行状況を優先（既存の状態にマージ）
      artifactProgress: { ...prev.artifactProgress, ...initialState.artifactProgress },
      quizHistory: initialState.quizHistory?.length ? initialState.quizHistory : prev.quizHistory,
    }));
  }, [initialState, skipAllowed]);

  // 初期状態が一定時間内に届かない場合は保存を許可（新規会話の場合）
  useEffect(() => {
    if (canSaveRef.current) return;

    const timeout = setTimeout(() => {
      if (!canSaveRef.current) {
        console.warn("[useGenerationMode] Initial state timeout - enabling save. This may indicate slow network or missing initial state.");
        canSaveRef.current = true;
      }
    }, 5000); // 5秒後に初期状態がなければ新規会話と判断

    return () => clearTimeout(timeout);
  }, []);

  // 状態が変更されたらAPIに保存（デバウンス付き）
  useEffect(() => {
    // 初期状態の読み込みが完了するまで保存をブロック
    if (!canSaveRef.current) return;
    if (!conversationId || state.phase === "initial") return;

    const stateHash = JSON.stringify({
      phase: state.phase,
      unlockLevel: state.unlockLevel,
      totalQuestions: state.totalQuestions,
      artifactProgress: state.artifactProgress,
      activeArtifactId: state.activeArtifactId,
    });

    if (stateHash === lastSavedStateRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      lastSavedStateRef.current = stateHash;
      saveGenerationStateToAPI(conversationId, state);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [conversationId, state]);

  const setPhase = useCallback((phase: GenerationPhase) => {
    setState((prev) => ({ ...prev, phase }));
  }, []);

  const setPlan = useCallback((plan: Plan) => {
    setState((prev) => ({ ...prev, plan, phase: "planning" }));
  }, []);

  const setUserEstimate = useCallback((estimate: number) => {
    setState((prev) => ({
      ...prev,
      plan: prev.plan ? { ...prev.plan, userEstimate: estimate } : null,
    }));
  }, []);

  const setGeneratedCode = useCallback((code: GeneratedCode) => {
    setState((prev) => ({
      ...prev,
      generatedCode: code,
      phase: "coding",
    }));
  }, []);

  // クイズを設定（totalQuestions=0 の場合は何もしない）
  const setCurrentQuiz = useCallback((quiz: UnlockQuiz) => {
    setState((prev) => {
      // totalQuestions=0 または既にアンロック済みの場合はクイズを設定しない
      if (prev.totalQuestions === 0 || prev.unlockLevel >= prev.totalQuestions) {
        return prev;
      }

      const activeId = prev.activeArtifactId;
      const currentProgress = activeId ? prev.artifactProgress[activeId] : null;

      if (currentProgress && currentProgress.unlockLevel >= currentProgress.totalQuestions) {
        return prev;
      }

      const updatedProgress: Record<string, ArtifactProgress> = activeId && currentProgress
        ? {
            ...prev.artifactProgress,
            [activeId]: {
              ...currentProgress,
              currentQuiz: quiz,
            },
          }
        : prev.artifactProgress;

      return {
        ...prev,
        currentQuiz: quiz,
        phase: "unlocking",
        hintVisible: currentOptions.hintSpeed === "immediate",
        artifactProgress: updatedProgress,
      };
    });

    if (currentOptions.hintSpeed === "30sec") {
      const timer = window.setTimeout(() => {
        setState((prev) => ({ ...prev, hintVisible: true }));
      }, 30000);
      setState((prev) => ({ ...prev, hintTimer: timer }));
    }
  }, [currentOptions.hintSpeed]);

  const answerQuiz = useCallback((answer: string, messageCount?: number): boolean => {
    if (!state.currentQuiz) return false;

    const isCorrect = answer === state.currentQuiz.correctLabel;
    const activeId = state.activeArtifactId;
    const currentProgress = activeId ? state.artifactProgress[activeId] : null;

    const newHistoryItem: QuizHistoryItem = {
      level: state.currentQuiz.level,
      question: state.currentQuiz.question,
      userAnswer: answer,
      isCorrect,
      answeredAtMessageCount: messageCount,
      completedQuiz: isCorrect ? { ...state.currentQuiz } : undefined,
    };

    // API同期（非ブロッキング）- 正解時のみ進捗を更新
    if (isCorrect && conversationId && activeId) {
      const nextLevel = state.unlockLevel + 1;
      apiUpdateProgress(conversationId, activeId, {
        unlockLevel: nextLevel,
        currentQuiz: null,
        quizHistoryItem: newHistoryItem,
      }).catch((e) => {
        console.error("[answerQuiz] API progress sync failed:", e);
      });
    }

    setState((prev) => {
      if (prev.hintTimer) {
        clearTimeout(prev.hintTimer);
      }

      const prevActiveId = prev.activeArtifactId;
      const prevProgress = prevActiveId ? prev.artifactProgress[prevActiveId] : null;

      const newHistory = [...prev.quizHistory, newHistoryItem];

      if (isCorrect) {
        const nextLevel = prev.unlockLevel + 1;
        const totalQ = prev.totalQuestions;
        const newIsUnlocked = nextLevel >= totalQ;

        const updatedProgress: Record<string, ArtifactProgress> = prevActiveId
          ? {
              ...prev.artifactProgress,
              [prevActiveId]: {
                unlockLevel: nextLevel,
                totalQuestions: prevProgress?.totalQuestions || totalQ,
                currentQuiz: null,
                quizHistory: prevProgress
                  ? [...prevProgress.quizHistory, newHistoryItem]
                  : [newHistoryItem],
              },
            }
          : prev.artifactProgress;

        return {
          ...prev,
          quizHistory: newHistory,
          unlockLevel: nextLevel,
          currentQuiz: null,
          phase: newIsUnlocked ? "unlocked" : "unlocking",
          hintVisible: false,
          hintTimer: null,
          artifactProgress: updatedProgress,
        };
      }

      return {
        ...prev,
        quizHistory: newHistory,
        hintVisible: true,
        hintTimer: null,
      };
    });

    return isCorrect;
  }, [state.currentQuiz, state.activeArtifactId, state.artifactProgress, state.unlockLevel, conversationId]);

  // スキップ（手動アンロック）
  const skipToUnlock = useCallback(() => {
    const activeId = state.activeArtifactId;
    const currentProgress = activeId ? state.artifactProgress[activeId] : null;

    // API同期（非ブロッキング）
    if (conversationId && activeId && currentProgress) {
      apiUpdateProgress(conversationId, activeId, {
        unlockLevel: currentProgress.totalQuestions,
        currentQuiz: null,
      }).catch((e) => {
        console.error("[skipToUnlock] API progress sync failed:", e);
      });
    }

    setState((prev) => {
      const prevActiveId = prev.activeArtifactId;
      const prevProgress = prevActiveId ? prev.artifactProgress[prevActiveId] : null;

      const updatedProgress: Record<string, ArtifactProgress> = prevActiveId && prevProgress
        ? {
            ...prev.artifactProgress,
            [prevActiveId]: {
              ...prevProgress,
              unlockLevel: prevProgress.totalQuestions,
              currentQuiz: null,
            },
          }
        : prev.artifactProgress;

      return {
        ...prev,
        unlockLevel: prev.totalQuestions,
        phase: "unlocked",
        currentQuiz: null,
        hintVisible: false,
        artifactProgress: updatedProgress,
      };
    });
  }, [conversationId, state.activeArtifactId, state.artifactProgress]);

  const reset = useCallback(() => {
    setState({
      phase: "initial",
      unlockLevel: 0,
      totalQuestions: defaultTotalQuestions,
      generatedCode: null,
      plan: null,
      quizHistory: [],
      currentQuiz: null,
      hintVisible: false,
      hintTimer: null,
      artifacts: {},
      activeArtifactId: null,
      artifactProgress: {},
    });
  }, [defaultTotalQuestions]);

  // クイズをAPIから読み込む（新クイズシステム）
  const loadQuizzesFromAPI = useCallback(async (artifactId: string): Promise<void> => {
    try {
      const response = await apiFetchQuizzes(artifactId);

      // 次の未回答クイズを取得
      const nextPendingQuiz = response.items.find((q) => q.status === "pending");

      // 回答済みクイズを履歴に変換
      const quizHistory: QuizHistoryItem[] = response.items
        .filter((q) => q.status === "answered")
        .map((q) => ({
          level: q.level,
          question: q.question,
          userAnswer: q.userAnswer || "",
          isCorrect: q.isCorrect || false,
          completedQuiz: q.isCorrect ? quizApiToUnlockQuiz(q) : undefined,
        }));

      setState((prev) => {
        const artifact = prev.artifacts[artifactId];
        if (!artifact) return prev;

        const newProgress: ArtifactProgress = {
          unlockLevel: response.currentLevel - 1, // currentLevelは1ベース、unlockLevelは0ベース
          totalQuestions: response.total,
          currentQuiz: nextPendingQuiz ? quizApiToUnlockQuiz(nextPendingQuiz) : null,
          quizHistory,
        };

        return {
          ...prev,
          unlockLevel: newProgress.unlockLevel,
          totalQuestions: response.total,
          currentQuiz: nextPendingQuiz ? quizApiToUnlockQuiz(nextPendingQuiz) : null,
          quizHistory,
          phase: response.isUnlocked ? "unlocked" : (nextPendingQuiz ? "unlocking" : "coding"),
          artifactProgress: {
            ...prev.artifactProgress,
            [artifactId]: newProgress,
          },
        };
      });
    } catch (error) {
      console.error("[loadQuizzesFromAPI] Failed to load quizzes:", error);
    }
  }, []);

  // クイズを生成する（新クイズシステム）
  const generateQuizzesForArtifact = useCallback(async (artifactId: string): Promise<void> => {
    try {
      const response = await apiGenerateQuizzes(artifactId);

      // 最初のクイズを取得
      const firstQuiz = response.items.find((q) => q.status === "pending");

      setState((prev) => {
        const artifact = prev.artifacts[artifactId];
        if (!artifact) return prev;

        const newProgress: ArtifactProgress = {
          unlockLevel: 0,
          totalQuestions: response.total,
          currentQuiz: firstQuiz ? quizApiToUnlockQuiz(firstQuiz) : null,
          quizHistory: [],
        };

        // 生成されたクイズがない場合は即アンロック
        const isUnlocked = response.total === 0 || response.isUnlocked;

        return {
          ...prev,
          unlockLevel: 0,
          totalQuestions: response.total,
          currentQuiz: firstQuiz ? quizApiToUnlockQuiz(firstQuiz) : null,
          quizHistory: [],
          phase: isUnlocked ? "unlocked" : "unlocking",
          artifactProgress: {
            ...prev.artifactProgress,
            [artifactId]: newProgress,
          },
        };
      });
    } catch (error) {
      console.error("[generateQuizzesForArtifact] Failed to generate quizzes:", error);
    }
  }, []);

  // クイズに回答する（新APIベース）
  const answerQuizAPI = useCallback(async (
    artifactId: string,
    quizId: string,
    answer: string,
    messageCount?: number
  ): Promise<boolean> => {
    try {
      const response = await apiAnswerQuiz(artifactId, quizId, answer);

      const newHistoryItem: QuizHistoryItem = {
        level: response.quiz.level,
        question: response.quiz.question,
        userAnswer: answer,
        isCorrect: response.isCorrect,
        answeredAtMessageCount: messageCount,
        completedQuiz: response.isCorrect ? quizApiToUnlockQuiz(response.quiz) : undefined,
      };

      setState((prev) => {
        if (prev.hintTimer) {
          clearTimeout(prev.hintTimer);
        }

        const newHistory = [...prev.quizHistory, newHistoryItem];

        const newProgress: ArtifactProgress = {
          unlockLevel: response.currentLevel - 1, // 0ベースに変換
          totalQuestions: response.totalQuestions,
          currentQuiz: response.nextQuiz ? quizApiToUnlockQuiz(response.nextQuiz) : null,
          quizHistory: newHistory,
        };

        return {
          ...prev,
          quizHistory: newHistory,
          unlockLevel: newProgress.unlockLevel,
          totalQuestions: response.totalQuestions,
          currentQuiz: response.nextQuiz ? quizApiToUnlockQuiz(response.nextQuiz) : null,
          phase: response.isUnlocked ? "unlocked" : "unlocking",
          hintVisible: !response.isCorrect, // 不正解時はヒントを表示
          hintTimer: null,
          artifactProgress: {
            ...prev.artifactProgress,
            [artifactId]: newProgress,
          },
        };
      });

      return response.isCorrect;
    } catch (error) {
      console.error("[answerQuizAPI] Failed to answer quiz:", error);
      return false;
    }
  }, []);

  const updateOptions = useCallback((newOptions: Partial<GenerationOptions>) => {
    setCurrentOptions((prev) => ({ ...prev, ...newOptions }));
  }, []);

  // アーティファクトを追加または更新
  // 重要: 保存済みの進行状況を最優先で使用する
  // 重要: 新規アーティファクト追加時、既存アーティファクトの進捗は必ず保持する
  // Returns: Promise that resolves with the saved artifact ID (for quiz generation)
  const addOrUpdateArtifact = useCallback((artifact: Artifact): Promise<string | null> => {
    // Estimate quiz count based on code complexity (used for both API and local state)
    const estimatedQuizCount = skipAllowedRef.current ? 0 : estimateQuizCount(artifact.content);

    // API同期 - conversationIdがある場合のみ
    // Returns a Promise so callers can wait for the artifact to be saved
    const apiPromise: Promise<string | null> = conversationId
      ? apiUpsertArtifact(conversationId, {
          id: artifact.id,
          type: artifact.type,
          title: artifact.title,
          content: artifact.content,
          language: artifact.language,
          totalQuestions: estimatedQuizCount,
        })
          .then((response) => response.id)
          .catch((e) => {
            console.error("[addOrUpdateArtifact] API sync failed:", e);
            return null;
          })
      : Promise.resolve(null);

    setState((prev) => {
      const existing = prev.artifacts[artifact.id];
      const existingProgress = prev.artifactProgress[artifact.id];

      const updatedArtifact: Artifact = existing
        ? {
            ...artifact,
            version: existing.version + 1,
            updatedAt: new Date().toISOString(),
            createdAt: existing.createdAt,
          }
        : artifact;

      // 既存の進行状況がある場合は必ずそれを使用（リロード時の状態保持）
      // 新規アーティファクトの場合のみデフォルト値を使用
      if (existingProgress) {
        // skipAllowed の場合は totalQuestions を 0 に強制
        const effectiveTotalQuestions = skipAllowedRef.current ? 0 : existingProgress.totalQuestions;
        const effectiveUnlockLevel = skipAllowedRef.current ? 0 : existingProgress.unlockLevel;

        // 既存の進行状況を保持（アンロック状態をリセットしない）
        const artifactIsUnlocked = effectiveTotalQuestions === 0 ||
          effectiveUnlockLevel >= effectiveTotalQuestions;

        return {
          ...prev,
          artifacts: {
            ...prev.artifacts,
            [artifact.id]: updatedArtifact,
          },
          activeArtifactId: artifact.id,
          unlockLevel: effectiveUnlockLevel,
          totalQuestions: effectiveTotalQuestions,
          currentQuiz: artifactIsUnlocked ? null : existingProgress.currentQuiz,
          quizHistory: existingProgress.quizHistory,
          generatedCode: {
            language: artifact.language || "text",
            code: artifact.content,
            filename: artifact.title,
          },
          phase: artifactIsUnlocked ? "unlocked" : (prev.phase === "initial" ? "coding" : prev.phase),
        };
      }

      // 初期状態がまだ適用されていない場合（conversationId ありで canSave=false）
      // アーティファクトだけ追加し、進行状況は作成しない（初期状態を待つ）
      if (!canSaveRef.current && conversationId) {
        return {
          ...prev,
          artifacts: {
            ...prev.artifacts,
            [artifact.id]: updatedArtifact,
          },
          activeArtifactId: artifact.id,
          generatedCode: {
            language: artifact.language || "text",
            code: artifact.content,
            filename: artifact.title,
          },
          // 進行状況は作成せず、フェーズも変更しない（初期状態の読み込みを待つ）
        };
      }

      // 新規アーティファクトの場合: このアーティファクト専用のtotalQuestionsを使用
      const newProgress: ArtifactProgress = {
        unlockLevel: 0,
        totalQuestions: estimatedQuizCount,
        currentQuiz: null,
        quizHistory: [],
      };

      const newArtifactIsUnlocked = newProgress.totalQuestions === 0;

      // 重要: 既存のアーティファクトが存在する場合、アクティブを切り替えずに追加のみ行う
      // ユーザーが手動で切り替えるか、最初のアーティファクトの場合のみアクティブにする
      const hasExistingActiveArtifact = prev.activeArtifactId && prev.artifacts[prev.activeArtifactId];

      if (hasExistingActiveArtifact) {
        // 既存のアクティブアーティファクトがある: 新規追加のみ、切り替えない
        return {
          ...prev,
          artifacts: {
            ...prev.artifacts,
            [artifact.id]: updatedArtifact,
          },
          // activeArtifactId は変更しない（現在のアーティファクトを維持）
          // グローバル状態も変更しない
          artifactProgress: {
            ...prev.artifactProgress,
            [artifact.id]: newProgress,
          },
          // フェーズは coding に移行（まだ initial なら）
          phase: prev.phase === "initial" ? "coding" : prev.phase,
        };
      }

      // 最初のアーティファクト: アクティブに設定
      return {
        ...prev,
        artifacts: {
          ...prev.artifacts,
          [artifact.id]: updatedArtifact,
        },
        activeArtifactId: artifact.id,
        unlockLevel: newProgress.unlockLevel,
        totalQuestions: newProgress.totalQuestions,
        currentQuiz: null,
        quizHistory: [],
        generatedCode: {
          language: artifact.language || "text",
          code: artifact.content,
          filename: artifact.title,
        },
        phase: newArtifactIsUnlocked ? "unlocked" : "coding",
        artifactProgress: {
          ...prev.artifactProgress,
          [artifact.id]: newProgress,
        },
      };
    });

    // Return the API promise so callers can wait for the artifact to be saved
    return apiPromise;
  }, [conversationId]);

  const setActiveArtifact = useCallback((id: string) => {
    setState((prev) => {
      const artifact = prev.artifacts[id];
      if (!artifact) return prev;

      // 既存の進行状況を取得（ない場合はデフォルト値）
      const progress = prev.artifactProgress[id];

      if (progress) {
        // skipAllowed の場合は totalQuestions を 0 に強制
        const effectiveTotalQuestions = skipAllowedRef.current ? 0 : progress.totalQuestions;
        const effectiveUnlockLevel = skipAllowedRef.current ? 0 : progress.unlockLevel;

        // 保存済みの進行状況を使用
        const artifactIsUnlocked = effectiveTotalQuestions === 0 ||
          effectiveUnlockLevel >= effectiveTotalQuestions;

        return {
          ...prev,
          activeArtifactId: id,
          unlockLevel: effectiveUnlockLevel,
          totalQuestions: effectiveTotalQuestions,
          currentQuiz: artifactIsUnlocked ? null : progress.currentQuiz,
          quizHistory: progress.quizHistory,
          phase: artifactIsUnlocked ? "unlocked" : "unlocking",
          generatedCode: {
            language: artifact.language || "text",
            code: artifact.content,
            filename: artifact.title,
          },
        };
      }

      // 進行状況がない場合（新規アーティファクト）
      // skipAllowed の場合は即アンロック
      const effectiveTotalQuestions = skipAllowedRef.current ? 0 : prev.totalQuestions;
      return {
        ...prev,
        activeArtifactId: id,
        unlockLevel: 0,
        totalQuestions: effectiveTotalQuestions,
        currentQuiz: null,
        quizHistory: [],
        phase: effectiveTotalQuestions === 0 ? "unlocked" : "coding",
        generatedCode: {
          language: artifact.language || "text",
          code: artifact.content,
          filename: artifact.title,
        },
      };
    });
  }, []);

  const activeArtifact = state.activeArtifactId
    ? state.artifacts[state.activeArtifactId]
    : null;

  // コードをコピー可能かどうか
  const canCopyCode = isUnlocked;

  // 進捗パーセンテージ
  const progressPercentage = state.totalQuestions === 0
    ? 100
    : (state.unlockLevel / state.totalQuestions) * 100;

  return {
    state,
    options: currentOptions,
    canCopyCode,
    progressPercentage,
    activeArtifact,
    isUnlocked,
    setPhase,
    setPlan,
    setUserEstimate,
    setGeneratedCode,
    setCurrentQuiz,
    answerQuiz,
    skipToUnlock,
    reset,
    updateOptions,
    addOrUpdateArtifact,
    setActiveArtifact,
    // New Quiz API functions
    loadQuizzesFromAPI,
    generateQuizzesForArtifact,
    answerQuizAPI,
  };
}
