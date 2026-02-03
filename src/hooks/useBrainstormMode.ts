"use client";

import { useState, useCallback } from "react";
import type { BrainstormPhase, BrainstormSubMode, PlanStep, BrainstormModeState } from "@/types/chat";

// BrainstormModeStateを再エクスポート（既存コードとの互換性のため）
export type { BrainstormModeState } from "@/types/chat";

// フェーズの順序定義
export const BRAINSTORM_PHASES: BrainstormPhase[] = [
  "verbalization",
  "persona",
  "market",
  "technology",
  "impact",
  "mvp",
  "task-breakdown",
];

// フェーズ情報
export const PHASE_INFO: Record<
  BrainstormPhase,
  {
    title: string;
    description: string;
    icon: string;
    questions: string[];
    quickReplies: { label: string; value: string }[];
  }
> = {
  verbalization: {
    title: "言語化",
    description: "一言でアイデアを表現（詳細は後で）",
    icon: "lightbulb",
    questions: [
      "そのアイデア、一言で言うと何ですか？",
    ],
    quickReplies: [
      { label: "タスク管理系", value: "タスク・予定管理系のサービスです" },
      { label: "学習支援系", value: "学習・教育支援系のサービスです" },
      { label: "SNS・コミュニティ系", value: "コミュニティ・SNS系のサービスです" },
      { label: "業務効率化系", value: "業務効率化・自動化系のサービスです" },
    ],
  },
  persona: {
    title: "ペルソナ",
    description: "誰の、どんな課題？",
    icon: "person",
    questions: [
      "誰のどんな課題を解決しますか？",
    ],
    quickReplies: [
      { label: "学生向け", value: "主なターゲットは学生です" },
      { label: "社会人向け", value: "主なターゲットは社会人（一般）です" },
      { label: "エンジニア向け", value: "主なターゲットはエンジニアです" },
      { label: "特定業種向け", value: "特定の業種の人をターゲットにしています" },
    ],
  },
  market: {
    title: "市場検証",
    description: "競合との違いは？",
    icon: "trending_up",
    questions: [
      "類似サービスとの違いは？",
    ],
    quickReplies: [
      { label: "競合を知っている", value: "類似サービスを知っています" },
      { label: "競合を調べたい", value: "類似サービスを教えてください" },
      { label: "差別化できる", value: "差別化ポイントがあります" },
      { label: "一緒に考えたい", value: "差別化を一緒に考えてください" },
    ],
  },
  technology: {
    title: "技術検証",
    description: "どの技術で作る？",
    icon: "code",
    questions: [
      "どのプラットフォームで作りますか？",
    ],
    quickReplies: [
      { label: "Webアプリ", value: "Webアプリとして実装したい" },
      { label: "モバイルアプリ", value: "モバイルアプリとして実装したい" },
      { label: "デスクトップ", value: "デスクトップアプリとして実装したい" },
      { label: "提案してほしい", value: "技術スタックを提案してください" },
    ],
  },
  impact: {
    title: "インパクト",
    description: "成功したらどう変わる？",
    icon: "public",
    questions: [
      "成功したらどんな変化が起きますか？",
    ],
    quickReplies: [
      { label: "時間の節約", value: "ユーザーの時間を節約できます" },
      { label: "コスト削減", value: "コストを削減できます" },
      { label: "体験向上", value: "ユーザー体験を向上できます" },
      { label: "新しい価値", value: "新しい価値を提供できます" },
    ],
  },
  mvp: {
    title: "MVP定義",
    description: "最小限で何を作る？",
    icon: "rocket_launch",
    questions: [
      "最小限、何があれば検証できますか？",
    ],
    quickReplies: [
      { label: "コア機能のみ", value: "コア機能だけに絞ります" },
      { label: "提案してほしい", value: "MVPを提案してください" },
      { label: "決まっている", value: "MVPは決まっています" },
      { label: "一緒に考えたい", value: "一緒に考えてください" },
    ],
  },
  "task-breakdown": {
    title: "タスク分解",
    description: "どんな順番で作る？",
    icon: "checklist",
    questions: [
      "実装ステップを整理しましょう",
    ],
    quickReplies: [
      { label: "提案して", value: "タスクリストを提案してください" },
      { label: "自分で考える", value: "自分でタスクを考えます" },
      { label: "一緒に整理", value: "一緒に整理してください" },
      { label: "最初だけ", value: "最初のアクションだけ教えて" },
    ],
  },
};

// デフォルト初期状態
const DEFAULT_BRAINSTORM_STATE: BrainstormModeState = {
  subMode: "casual",
  currentPhase: "verbalization",
  completedPhases: [],
  ideaSummary: null,
  persona: null,
  competitors: [],
  techStack: [],
  mvpFeatures: [],
  planSteps: [],
  insights: [],
};

export { DEFAULT_BRAINSTORM_STATE };

interface UseBrainstormModeOptions {
  initialState?: BrainstormModeState;
}

export function useBrainstormMode(options?: UseBrainstormModeOptions) {
  const [state, setState] = useState<BrainstormModeState>(
    options?.initialState ?? DEFAULT_BRAINSTORM_STATE
  );

  // 外部から状態を復元
  const restoreState = useCallback((savedState: BrainstormModeState) => {
    setState(savedState);
  }, []);

  // フェーズを進める
  const advancePhase = useCallback(() => {
    setState((prev) => {
      const currentIndex = BRAINSTORM_PHASES.indexOf(prev.currentPhase);
      const nextPhase = BRAINSTORM_PHASES[currentIndex + 1];

      if (!nextPhase) return prev;

      return {
        ...prev,
        completedPhases: [...prev.completedPhases, prev.currentPhase],
        currentPhase: nextPhase,
      };
    });
  }, []);

  // フェーズを戻る
  const goBackPhase = useCallback(() => {
    setState((prev) => {
      const currentIndex = BRAINSTORM_PHASES.indexOf(prev.currentPhase);
      const prevPhase = BRAINSTORM_PHASES[currentIndex - 1];

      if (!prevPhase) return prev;

      return {
        ...prev,
        completedPhases: prev.completedPhases.filter((p) => p !== prevPhase),
        currentPhase: prevPhase,
      };
    });
  }, []);

  // 特定のフェーズに移動（前後両方向可能）
  const goToPhase = useCallback((phase: BrainstormPhase, allowSkip: boolean = false) => {
    setState((prev) => {
      const targetIndex = BRAINSTORM_PHASES.indexOf(phase);
      const currentIndex = BRAINSTORM_PHASES.indexOf(prev.currentPhase);

      // スキップが許可されていない場合は、完了済みフェーズか現在のフェーズのみ移動可能
      if (!allowSkip && targetIndex > currentIndex) return prev;

      // 前のフェーズに戻る場合
      if (targetIndex < currentIndex) {
        return {
          ...prev,
          currentPhase: phase,
        };
      }

      // 前進またはスキップする場合: 途中のフェーズを完了済みにする
      const phasesToComplete = BRAINSTORM_PHASES.slice(currentIndex, targetIndex);
      const newCompletedPhases = [...prev.completedPhases];
      for (const p of phasesToComplete) {
        if (!newCompletedPhases.includes(p)) {
          newCompletedPhases.push(p);
        }
      }

      return {
        ...prev,
        completedPhases: newCompletedPhases,
        currentPhase: phase,
      };
    });
  }, []);

  // フェーズをスキップして進む（特定のフェーズに直接移動）
  const skipToPhase = useCallback((phase: BrainstormPhase) => {
    goToPhase(phase, true);
  }, [goToPhase]);

  // アイデアサマリーを設定
  const setIdeaSummary = useCallback((summary: string) => {
    setState((prev) => ({ ...prev, ideaSummary: summary }));
  }, []);

  // ペルソナを設定
  const setPersona = useCallback((persona: string) => {
    setState((prev) => ({ ...prev, persona }));
  }, []);

  // 競合を追加
  const addCompetitor = useCallback((competitor: string) => {
    setState((prev) => ({
      ...prev,
      competitors: [...prev.competitors, competitor],
    }));
  }, []);

  // 技術スタックを設定
  const setTechStack = useCallback((stack: string[]) => {
    setState((prev) => ({ ...prev, techStack: stack }));
  }, []);

  // MVP機能を設定
  const setMvpFeatures = useCallback((features: string[]) => {
    setState((prev) => ({ ...prev, mvpFeatures: features }));
  }, []);

  // 計画ステップを設定
  const setPlanSteps = useCallback((steps: PlanStep[]) => {
    setState((prev) => ({ ...prev, planSteps: steps }));
  }, []);

  // ステップの完了状態を切り替え
  const toggleStepCompletion = useCallback((stepId: string) => {
    setState((prev) => ({
      ...prev,
      planSteps: prev.planSteps.map((step) =>
        step.id === stepId ? { ...step, completed: !step.completed } : step
      ),
    }));
  }, []);

  // インサイトを追加
  const addInsight = useCallback((insight: string) => {
    setState((prev) => ({
      ...prev,
      insights: [...prev.insights, insight],
    }));
  }, []);

  // リセット
  const reset = useCallback(() => {
    setState(DEFAULT_BRAINSTORM_STATE);
  }, []);

  // サブモードを変更
  const setSubMode = useCallback((subMode: BrainstormSubMode) => {
    setState((prev) => ({ ...prev, subMode }));
  }, []);

  // 進捗率を計算
  const progressPercentage =
    (state.completedPhases.length / BRAINSTORM_PHASES.length) * 100;

  // 現在のフェーズ情報
  const currentPhaseInfo = PHASE_INFO[state.currentPhase];

  // 次のフェーズがあるか
  const hasNextPhase =
    BRAINSTORM_PHASES.indexOf(state.currentPhase) < BRAINSTORM_PHASES.length - 1;

  // 前のフェーズがあるか
  const hasPrevPhase = BRAINSTORM_PHASES.indexOf(state.currentPhase) > 0;

  return {
    state,
    currentPhaseInfo,
    progressPercentage,
    hasNextPhase,
    hasPrevPhase,
    advancePhase,
    goBackPhase,
    goToPhase,
    skipToPhase,
    setIdeaSummary,
    setPersona,
    addCompetitor,
    setTechStack,
    setMvpFeatures,
    setPlanSteps,
    toggleStepCompletion,
    addInsight,
    reset,
    setSubMode,
    restoreState,
  };
}
