/**
 * Plan Restrictions Service
 *
 * プランごとの機能制限を厳格に管理するサービス
 * - モデルアクセス制限
 * - ポイント残高チェック
 * - 履歴保持日数制限
 */

import {
  IndividualPlan,
  OrganizationPlan,
  AIModel,
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
  MODEL_CONSUMPTION_RATE,
  isLowBalanceForModel,
  getUpgradeRecommendation,
  getOutOfCreditsActions,
} from "@/config/plans";

// ============================================
// Types
// ============================================

export interface PlanContext {
  plan: IndividualPlan | OrganizationPlan;
  isOrganization: boolean;
  /** 月間プランポイント残高 */
  planPointsRemaining: number;
  /** 購入クレジット残高 */
  purchasedPointsRemaining: number;
  /** 組織メンバーの場合、割り当てポイント */
  allocatedPointsRemaining?: number;
  /** クレジット購入可能か（組織メンバーはfalse） */
  canPurchaseCredits: boolean;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  reasonJa?: string;
  /** 推奨アクション */
  suggestedAction?: "buy_credits" | "upgrade_plan" | "request_allocation";
}

export interface ModelAccessResult extends PermissionCheckResult {
  model: AIModel;
  /** このモデルでの残り会話回数 */
  remainingConversations?: number;
  /** 低残高警告 */
  lowBalanceWarning?: boolean;
}

export interface ConversationStartResult {
  allowed: boolean;
  reason?: string;
  reasonJa?: string;
  /** 使用可能なモデル一覧 */
  availableModels: AIModel[];
  /** 推奨モデル（残高を考慮） */
  recommendedModel: AIModel;
  /** 総残高（プラン + 購入） */
  totalPointsRemaining: number;
  /** 低残高警告 */
  lowBalanceWarning: boolean;
  /** ポイント不足時のアクション */
  outOfCreditsActions?: ReturnType<typeof getOutOfCreditsActions>;
}

// ============================================
// Permission Checks
// ============================================

/**
 * モデルがプランで利用可能かチェック
 */
export function checkModelAccess(
  context: PlanContext,
  model: AIModel
): ModelAccessResult {
  const config = context.isOrganization
    ? ORGANIZATION_PLANS[context.plan as OrganizationPlan]
    : INDIVIDUAL_PLANS[context.plan as IndividualPlan];

  // モデルアクセス権チェック
  if (!config.features.availableModels.includes(model)) {
    return {
      allowed: false,
      model,
      reason: `Model ${model} is not available in your plan`,
      reasonJa: `${model === "opus" ? "高性能モデル" : "標準モデル"}はこのプランでは利用できません`,
      suggestedAction: "upgrade_plan",
    };
  }

  // ポイント残高チェック
  const totalRemaining = getTotalRemainingPoints(context);
  const costPerConversation = MODEL_CONSUMPTION_RATE[model];

  if (totalRemaining < costPerConversation) {
    return {
      allowed: false,
      model,
      remainingConversations: 0,
      reason: "Insufficient points",
      reasonJa: "ポイントが不足しています",
      suggestedAction: context.canPurchaseCredits
        ? "buy_credits"
        : "request_allocation",
    };
  }

  const remainingConversations = Math.floor(totalRemaining / costPerConversation);
  const lowBalanceWarning = isLowBalanceForModel(totalRemaining, model);

  return {
    allowed: true,
    model,
    remainingConversations,
    lowBalanceWarning,
  };
}

/**
 * 会話を開始できるかチェック
 */
export function checkCanStartConversation(
  context: PlanContext
): ConversationStartResult {
  const config = context.isOrganization
    ? ORGANIZATION_PLANS[context.plan as OrganizationPlan]
    : INDIVIDUAL_PLANS[context.plan as IndividualPlan];

  const totalRemaining = getTotalRemainingPoints(context);
  const availableModels = config.features.availableModels;

  // 最も安いモデル（sonnet）でも会話できないか確認
  const minCost = Math.min(
    ...availableModels.map((m) => MODEL_CONSUMPTION_RATE[m])
  );

  if (totalRemaining < minCost) {
    return {
      allowed: false,
      reason: "No points remaining",
      reasonJa: "ポイントがありません",
      availableModels: [],
      recommendedModel: "sonnet",
      totalPointsRemaining: totalRemaining,
      lowBalanceWarning: true,
      outOfCreditsActions: getOutOfCreditsActions(
        context.plan,
        context.isOrganization,
        context.canPurchaseCredits
      ),
    };
  }

  // 利用可能なモデルをフィルタ（残高が足りるもの）
  const affordableModels = availableModels.filter(
    (m) => totalRemaining >= MODEL_CONSUMPTION_RATE[m]
  );

  // 推奨モデル：残高に余裕があればsonnet、なければ最安
  const recommendedModel = affordableModels.includes("sonnet")
    ? "sonnet"
    : affordableModels[0];

  const lowBalanceWarning = isLowBalanceForModel(totalRemaining, recommendedModel);

  return {
    allowed: true,
    availableModels: affordableModels,
    recommendedModel,
    totalPointsRemaining: totalRemaining,
    lowBalanceWarning,
    outOfCreditsActions: lowBalanceWarning
      ? getOutOfCreditsActions(
          context.plan,
          context.isOrganization,
          context.canPurchaseCredits
        )
      : undefined,
  };
}

/**
 * 履歴保持日数を取得
 */
export function getHistoryRetentionDays(context: PlanContext): number | null {
  const config = context.isOrganization
    ? ORGANIZATION_PLANS[context.plan as OrganizationPlan]
    : INDIVIDUAL_PLANS[context.plan as IndividualPlan];

  return config.features.historyRetentionDays;
}

/**
 * 優先サポートが利用可能かチェック
 */
export function hasPrioritySupport(context: PlanContext): boolean {
  const config = context.isOrganization
    ? ORGANIZATION_PLANS[context.plan as OrganizationPlan]
    : INDIVIDUAL_PLANS[context.plan as IndividualPlan];

  return config.features.prioritySupport;
}

// ============================================
// Point Calculation Helpers
// ============================================

/**
 * 総残りポイントを計算
 */
export function getTotalRemainingPoints(context: PlanContext): number {
  // 組織メンバーの場合は割り当てポイントのみ
  if (context.allocatedPointsRemaining !== undefined) {
    return context.allocatedPointsRemaining;
  }

  // 個人または組織管理者の場合
  return context.planPointsRemaining + context.purchasedPointsRemaining;
}

/**
 * 会話後のポイント消費を計算
 */
export function calculatePointConsumption(
  context: PlanContext,
  model: AIModel
): {
  totalCost: number;
  fromPlan: number;
  fromPurchased: number;
  fromAllocated: number;
} {
  const cost = MODEL_CONSUMPTION_RATE[model];

  // 組織メンバーの場合
  if (context.allocatedPointsRemaining !== undefined) {
    return {
      totalCost: cost,
      fromPlan: 0,
      fromPurchased: 0,
      fromAllocated: Math.min(cost, context.allocatedPointsRemaining),
    };
  }

  // プラン分を優先消費
  const fromPlan = Math.min(cost, context.planPointsRemaining);
  const remaining = cost - fromPlan;
  const fromPurchased = Math.min(remaining, context.purchasedPointsRemaining);

  return {
    totalCost: cost,
    fromPlan,
    fromPurchased,
    fromAllocated: 0,
  };
}

// ============================================
// Upsell / Recommendation Helpers
// ============================================

/**
 * アップグレード推奨メッセージを生成
 */
export function getUpgradeMessage(
  context: PlanContext,
  trigger: "out_of_credits" | "frequent_purchases" | "model_access"
): {
  title: string;
  titleJa: string;
  message: string;
  messageJa: string;
  upgradeRecommendation: ReturnType<typeof getUpgradeRecommendation>;
} | null {
  const recommendation = getUpgradeRecommendation(
    context.plan,
    context.isOrganization,
    trigger
  );

  if (!recommendation) return null;

  const nextPlanConfig = context.isOrganization
    ? ORGANIZATION_PLANS[recommendation.recommendedPlan as OrganizationPlan]
    : INDIVIDUAL_PLANS[recommendation.recommendedPlan as IndividualPlan];

  const titles = {
    out_of_credits: {
      en: "Need more conversation points?",
      ja: "もっと会話したいですか？",
    },
    frequent_purchases: {
      en: "Save with an upgraded plan",
      ja: "プランアップグレードでお得に",
    },
    model_access: {
      en: "Unlock high-performance AI",
      ja: "高性能AIを解放",
    },
  };

  const messages = {
    out_of_credits: {
      en: `Upgrade to ${nextPlanConfig.name} for ${recommendation.monthlyPointsGain} more points/month`,
      ja: `${nextPlanConfig.nameJa}にアップグレードで毎月${recommendation.monthlyPointsGain}pt追加`,
    },
    frequent_purchases: {
      en: `${nextPlanConfig.name} includes ${nextPlanConfig.features.monthlyConversationPoints} points/month`,
      ja: `${nextPlanConfig.nameJa}なら毎月${nextPlanConfig.features.monthlyConversationPoints}pt付与`,
    },
    model_access: {
      en: `${nextPlanConfig.name} unlocks high-performance models`,
      ja: `${nextPlanConfig.nameJa}で高性能モデルが利用可能に`,
    },
  };

  return {
    title: titles[trigger].en,
    titleJa: titles[trigger].ja,
    message: messages[trigger].en,
    messageJa: messages[trigger].ja,
    upgradeRecommendation: recommendation,
  };
}

/**
 * 低残高警告メッセージを生成
 */
export function getLowBalanceWarning(
  context: PlanContext,
  model: AIModel
): {
  title: string;
  titleJa: string;
  message: string;
  messageJa: string;
  remainingConversations: number;
} | null {
  const totalRemaining = getTotalRemainingPoints(context);
  const remainingConversations = Math.floor(
    totalRemaining / MODEL_CONSUMPTION_RATE[model]
  );

  if (remainingConversations >= 5) return null;

  return {
    title: "Low balance",
    titleJa: "残高が少なくなっています",
    message: `You have ${remainingConversations} conversations left`,
    messageJa: `残り約${remainingConversations}回の会話が可能です`,
    remainingConversations,
  };
}
