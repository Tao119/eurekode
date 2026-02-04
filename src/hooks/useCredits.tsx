"use client";

import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { AIModel, IndividualPlan, OrganizationPlan } from "@/config/plans";

interface CreditState {
  /** ローディング中 */
  isLoading: boolean;
  /** エラー */
  error: string | null;
  /** 現在のプラン */
  plan: IndividualPlan | OrganizationPlan;
  /** 組織プランか */
  isOrganization: boolean;
  /** 組織メンバーか */
  isOrganizationMember: boolean;
  /** 月間ポイント情報 */
  monthly: {
    total: number;
    used: number;
    remaining: number;
  };
  /** 購入ポイント情報 */
  purchased: {
    balance: number;
    used: number;
    remaining: number;
  };
  /** 割り当てポイント情報（組織メンバーの場合） */
  allocated: {
    total: number;
    used: number;
    remaining: number;
  } | null;
  /** 総残りポイント */
  totalRemaining: number;
  /** モデル別残り会話回数 */
  remainingConversations: {
    sonnet: number;
    opus: number;
  };
  /** 利用可能なモデル */
  availableModels: AIModel[];
  /** 会話開始可能か */
  canStartConversation: boolean;
  /** 低残高警告 */
  lowBalanceWarning: boolean;
  /** 期間情報 */
  period: {
    start: Date;
    end: Date;
  };
}

interface UseCreditReturn extends CreditState {
  /** クレジット情報を再取得 */
  refresh: () => Promise<void>;
  /** 会話後にポイントを消費（ローカル更新） */
  consumePoints: (model: AIModel) => void;
  /** ポイント不足でブロックされたか */
  isBlocked: boolean;
  /** モデルが利用可能か確認 */
  canUseModel: (model: AIModel) => boolean;
  /** 特定モデルでの残り会話回数 */
  getRemainingForModel: (model: AIModel) => number;
}

const MODEL_CONSUMPTION_RATE: Record<AIModel, number> = {
  sonnet: 1.0,
  opus: 1.6,
};

const defaultState: CreditState = {
  isLoading: true,
  error: null,
  plan: "free",
  isOrganization: false,
  isOrganizationMember: false,
  monthly: { total: 30, used: 0, remaining: 30 },
  purchased: { balance: 0, used: 0, remaining: 0 },
  allocated: null,
  totalRemaining: 30,
  remainingConversations: { sonnet: 30, opus: 18 },
  availableModels: ["sonnet"],
  canStartConversation: true,
  lowBalanceWarning: false,
  period: { start: new Date(), end: new Date() },
};

export function useCredits(): UseCreditReturn {
  const [state, setState] = useState<CreditState>(defaultState);

  const fetchCredits = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch("/api/billing/credits/balance");

      if (!response.ok) {
        throw new Error("Failed to fetch credit balance");
      }

      const data = await response.json();

      setState({
        isLoading: false,
        error: null,
        plan: data.plan,
        isOrganization: data.isOrganization,
        isOrganizationMember: data.isOrganizationMember,
        monthly: data.points.monthly,
        purchased: data.points.purchased,
        allocated: data.points.allocated,
        totalRemaining: data.points.totalRemaining,
        remainingConversations: data.remainingConversations,
        availableModels: data.availableModels,
        canStartConversation: data.canStartConversation,
        lowBalanceWarning: data.lowBalanceWarning,
        period: {
          start: new Date(data.period.start),
          end: new Date(data.period.end),
        },
      });
    } catch (error) {
      console.error("Failed to fetch credits:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const consumePoints = useCallback((model: AIModel) => {
    const cost = MODEL_CONSUMPTION_RATE[model];

    setState((prev) => {
      // 割り当てポイントがある場合（組織メンバー）
      if (prev.allocated) {
        const newAllocatedUsed = prev.allocated.used + cost;
        const newAllocatedRemaining = Math.max(0, prev.allocated.total - newAllocatedUsed);

        return {
          ...prev,
          allocated: {
            ...prev.allocated,
            used: newAllocatedUsed,
            remaining: newAllocatedRemaining,
          },
          totalRemaining: newAllocatedRemaining,
          remainingConversations: {
            sonnet: Math.floor(newAllocatedRemaining / MODEL_CONSUMPTION_RATE.sonnet),
            opus: Math.floor(newAllocatedRemaining / MODEL_CONSUMPTION_RATE.opus),
          },
          canStartConversation: newAllocatedRemaining >= MODEL_CONSUMPTION_RATE.sonnet,
          lowBalanceWarning: newAllocatedRemaining < 5,
        };
      }

      // プランポイントを優先消費
      let remainingCost = cost;
      let newMonthlyUsed = prev.monthly.used;
      let newPurchasedUsed = prev.purchased.used;

      const monthlyAvailable = prev.monthly.total - prev.monthly.used;
      if (monthlyAvailable > 0) {
        const fromMonthly = Math.min(remainingCost, monthlyAvailable);
        newMonthlyUsed += fromMonthly;
        remainingCost -= fromMonthly;
      }

      if (remainingCost > 0) {
        newPurchasedUsed += remainingCost;
      }

      const newMonthlyRemaining = Math.max(0, prev.monthly.total - newMonthlyUsed);
      const newPurchasedRemaining = Math.max(0, prev.purchased.balance - newPurchasedUsed);
      const newTotalRemaining = newMonthlyRemaining + newPurchasedRemaining;

      return {
        ...prev,
        monthly: {
          ...prev.monthly,
          used: newMonthlyUsed,
          remaining: newMonthlyRemaining,
        },
        purchased: {
          ...prev.purchased,
          used: newPurchasedUsed,
          remaining: newPurchasedRemaining,
        },
        totalRemaining: newTotalRemaining,
        remainingConversations: {
          sonnet: Math.floor(newTotalRemaining / MODEL_CONSUMPTION_RATE.sonnet),
          opus: Math.floor(newTotalRemaining / MODEL_CONSUMPTION_RATE.opus),
        },
        canStartConversation: newTotalRemaining >= MODEL_CONSUMPTION_RATE.sonnet,
        lowBalanceWarning: newTotalRemaining < 5,
      };
    });
  }, []);

  const canUseModel = useCallback(
    (model: AIModel): boolean => {
      if (!state.availableModels.includes(model)) return false;
      return state.totalRemaining >= MODEL_CONSUMPTION_RATE[model];
    },
    [state.availableModels, state.totalRemaining]
  );

  const getRemainingForModel = useCallback(
    (model: AIModel): number => {
      return state.remainingConversations[model] || 0;
    },
    [state.remainingConversations]
  );

  return {
    ...state,
    refresh: fetchCredits,
    consumePoints,
    isBlocked: !state.canStartConversation,
    canUseModel,
    getRemainingForModel,
  };
}

// Context for sharing credit state across components
interface CreditContextValue extends UseCreditReturn {
  showOutOfCreditsModal: boolean;
  setShowOutOfCreditsModal: (show: boolean) => void;
}

const CreditContext = createContext<CreditContextValue | null>(null);

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const credits = useCredits();
  const [showOutOfCreditsModal, setShowOutOfCreditsModal] = useState(false);

  // Auto-show modal when blocked
  useEffect(() => {
    if (credits.isBlocked && !credits.isLoading) {
      setShowOutOfCreditsModal(true);
    }
  }, [credits.isBlocked, credits.isLoading]);

  return (
    <CreditContext.Provider
      value={{
        ...credits,
        showOutOfCreditsModal,
        setShowOutOfCreditsModal,
      }}
    >
      {children}
    </CreditContext.Provider>
  );
}

export function useCreditContext() {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error("useCreditContext must be used within CreditProvider");
  }
  return context;
}
