/**
 * Eurecode Subscription Plans Configuration
 *
 * 個人プラン: free / starter / pro / max
 * 組織プラン: free / starter / business / enterprise
 *
 * モデル戦略: Sonnet基準、Opusは消費係数1.6倍
 * 利益率: 50%以上を維持
 */

// ============================================
// Types
// ============================================

export type IndividualPlan = "free" | "starter" | "pro" | "max";
export type OrganizationPlan = "free" | "starter" | "business" | "enterprise";

export type AIModel = "sonnet" | "opus";

export interface PlanFeatures {
  /** 月間会話ポイント上限（Sonnet基準） */
  monthlyConversationPoints: number;
  /** 利用可能なモデル */
  availableModels: AIModel[];
  /** 履歴保持日数（null = 無制限） */
  historyRetentionDays: number | null;
  /** 全モード利用可能 */
  allModesEnabled: true;
  /** 優先サポート */
  prioritySupport: boolean;
}

export interface IndividualPlanConfig {
  id: IndividualPlan;
  name: string;
  nameJa: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeatures;
  /** 推定APIコスト/月（内部計算用） */
  estimatedCostPerMonth: number;
}

export interface OrganizationPlanConfig {
  id: OrganizationPlan;
  name: string;
  nameJa: string;
  description: string;
  priceMonthly: number | null; // null = 応相談
  priceYearly: number | null;
  /** 最大メンバー数（null = 無制限） */
  maxMembers: number | null;
  features: PlanFeatures;
  /** 推定APIコスト/月（内部計算用） */
  estimatedCostPerMonth: number | null;
}

// ============================================
// コスト計算の前提
// ============================================
// Claude Sonnet 4.5: $3/MTok入力, $15/MTok出力 → 約¥1.6/会話
// Claude Opus 4.5: $5/MTok入力, $25/MTok出力 → 約¥2.6/会話
// Opus/Sonnet比率 = 2.6/1.6 ≈ 1.6倍
// 利益率50%維持 = 価格 ≥ コスト × 2

const COST_PER_CONVERSATION_SONNET = 1.6; // 円

/** モデルごとの消費係数（Sonnet基準） */
export const MODEL_CONSUMPTION_RATE: Record<AIModel, number> = {
  sonnet: 1.0,
  opus: 1.6,
};

/** モデルの表示名 */
export const MODEL_DISPLAY_NAMES: Record<AIModel, string> = {
  sonnet: "標準",
  opus: "高性能",
};

// ============================================
// Individual Plans
// ============================================

export const INDIVIDUAL_PLANS: Record<IndividualPlan, IndividualPlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    nameJa: "フリー",
    description: "プログラミング学習を始める方に",
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      monthlyConversationPoints: 30,
      availableModels: ["sonnet"], // Freeはsonnetのみ
      historyRetentionDays: 3,
      allModesEnabled: true,
      prioritySupport: false,
    },
    estimatedCostPerMonth: 30 * COST_PER_CONVERSATION_SONNET, // ¥48
  },
  starter: {
    id: "starter",
    name: "Starter",
    nameJa: "スターター",
    description: "継続的に学習を進めたい方に",
    priceMonthly: 980,
    priceYearly: 9800, // 2ヶ月分お得
    features: {
      monthlyConversationPoints: 300,
      availableModels: ["sonnet", "opus"], // StarterからOpus利用可能
      historyRetentionDays: 7,
      allModesEnabled: true,
      prioritySupport: false,
    },
    estimatedCostPerMonth: 300 * COST_PER_CONVERSATION_SONNET, // ¥480
  },
  pro: {
    id: "pro",
    name: "Pro",
    nameJa: "プロ",
    description: "本格的にスキルアップを目指す方に",
    priceMonthly: 2980,
    priceYearly: 29800, // 2ヶ月分お得
    features: {
      monthlyConversationPoints: 900,
      availableModels: ["sonnet", "opus"],
      historyRetentionDays: null, // 無制限
      allModesEnabled: true,
      prioritySupport: true,
    },
    estimatedCostPerMonth: 900 * COST_PER_CONVERSATION_SONNET, // ¥1,440
  },
  max: {
    id: "max",
    name: "Max",
    nameJa: "マックス",
    description: "学習を最大限に活用したい方に",
    priceMonthly: 9800,
    priceYearly: 98000, // 2ヶ月分お得
    features: {
      monthlyConversationPoints: 3000,
      availableModels: ["sonnet", "opus"],
      historyRetentionDays: null, // 無制限
      allModesEnabled: true,
      prioritySupport: true,
    },
    estimatedCostPerMonth: 3000 * COST_PER_CONVERSATION_SONNET, // ¥4,800
  },
};

// ============================================
// Organization Plans
// ============================================

export const ORGANIZATION_PLANS: Record<
  OrganizationPlan,
  OrganizationPlanConfig
> = {
  free: {
    id: "free",
    name: "Free",
    nameJa: "フリー",
    description: "チームでのお試し利用に",
    priceMonthly: 0,
    priceYearly: 0,
    maxMembers: 3,
    features: {
      monthlyConversationPoints: 100, // 組織全体
      availableModels: ["sonnet"], // Freeはsonnetのみ
      historyRetentionDays: 3,
      allModesEnabled: true,
      prioritySupport: false,
    },
    estimatedCostPerMonth: 100 * COST_PER_CONVERSATION_SONNET, // ¥160
  },
  starter: {
    id: "starter",
    name: "Starter",
    nameJa: "スターター",
    description: "小規模チーム・スタートアップ研修に",
    priceMonthly: 15000,
    priceYearly: 150000, // 2ヶ月分お得
    maxMembers: 10,
    features: {
      monthlyConversationPoints: 5000, // 組織全体
      availableModels: ["sonnet", "opus"], // StarterからOpus利用可能
      historyRetentionDays: 30,
      allModesEnabled: true,
      prioritySupport: false,
    },
    estimatedCostPerMonth: 5000 * COST_PER_CONVERSATION_SONNET, // ¥8,000
  },
  business: {
    id: "business",
    name: "Business",
    nameJa: "ビジネス",
    description: "企業研修・教育機関に",
    priceMonthly: 50000,
    priceYearly: 500000, // 2ヶ月分お得
    maxMembers: 50,
    features: {
      monthlyConversationPoints: 15000, // 組織全体
      availableModels: ["sonnet", "opus"], // BusinessからOpus利用可能
      historyRetentionDays: null, // 無制限
      allModesEnabled: true,
      prioritySupport: true,
    },
    estimatedCostPerMonth: 15000 * COST_PER_CONVERSATION_SONNET, // ¥24,000
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    nameJa: "エンタープライズ",
    description: "大規模組織向けカスタムプラン",
    priceMonthly: null, // 応相談
    priceYearly: null,
    maxMembers: null, // 無制限
    features: {
      monthlyConversationPoints: -1, // カスタム（-1 = 要相談）
      availableModels: ["sonnet", "opus"],
      historyRetentionDays: null, // 無制限
      allModesEnabled: true,
      prioritySupport: true,
    },
    estimatedCostPerMonth: null, // カスタム
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * 個人プランの設定を取得
 */
export function getIndividualPlan(plan: IndividualPlan): IndividualPlanConfig {
  return INDIVIDUAL_PLANS[plan];
}

/**
 * 組織プランの設定を取得
 */
export function getOrganizationPlan(
  plan: OrganizationPlan
): OrganizationPlanConfig {
  return ORGANIZATION_PLANS[plan];
}

/**
 * モデルが利用可能かチェック
 */
export function isModelAvailable(
  plan: IndividualPlan | OrganizationPlan,
  model: AIModel,
  isOrganization: boolean = false
): boolean {
  const config = isOrganization
    ? ORGANIZATION_PLANS[plan as OrganizationPlan]
    : INDIVIDUAL_PLANS[plan as IndividualPlan];

  return config.features.availableModels.includes(model);
}

/**
 * 月間会話ポイント上限を取得
 */
export function getMonthlyConversationPoints(
  plan: IndividualPlan | OrganizationPlan,
  isOrganization: boolean = false
): number {
  const config = isOrganization
    ? ORGANIZATION_PLANS[plan as OrganizationPlan]
    : INDIVIDUAL_PLANS[plan as IndividualPlan];

  return config.features.monthlyConversationPoints;
}

/**
 * モデル使用時の消費ポイントを計算
 */
export function calculateConversationCost(model: AIModel): number {
  return MODEL_CONSUMPTION_RATE[model];
}

/**
 * 残りポイントで何回会話できるか計算
 */
export function calculateRemainingConversations(
  remainingPoints: number,
  model: AIModel
): number {
  const rate = MODEL_CONSUMPTION_RATE[model];
  return Math.floor(remainingPoints / rate);
}

/**
 * 履歴保持日数を取得（無制限の場合はnull）
 */
export function getHistoryRetentionDays(
  plan: IndividualPlan | OrganizationPlan,
  isOrganization: boolean = false
): number | null {
  const config = isOrganization
    ? ORGANIZATION_PLANS[plan as OrganizationPlan]
    : INDIVIDUAL_PLANS[plan as IndividualPlan];

  return config.features.historyRetentionDays;
}

/**
 * 価格をフォーマット（日本円）
 */
export function formatPrice(price: number | null): string {
  if (price === null) return "応相談";
  if (price === 0) return "無料";
  return `¥${price.toLocaleString()}`;
}

/**
 * 会話ポイントをフォーマット
 */
export function formatConversationPoints(points: number): string {
  if (points === -1) return "カスタム";
  return `${points.toLocaleString()}pt/月`;
}

/**
 * 全個人プランを配列で取得（価格順）
 */
export function getAllIndividualPlans(): IndividualPlanConfig[] {
  return Object.values(INDIVIDUAL_PLANS).sort(
    (a, b) => a.priceMonthly - b.priceMonthly
  );
}

/**
 * 全組織プランを配列で取得（価格順）
 */
export function getAllOrganizationPlans(): OrganizationPlanConfig[] {
  return Object.values(ORGANIZATION_PLANS).sort((a, b) => {
    if (a.priceMonthly === null) return 1;
    if (b.priceMonthly === null) return -1;
    return a.priceMonthly - b.priceMonthly;
  });
}

/**
 * プランの利益率を計算（内部用）
 */
export function calculateProfitMargin(
  plan: IndividualPlan | OrganizationPlan,
  isOrganization: boolean = false
): number | null {
  const config = isOrganization
    ? ORGANIZATION_PLANS[plan as OrganizationPlan]
    : INDIVIDUAL_PLANS[plan as IndividualPlan];

  if (config.priceMonthly === null || config.estimatedCostPerMonth === null) {
    return null;
  }

  if (config.priceMonthly === 0) return -100; // Free plan

  const profit = config.priceMonthly - config.estimatedCostPerMonth;
  return (profit / config.priceMonthly) * 100;
}

// ============================================
// Credit Pack System
// ============================================

export interface CreditPack {
  id: string;
  name: string;
  nameJa: string;
  points: number;
  price: number;
  /** ポイント単価（円/pt） */
  unitPrice: number;
  /** お得率（%）- 基準パックとの比較 */
  discount: number;
  /** 推奨フラグ */
  recommended?: boolean;
}

/** 最小購入金額 */
export const CREDIT_MIN_PURCHASE_AMOUNT = 300;

/** カスタム購入時のポイント単価（円/pt） */
export const CREDIT_CUSTOM_UNIT_PRICE = 3.0;

/** 低残高アラートの閾値（会話回数相当） */
export const LOW_BALANCE_THRESHOLD_CONVERSATIONS = 5;

/** クレジットパック定義 */
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "small",
    name: "Small",
    nameJa: "スモール",
    points: 100,
    price: 300,
    unitPrice: 3.0,
    discount: 0,
  },
  {
    id: "medium",
    name: "Medium",
    nameJa: "ミディアム",
    points: 500,
    price: 1200,
    unitPrice: 2.4,
    discount: 20,
    recommended: true,
  },
  {
    id: "large",
    name: "Large",
    nameJa: "ラージ",
    points: 1500,
    price: 3000,
    unitPrice: 2.0,
    discount: 33,
  },
];

/**
 * カスタム金額からポイントを計算
 */
export function calculatePointsFromAmount(amount: number): number {
  if (amount < CREDIT_MIN_PURCHASE_AMOUNT) {
    return 0;
  }
  return Math.floor(amount / CREDIT_CUSTOM_UNIT_PRICE);
}

/**
 * 低残高かどうかチェック（Sonnet基準で5会話分以下）
 */
export function isLowBalance(remainingPoints: number): boolean {
  return remainingPoints < LOW_BALANCE_THRESHOLD_CONVERSATIONS;
}

/**
 * 低残高かどうかチェック（指定モデル基準）
 */
export function isLowBalanceForModel(
  remainingPoints: number,
  model: AIModel
): boolean {
  const conversationsLeft = calculateRemainingConversations(
    remainingPoints,
    model
  );
  return conversationsLeft < LOW_BALANCE_THRESHOLD_CONVERSATIONS;
}

/**
 * クレジットパックを取得
 */
export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === packId);
}

/**
 * 推奨クレジットパックを取得
 */
export function getRecommendedCreditPack(): CreditPack {
  return CREDIT_PACKS.find((pack) => pack.recommended) || CREDIT_PACKS[0];
}

// ============================================
// Plan Upgrade Recommendations
// ============================================

export interface UpgradeRecommendation {
  currentPlan: IndividualPlan | OrganizationPlan;
  recommendedPlan: IndividualPlan | OrganizationPlan;
  reason: string;
  reasonJa: string;
  monthlyPointsGain: number;
  priceIncrease: number;
}

/**
 * 次の上位プランを取得（個人）
 */
export function getNextIndividualPlan(
  currentPlan: IndividualPlan
): IndividualPlan | null {
  const planOrder: IndividualPlan[] = ["free", "starter", "pro", "max"];
  const currentIndex = planOrder.indexOf(currentPlan);
  if (currentIndex === -1 || currentIndex >= planOrder.length - 1) {
    return null;
  }
  return planOrder[currentIndex + 1];
}

/**
 * 次の上位プランを取得（組織）
 */
export function getNextOrganizationPlan(
  currentPlan: OrganizationPlan
): OrganizationPlan | null {
  const planOrder: OrganizationPlan[] = [
    "free",
    "starter",
    "business",
    "enterprise",
  ];
  const currentIndex = planOrder.indexOf(currentPlan);
  if (currentIndex === -1 || currentIndex >= planOrder.length - 1) {
    return null;
  }
  return planOrder[currentIndex + 1];
}

/**
 * プランアップグレードの推奨を生成
 */
export function getUpgradeRecommendation(
  currentPlan: IndividualPlan | OrganizationPlan,
  isOrganization: boolean = false,
  reason: "out_of_credits" | "frequent_purchases" | "model_access" = "out_of_credits"
): UpgradeRecommendation | null {
  const nextPlan = isOrganization
    ? getNextOrganizationPlan(currentPlan as OrganizationPlan)
    : getNextIndividualPlan(currentPlan as IndividualPlan);

  if (!nextPlan) return null;

  const currentConfig = isOrganization
    ? ORGANIZATION_PLANS[currentPlan as OrganizationPlan]
    : INDIVIDUAL_PLANS[currentPlan as IndividualPlan];

  const nextConfig = isOrganization
    ? ORGANIZATION_PLANS[nextPlan as OrganizationPlan]
    : INDIVIDUAL_PLANS[nextPlan as IndividualPlan];

  const currentPrice = currentConfig.priceMonthly ?? 0;
  const nextPrice = nextConfig.priceMonthly ?? 0;

  const reasons = {
    out_of_credits: {
      en: "You've run out of conversation points",
      ja: "会話ポイントを使い切りました",
    },
    frequent_purchases: {
      en: "You're purchasing credits frequently",
      ja: "クレジットを頻繁に購入されています",
    },
    model_access: {
      en: "Unlock access to high-performance models",
      ja: "高性能モデルが利用可能になります",
    },
  };

  return {
    currentPlan,
    recommendedPlan: nextPlan,
    reason: reasons[reason].en,
    reasonJa: reasons[reason].ja,
    monthlyPointsGain:
      nextConfig.features.monthlyConversationPoints -
      currentConfig.features.monthlyConversationPoints,
    priceIncrease: nextPrice - currentPrice,
  };
}

/**
 * ポイント不足時のアクション提案を生成
 */
export function getOutOfCreditsActions(
  currentPlan: IndividualPlan | OrganizationPlan,
  isOrganization: boolean = false,
  canPurchaseCredits: boolean = true
): {
  canBuyCredits: boolean;
  canUpgrade: boolean;
  recommendedPack: CreditPack | null;
  upgradeRecommendation: UpgradeRecommendation | null;
} {
  const upgradeRecommendation = getUpgradeRecommendation(
    currentPlan,
    isOrganization,
    "out_of_credits"
  );

  return {
    canBuyCredits: canPurchaseCredits,
    canUpgrade: upgradeRecommendation !== null,
    recommendedPack: canPurchaseCredits ? getRecommendedCreditPack() : null,
    upgradeRecommendation,
  };
}
