"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Artifact } from "@/types/chat";

// 生成モードのフェーズ
export type GenerationPhase =
  | "initial"       // 初期状態（要求入力待ち）
  | "planning"      // 計画立案中
  | "coding"        // コード生成完了、クイズ待ち
  | "unlocking"     // アンロッククイズ進行中
  | "unlocked";     // 完全アンロック済み

// アンロックレベル（要件定義書 3.3.3 より）
export type UnlockLevel = 1 | 2 | 3 | 4;

// クイズの選択肢
export interface QuizOption {
  label: string;
  text: string;
  explanation?: string; // 各選択肢の解説（なぜ正解/不正解か）
}

// クイズの質問タイプ
export interface UnlockQuiz {
  level: UnlockLevel;
  question: string;
  options: QuizOption[];
  correctLabel: string;
  hint?: string; // メインの解説
  detailedExplanation?: string; // より詳細な解説
  /** クイズが参照するコードスニペット（blur解除して表示） */
  codeSnippet?: string;
  /** コードスニペットの言語 */
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
  estimatedTime?: number; // 分単位
}

// アーティファクトごとの進行状況
export interface ArtifactProgress {
  unlockLevel: UnlockLevel;
  currentQuiz: UnlockQuiz | null;
  quizHistory: {
    level: UnlockLevel;
    question: string;
    userAnswer: string;
    isCorrect: boolean;
  }[];
}

// 生成モードの状態
export interface GenerationModeState {
  phase: GenerationPhase;
  unlockLevel: UnlockLevel; // 後方互換性のため残す（アクティブなアーティファクトのレベル）
  generatedCode: GeneratedCode | null;
  plan: Plan | null;
  quizHistory: {
    level: UnlockLevel;
    question: string;
    userAnswer: string;
    isCorrect: boolean;
  }[];
  currentQuiz: UnlockQuiz | null;
  hintVisible: boolean;
  hintTimer: number | null;
  // Artifact system
  artifacts: Record<string, Artifact>;
  activeArtifactId: string | null;
  // アーティファクトごとの進行状況
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

// 永続化する状態の型（タイマーなどは除外）
export interface PersistedGenerationState {
  phase: GenerationPhase;
  unlockLevel: UnlockLevel;
  artifacts: Record<string, Artifact>;
  activeArtifactId: string | null;
  artifactProgress: Record<string, ArtifactProgress>;
  quizHistory: GenerationModeState["quizHistory"];
}

// レベルごとのぼかし強度（Tailwind CSSクラス）
export const BLUR_LEVELS: Record<UnlockLevel, string> = {
  1: "blur-[12px]",  // 完全にぼかし
  2: "blur-[8px]",   // 中程度
  3: "blur-[4px]",   // 軽度
  4: "blur-none",    // クリア（コピー可能）
};

// レベルごとのラベル
export const LEVEL_LABELS: Record<UnlockLevel, { title: string; description: string }> = {
  1: { title: "レベル1", description: "コードの目的を理解する" },
  2: { title: "レベル2", description: "使用パターンを理解する" },
  3: { title: "レベル3", description: "設計意図を理解する" },
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
  conversationId?: string; // 永続化用の会話ID
  initialState?: PersistedGenerationState; // 初期状態（会話metadataから）
}

export function useGenerationMode(options: UseGenerationModeOptions = {}) {
  const { conversationId, initialState, ...generationOptions } = options;
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>("");
  const initialStateAppliedRef = useRef(false);

  const [state, setState] = useState<GenerationModeState>(() => {
    const defaultState: GenerationModeState = {
      phase: "initial",
      unlockLevel: 1,
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

    // 初期状態があれば適用
    if (initialState) {
      initialStateAppliedRef.current = true;
      return {
        ...defaultState,
        phase: initialState.phase || "initial",
        unlockLevel: initialState.unlockLevel || 1,
        artifacts: initialState.artifacts || {},
        activeArtifactId: initialState.activeArtifactId || null,
        artifactProgress: initialState.artifactProgress || {},
        quizHistory: initialState.quizHistory || [],
        // アクティブなアーティファクトの進行状況からcurrentQuizを設定しない（表示バグ防止）
        currentQuiz: null,
      };
    }

    return defaultState;
  });

  const [currentOptions, setCurrentOptions] = useState<GenerationOptions>({
    ...DEFAULT_OPTIONS,
    ...generationOptions,
  });

  // 非同期で読み込まれた初期状態を適用
  useEffect(() => {
    if (!initialState || initialStateAppliedRef.current) return;

    initialStateAppliedRef.current = true;
    setState((prev) => ({
      ...prev,
      phase: initialState.phase || prev.phase,
      unlockLevel: initialState.unlockLevel || prev.unlockLevel,
      artifacts: { ...prev.artifacts, ...initialState.artifacts },
      activeArtifactId: initialState.activeArtifactId || prev.activeArtifactId,
      artifactProgress: { ...prev.artifactProgress, ...initialState.artifactProgress },
      quizHistory: initialState.quizHistory?.length ? initialState.quizHistory : prev.quizHistory,
    }));
  }, [initialState]);

  // 状態が変更されたらAPIに保存（デバウンス付き）
  useEffect(() => {
    if (!conversationId || state.phase === "initial") return;

    // 状態の変更を検出
    const stateHash = JSON.stringify({
      phase: state.phase,
      unlockLevel: state.unlockLevel,
      artifactProgress: state.artifactProgress,
      activeArtifactId: state.activeArtifactId,
    });

    // 同じ状態なら保存しない
    if (stateHash === lastSavedStateRef.current) return;

    // デバウンス: 500ms後に保存
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

  // フェーズを変更
  const setPhase = useCallback((phase: GenerationPhase) => {
    setState((prev) => ({ ...prev, phase }));
  }, []);

  // 計画を設定
  const setPlan = useCallback((plan: Plan) => {
    setState((prev) => ({ ...prev, plan, phase: "planning" }));
  }, []);

  // ユーザーの見積もりを設定
  const setUserEstimate = useCallback((estimate: number) => {
    setState((prev) => ({
      ...prev,
      plan: prev.plan ? { ...prev.plan, userEstimate: estimate } : null,
    }));
  }, []);

  // 生成されたコードを設定
  const setGeneratedCode = useCallback((code: GeneratedCode) => {
    setState((prev) => ({
      ...prev,
      generatedCode: code,
      phase: "coding",
      unlockLevel: currentOptions.unlockMethod === "skip" ? 4 : 1,
    }));
  }, [currentOptions.unlockMethod]);

  // クイズを設定
  const setCurrentQuiz = useCallback((quiz: UnlockQuiz) => {
    setState((prev) => {
      const activeId = prev.activeArtifactId;
      const currentProgress = activeId ? prev.artifactProgress[activeId] : null;

      // アンロック済みの場合はクイズを設定しない
      if (currentProgress && currentProgress.unlockLevel >= 4) {
        return prev;
      }

      // アーティファクトごとの進行状況も更新
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

    // 30秒後にヒント表示
    if (currentOptions.hintSpeed === "30sec") {
      const timer = window.setTimeout(() => {
        setState((prev) => ({ ...prev, hintVisible: true }));
      }, 30000);
      setState((prev) => ({ ...prev, hintTimer: timer }));
    }
  }, [currentOptions.hintSpeed]);

  // クイズに回答
  const answerQuiz = useCallback((answer: string): boolean => {
    if (!state.currentQuiz) return false;

    const isCorrect = answer === state.currentQuiz.correctLabel;

    setState((prev) => {
      // タイマーをクリア
      if (prev.hintTimer) {
        clearTimeout(prev.hintTimer);
      }

      const activeId = prev.activeArtifactId;
      const currentProgress = activeId ? prev.artifactProgress[activeId] : null;

      const newHistoryItem = {
        level: prev.currentQuiz!.level,
        question: prev.currentQuiz!.question,
        userAnswer: answer,
        isCorrect,
      };

      const newHistory = [...prev.quizHistory, newHistoryItem];

      if (isCorrect) {
        const nextLevel = (prev.unlockLevel + 1) as UnlockLevel;
        const clampedLevel = nextLevel > 4 ? 4 : nextLevel;

        // アーティファクトごとの進行状況も更新
        const updatedProgress: Record<string, ArtifactProgress> = activeId
          ? {
              ...prev.artifactProgress,
              [activeId]: {
                unlockLevel: clampedLevel,
                currentQuiz: null,
                quizHistory: currentProgress
                  ? [...currentProgress.quizHistory, newHistoryItem]
                  : [newHistoryItem],
              },
            }
          : prev.artifactProgress;

        return {
          ...prev,
          quizHistory: newHistory,
          unlockLevel: clampedLevel,
          // 正解時はクイズをクリア（フォールバックで次のクイズを生成）
          currentQuiz: null,
          phase: nextLevel > 3 ? "unlocked" : "unlocking",
          hintVisible: false,
          hintTimer: null,
          artifactProgress: updatedProgress,
        };
      }

      // 不正解の場合はヒントを表示
      return {
        ...prev,
        quizHistory: newHistory,
        hintVisible: true,
        hintTimer: null,
      };
    });

    return isCorrect;
  }, [state.currentQuiz]);

  // スキップ（管理者設定で許可されている場合）
  const skipToUnlock = useCallback(() => {
    setState((prev) => {
      const activeId = prev.activeArtifactId;
      const currentProgress = activeId ? prev.artifactProgress[activeId] : null;

      // アーティファクトごとの進行状況も更新
      const updatedProgress: Record<string, ArtifactProgress> = activeId && currentProgress
        ? {
            ...prev.artifactProgress,
            [activeId]: {
              ...currentProgress,
              unlockLevel: 4,
              currentQuiz: null,
            },
          }
        : prev.artifactProgress;

      return {
        ...prev,
        unlockLevel: 4,
        phase: "unlocked",
        currentQuiz: null,
        hintVisible: false,
        artifactProgress: updatedProgress,
      };
    });
  }, []);

  // リセット
  const reset = useCallback(() => {
    setState({
      phase: "initial",
      unlockLevel: 1,
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
  }, []);

  // オプションを更新
  const updateOptions = useCallback((newOptions: Partial<GenerationOptions>) => {
    setCurrentOptions((prev) => ({ ...prev, ...newOptions }));
  }, []);

  // アーティファクトを追加または更新
  const addOrUpdateArtifact = useCallback((artifact: Artifact) => {
    setState((prev) => {
      const existing = prev.artifacts[artifact.id];
      const existingProgress = prev.artifactProgress[artifact.id];
      const isNewArtifact = !existing;

      const updatedArtifact: Artifact = existing
        ? {
            ...artifact,
            version: existing.version + 1,
            updatedAt: new Date().toISOString(),
            createdAt: existing.createdAt,
          }
        : artifact;

      // 既存の進行状況を使用、なければ初期化
      const progress: ArtifactProgress = existingProgress || {
        unlockLevel: 1,
        currentQuiz: null,
        quizHistory: [],
      };

      return {
        ...prev,
        artifacts: {
          ...prev.artifacts,
          [artifact.id]: updatedArtifact,
        },
        activeArtifactId: artifact.id,
        // アクティブなアーティファクトの進行状況を反映
        unlockLevel: progress.unlockLevel,
        // 新規またはアンロック済みの場合はクイズをクリア
        currentQuiz: isNewArtifact || progress.unlockLevel >= 4 ? null : progress.currentQuiz,
        quizHistory: progress.quizHistory,
        // Also set generatedCode for backward compatibility
        generatedCode: {
          language: artifact.language || "text",
          code: artifact.content,
          filename: artifact.title,
        },
        phase: prev.phase === "initial" ? "coding" : (progress.unlockLevel >= 4 ? "unlocked" : "unlocking"),
        // 既存の進行状況を保持（新規アーティファクトのみ初期化）
        artifactProgress: existingProgress
          ? prev.artifactProgress
          : {
              ...prev.artifactProgress,
              [artifact.id]: progress,
            },
      };
    });
  }, []);

  // アクティブなアーティファクトを設定
  const setActiveArtifact = useCallback((id: string) => {
    setState((prev) => {
      const artifact = prev.artifacts[id];
      if (!artifact) return prev;

      // アーティファクトの進行状況を取得
      const progress = prev.artifactProgress[id] || {
        unlockLevel: 1 as UnlockLevel,
        currentQuiz: null,
        quizHistory: [],
      };

      // アンロック済みの場合はクイズをクリア
      const isUnlocked = progress.unlockLevel >= 4;

      return {
        ...prev,
        activeArtifactId: id,
        // アクティブなアーティファクトの進行状況を反映
        unlockLevel: progress.unlockLevel,
        // アンロック済みの場合はクイズを表示しない
        currentQuiz: isUnlocked ? null : progress.currentQuiz,
        quizHistory: progress.quizHistory,
        phase: isUnlocked ? "unlocked" : "unlocking",
        generatedCode: {
          language: artifact.language || "text",
          code: artifact.content,
          filename: artifact.title,
        },
      };
    });
  }, []);

  // アクティブなアーティファクトを取得
  const activeArtifact = state.activeArtifactId
    ? state.artifacts[state.activeArtifactId]
    : null;

  // コードをコピー可能かどうか
  const canCopyCode = state.unlockLevel === 4;

  // 進捗パーセンテージ
  const progressPercentage = ((state.unlockLevel - 1) / 3) * 100;

  return {
    state,
    options: currentOptions,
    canCopyCode,
    progressPercentage,
    activeArtifact,
    setPhase,
    setPlan,
    setUserEstimate,
    setGeneratedCode,
    setCurrentQuiz,
    answerQuiz,
    skipToUnlock,
    reset,
    updateOptions,
    // Artifact management
    addOrUpdateArtifact,
    setActiveArtifact,
  };
}
