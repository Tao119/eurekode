"use client";

import { useState, useCallback } from "react";
import type { BrainstormPhase, PlanStep, BrainstormModeState } from "@/types/chat";

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
    description: "アイデアを一言で説明する",
    icon: "lightbulb",
    questions: [
      "そのアイデア、一言で言うと何ですか？",
      "30秒で説明するとしたら？",
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
    description: "ターゲットユーザーを明確化",
    icon: "person",
    questions: [
      "誰のどんな課題を解決しますか？",
      "その人は今どうやって対処していますか？",
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
    description: "競合と差別化ポイント",
    icon: "trending_up",
    questions: [
      "類似サービスとの違いは何ですか？",
      "なぜ既存サービスでは満足できないのですか？",
    ],
    quickReplies: [
      { label: "競合を知っている", value: "はい、類似サービスを知っています" },
      { label: "競合を知らない", value: "類似サービスはまだ調べていません" },
      { label: "競合と差別化できる", value: "明確な差別化ポイントがあります" },
      { label: "差別化を考え中", value: "差別化ポイントを考え中です" },
    ],
  },
  technology: {
    title: "技術検証",
    description: "技術スタックの選定",
    icon: "code",
    questions: [
      "実現に必要な技術スタックは？",
      "新しく学ぶ必要がある技術は？",
    ],
    quickReplies: [
      { label: "Webアプリ", value: "Webアプリ（PC向け）として実装したい" },
      { label: "モバイルアプリ", value: "モバイルアプリとして実装したい" },
      { label: "デスクトップアプリ", value: "デスクトップアプリとして実装したい" },
      { label: "複数プラットフォーム", value: "複数プラットフォームで展開したい" },
    ],
  },
  impact: {
    title: "インパクト",
    description: "社会的価値を言語化",
    icon: "public",
    questions: [
      "このサービスが成功したら、世の中はどう変わりますか？",
      "あなたがこれを作りたい理由は？",
    ],
    quickReplies: [
      { label: "時間の節約", value: "ユーザーの時間を大幅に節約できます" },
      { label: "コスト削減", value: "コストを削減できます" },
      { label: "体験の向上", value: "ユーザー体験を大幅に向上できます" },
      { label: "新しい価値", value: "これまでになかった新しい価値を提供できます" },
    ],
  },
  mvp: {
    title: "MVP定義",
    description: "最小限の検証機能を決定",
    icon: "rocket_launch",
    questions: [
      "最小限、何ができれば検証できますか？",
      "なくても検証できる機能は？",
    ],
    quickReplies: [
      { label: "コア機能のみ", value: "コア機能だけに絞ります" },
      { label: "提案をください", value: "MVPの範囲を提案してほしいです" },
      { label: "もう決まっている", value: "MVPの範囲は決まっています" },
      { label: "一緒に考えたい", value: "一緒にMVPの範囲を考えてほしいです" },
    ],
  },
  "task-breakdown": {
    title: "タスク分解",
    description: "実装ステップを整理",
    icon: "checklist",
    questions: [
      "実際に作るとしたら、どんなステップで進めますか？",
      "各ステップの優先度は？",
    ],
    quickReplies: [
      { label: "タスクを提案して", value: "タスクリストを提案してください" },
      { label: "自分で考える", value: "自分でタスクを考えます" },
      { label: "一緒に整理", value: "一緒にタスクを整理してください" },
      { label: "次のアクションだけ", value: "まず最初のアクションだけ教えて" },
    ],
  },
};

// デフォルト初期状態
const DEFAULT_BRAINSTORM_STATE: BrainstormModeState = {
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

  // 特定のフェーズに移動
  const goToPhase = useCallback((phase: BrainstormPhase) => {
    setState((prev) => {
      const targetIndex = BRAINSTORM_PHASES.indexOf(phase);
      const currentIndex = BRAINSTORM_PHASES.indexOf(prev.currentPhase);

      // 完了済みフェーズか現在のフェーズのみ移動可能
      if (targetIndex > currentIndex) return prev;

      return {
        ...prev,
        currentPhase: phase,
      };
    });
  }, []);

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
    setIdeaSummary,
    setPersona,
    addCompetitor,
    setTechStack,
    setMvpFeatures,
    setPlanSteps,
    toggleStepCompletion,
    addInsight,
    reset,
    restoreState,
  };
}
