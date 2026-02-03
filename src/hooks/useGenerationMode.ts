"use client";

import { useState, useCallback } from "react";

// 生成モードのフェーズ
export type GenerationPhase =
  | "initial"       // 初期状態（要求入力待ち）
  | "planning"      // 計画立案中
  | "coding"        // コード生成完了、クイズ待ち
  | "unlocking"     // アンロッククイズ進行中
  | "unlocked";     // 完全アンロック済み

// アンロックレベル（要件定義書 3.3.3 より）
export type UnlockLevel = 1 | 2 | 3 | 4;

// クイズの質問タイプ
export interface UnlockQuiz {
  level: UnlockLevel;
  question: string;
  options: { label: string; text: string }[];
  correctLabel: string;
  hint?: string;
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
  userEstimate?: number;  // ユーザーの見積もり
}

// 生成モードの状態
export interface GenerationModeState {
  phase: GenerationPhase;
  unlockLevel: UnlockLevel;
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
}

// オプション設定
export interface GenerationOptions {
  unlockMethod: "quiz" | "explanation" | "skip";
  hintSpeed: "immediate" | "30sec" | "none";
  estimationTraining: boolean;
}

const DEFAULT_OPTIONS: GenerationOptions = {
  unlockMethod: "quiz",
  hintSpeed: "30sec",
  estimationTraining: true,
};

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

export function useGenerationMode(options: Partial<GenerationOptions> = {}) {
  const [state, setState] = useState<GenerationModeState>({
    phase: "initial",
    unlockLevel: 1,
    generatedCode: null,
    plan: null,
    quizHistory: [],
    currentQuiz: null,
    hintVisible: false,
    hintTimer: null,
  });

  const [currentOptions, setCurrentOptions] = useState<GenerationOptions>({
    ...DEFAULT_OPTIONS,
    ...options,
  });

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
    setState((prev) => ({
      ...prev,
      currentQuiz: quiz,
      phase: "unlocking",
      hintVisible: currentOptions.hintSpeed === "immediate",
    }));

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

      const newHistory = [
        ...prev.quizHistory,
        {
          level: prev.currentQuiz!.level,
          question: prev.currentQuiz!.question,
          userAnswer: answer,
          isCorrect,
        },
      ];

      if (isCorrect) {
        const nextLevel = (prev.unlockLevel + 1) as UnlockLevel;
        return {
          ...prev,
          quizHistory: newHistory,
          unlockLevel: nextLevel > 4 ? 4 : nextLevel,
          currentQuiz: null,
          phase: nextLevel > 3 ? "unlocked" : "unlocking",
          hintVisible: false,
          hintTimer: null,
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
    setState((prev) => ({
      ...prev,
      unlockLevel: 4,
      phase: "unlocked",
      currentQuiz: null,
      hintVisible: false,
    }));
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
    });
  }, []);

  // オプションを更新
  const updateOptions = useCallback((newOptions: Partial<GenerationOptions>) => {
    setCurrentOptions((prev) => ({ ...prev, ...newOptions }));
  }, []);

  // コードをコピー可能かどうか
  const canCopyCode = state.unlockLevel === 4;

  // 進捗パーセンテージ
  const progressPercentage = ((state.unlockLevel - 1) / 3) * 100;

  return {
    state,
    options: currentOptions,
    canCopyCode,
    progressPercentage,
    setPhase,
    setPlan,
    setUserEstimate,
    setGeneratedCode,
    setCurrentQuiz,
    answerQuiz,
    skipToUnlock,
    reset,
    updateOptions,
  };
}
