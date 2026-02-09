/**
 * Point Consumption Service
 *
 * ポイント消費・残高管理サービス
 * - ポイント残高確認
 * - ポイント消費（会話時）
 * - 残高リセット（月初）
 */

import { prisma } from "@/lib/prisma";
import {
  AIModel,
  MODEL_CONSUMPTION_RATE,
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
  IndividualPlan,
  OrganizationPlan,
  isLowBalanceForModel,
} from "@/config/plans";

// ============================================
// Types
// ============================================

export interface PointBalance {
  /** プラン付与ポイント（月間） */
  planTotal: number;
  /** プラン使用済みポイント */
  planUsed: number;
  /** プラン残高 */
  planRemaining: number;
  /** 購入クレジット残高 */
  purchasedBalance: number;
  /** 購入クレジット使用済み */
  purchasedUsed: number;
  /** 購入クレジット残高 */
  purchasedRemaining: number;
  /** 割り当てポイント（組織メンバーのみ） */
  allocated?: number;
  /** 割り当て使用済み */
  allocatedUsed?: number;
  /** 割り当て残高 */
  allocatedRemaining?: number;
  /** 総残高 */
  totalRemaining: number;
  /** 期間 */
  periodStart: Date;
  periodEnd: Date;
}

export interface ConsumePointsResult {
  success: boolean;
  error?: string;
  errorJa?: string;
  /** 消費したポイント */
  consumed?: number;
  /** 消費後の残高 */
  remainingBalance?: number;
  /** 低残高警告 */
  lowBalanceWarning?: boolean;
}

// ============================================
// Balance Management
// ============================================

/**
 * ユーザーのポイント残高を取得
 */
export async function getPointBalance(
  userId: string,
  organizationId?: string | null
): Promise<PointBalance | null> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // ユーザーとサブスクリプション情報を取得
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      creditBalance: true,
      organization: {
        include: {
          subscription: true,
          creditBalance: true,
        },
      },
    },
  });

  if (!user) return null;

  // 組織ユーザー（メンバーまたは管理者）かどうか
  const isOrgUser = (user.userType === "member" || user.userType === "admin") && user.organization;
  // 組織メンバー（割り当て制を使用）かどうか - 管理者は除く
  const isOrgMember = user.userType === "member" && user.organization;

  // プランのポイント上限を取得
  let planTotal = 0;
  if (isOrgUser && user.organization) {
    // 組織ユーザー（管理者含む）は組織プランのポイントを使用
    const orgPlan = user.organization.plan;
    planTotal = ORGANIZATION_PLANS[orgPlan].features.monthlyConversationPoints;
  } else if (user.subscription?.individualPlan) {
    planTotal = INDIVIDUAL_PLANS[user.subscription.individualPlan].features
      .monthlyConversationPoints;
  } else {
    planTotal = INDIVIDUAL_PLANS.free.features.monthlyConversationPoints;
  }

  // クレジット残高を取得または作成
  // 組織ユーザー（管理者含む）は組織のcreditBalanceを使用
  let creditBalance = isOrgUser
    ? user.organization?.creditBalance
    : user.creditBalance;

  // 期間が過ぎている場合はリセット
  if (creditBalance && creditBalance.periodEnd < now) {
    creditBalance = await prisma.creditBalance.update({
      where: { id: creditBalance.id },
      data: {
        monthlyUsed: 0,
        purchasedUsed: 0,
        periodStart: monthStart,
        periodEnd: monthEnd,
      },
    });
  }

  const planUsed = creditBalance?.monthlyUsed ?? 0;
  const purchasedBalance = creditBalance?.balance ?? 0;
  const purchasedUsed = creditBalance?.purchasedUsed ?? 0;

  // 組織メンバーの場合は割り当てを確認
  // 割り当てがない場合は0ポイント（組織のプールではなく個別割り当て制）
  let allocated: number | undefined;
  let allocatedUsed: number | undefined;
  let allocatedRemaining: number | undefined;

  if (isOrgMember && organizationId) {
    const allocation = await prisma.creditAllocation.findFirst({
      where: {
        organizationId,
        userId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
    });

    if (allocation) {
      allocated = allocation.allocatedPoints;
      allocatedUsed = allocation.usedPoints;
      allocatedRemaining = Math.max(0, allocated - allocatedUsed);
    } else {
      // 割り当てがない場合は0ポイント
      allocated = 0;
      allocatedUsed = 0;
      allocatedRemaining = 0;
    }
  } else if (isOrgMember && !organizationId) {
    // organizationIdが渡されていない場合も確認
    // userのorganizationIdを使用
    const allocation = await prisma.creditAllocation.findFirst({
      where: {
        organizationId: user.organizationId!,
        userId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
    });

    if (allocation) {
      allocated = allocation.allocatedPoints;
      allocatedUsed = allocation.usedPoints;
      allocatedRemaining = Math.max(0, allocated - allocatedUsed);
    } else {
      // 割り当てがない場合は0ポイント
      allocated = 0;
      allocatedUsed = 0;
      allocatedRemaining = 0;
    }
  }

  const planRemaining = Math.max(0, planTotal - planUsed);
  const purchasedRemaining = Math.max(0, purchasedBalance - purchasedUsed);

  // 総残高の計算
  let totalRemaining: number;
  if (allocated !== undefined) {
    // 組織メンバーは割り当てのみ
    totalRemaining = allocatedRemaining ?? 0;
  } else {
    // 個人または組織管理者はプラン + 購入
    totalRemaining = planRemaining + purchasedRemaining;
  }

  return {
    planTotal,
    planUsed,
    planRemaining,
    purchasedBalance,
    purchasedUsed,
    purchasedRemaining,
    allocated,
    allocatedUsed,
    allocatedRemaining,
    totalRemaining,
    periodStart: creditBalance?.periodStart ?? monthStart,
    periodEnd: creditBalance?.periodEnd ?? monthEnd,
  };
}

/**
 * 会話に必要なポイントがあるかチェック
 */
export async function canStartConversation(
  userId: string,
  model: AIModel,
  organizationId?: string | null
): Promise<{ allowed: boolean; reason?: string; reasonJa?: string }> {
  const balance = await getPointBalance(userId, organizationId);

  if (!balance) {
    return {
      allowed: false,
      reason: "User not found",
      reasonJa: "ユーザーが見つかりません",
    };
  }

  const cost = MODEL_CONSUMPTION_RATE[model];

  if (balance.totalRemaining < cost) {
    return {
      allowed: false,
      reason: "Insufficient points",
      reasonJa: "ポイントが不足しています",
    };
  }

  return { allowed: true };
}

// ============================================
// Token-based Point Calculation
// ============================================

/** 最小消費ポイント（どんな短い応答でもこの値以上を消費） */
const MIN_POINTS = 0.3;

/** ポイント最大時のトークン閾値（この値以上は最大ポイント消費） */
const MAX_TOKENS_THRESHOLD = 1000;

/**
 * トークン使用量からポイント消費量を計算
 * - 短いレスポンス（少ないトークン）でも最低 0.3pt を消費
 * - 1000トークン以上で最大ポイント到達
 * - Sonnet max: 1.0pt, Opus max: 1.6pt
 */
export function calculatePointsFromTokens(
  tokensUsed: number,
  model: AIModel
): number {
  const maxPoints = MODEL_CONSUMPTION_RATE[model];

  if (tokensUsed <= 0) return MIN_POINTS;

  // 線形補間: MIN_POINTS → maxPoints（0〜MAX_TOKENS_THRESHOLD）
  const ratio = Math.min(tokensUsed / MAX_TOKENS_THRESHOLD, 1);
  const points = MIN_POINTS + (maxPoints - MIN_POINTS) * ratio;

  // 小数点第2位で四捨五入
  return Math.round(points * 100) / 100;
}

// ============================================
// Point Consumption
// ============================================

/**
 * ポイントを消費（会話完了時に呼び出し）
 * @param tokensUsed - 実際に使用したトークン数（指定しない場合は最大消費）
 */
export async function consumePoints(
  userId: string,
  model: AIModel,
  conversationId?: string,
  organizationId?: string | null,
  tokensUsed?: number
): Promise<ConsumePointsResult> {
  // トークン数が指定されていれば段階的計算、なければ最大消費
  const cost = tokensUsed !== undefined
    ? calculatePointsFromTokens(tokensUsed, model)
    : MODEL_CONSUMPTION_RATE[model];

  // 残高チェック
  const balance = await getPointBalance(userId, organizationId);
  if (!balance) {
    return {
      success: false,
      error: "User not found",
      errorJa: "ユーザーが見つかりません",
    };
  }

  if (balance.totalRemaining < cost) {
    return {
      success: false,
      error: "Insufficient points",
      errorJa: "ポイントが不足しています",
    };
  }

  // 組織メンバー（割り当て制）かどうか
  const isOrgMember = balance.allocated !== undefined;
  // 組織管理者かどうか（organizationIdがあるが割り当てがない = 管理者）
  const isOrgAdmin = organizationId && !isOrgMember;

  try {
    // トランザクションでポイント消費
    await prisma.$transaction(async (tx) => {
      if (isOrgMember && organizationId) {
        // 組織メンバー: 割り当てから消費
        await tx.creditAllocation.updateMany({
          where: {
            organizationId,
            userId,
            periodStart: { lte: new Date() },
            periodEnd: { gte: new Date() },
          },
          data: {
            usedPoints: { increment: cost },
          },
        });
      } else if (isOrgAdmin) {
        // 組織管理者: 組織のcreditBalanceから消費
        const creditBalance = await tx.creditBalance.findUnique({
          where: { organizationId },
        });

        if (creditBalance) {
          const fromPlan = Math.min(cost, balance.planRemaining);
          const fromPurchased = cost - fromPlan;

          await tx.creditBalance.update({
            where: { organizationId },
            data: {
              monthlyUsed: { increment: fromPlan },
              purchasedUsed: fromPurchased > 0 ? { increment: fromPurchased } : undefined,
            },
          });
        } else {
          // 組織のCreditBalanceがない場合は作成
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

          await tx.creditBalance.create({
            data: {
              organizationId,
              balance: 0,
              monthlyUsed: cost,
              purchasedUsed: 0,
              periodStart: monthStart,
              periodEnd: monthEnd,
            },
          });
        }
      } else {
        // 個人ユーザー: 個人のcreditBalanceから消費
        const creditBalance = await tx.creditBalance.findUnique({
          where: { userId },
        });

        if (creditBalance) {
          const fromPlan = Math.min(cost, balance.planRemaining);
          const fromPurchased = cost - fromPlan;

          await tx.creditBalance.update({
            where: { userId },
            data: {
              monthlyUsed: { increment: fromPlan },
              purchasedUsed: fromPurchased > 0 ? { increment: fromPurchased } : undefined,
            },
          });
        } else {
          // CreditBalanceがない場合は作成
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

          await tx.creditBalance.create({
            data: {
              userId,
              balance: 0,
              monthlyUsed: cost,
              purchasedUsed: 0,
              periodStart: monthStart,
              periodEnd: monthEnd,
            },
          });
        }
      }

      // 使用履歴を記録
      await tx.pointUsage.create({
        data: {
          userId,
          organizationId,
          conversationId,
          model,
          pointsUsed: cost,
          fromPlan: !isOrgMember && balance.planRemaining >= cost,
        },
      });
    });

    const newBalance = balance.totalRemaining - cost;
    const lowBalanceWarning = isLowBalanceForModel(newBalance, model);

    return {
      success: true,
      consumed: cost,
      remainingBalance: newBalance,
      lowBalanceWarning,
    };
  } catch (error) {
    console.error("Point consumption error:", error);
    return {
      success: false,
      error: "Failed to consume points",
      errorJa: "ポイントの消費に失敗しました",
    };
  }
}

// ============================================
// Model Access Check
// ============================================

/**
 * モデルが利用可能かチェック
 */
export async function isModelAccessible(
  userId: string,
  model: AIModel
): Promise<{ allowed: boolean; reason?: string; reasonJa?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      organization: true,
    },
  });

  if (!user) {
    return {
      allowed: false,
      reason: "User not found",
      reasonJa: "ユーザーが見つかりません",
    };
  }

  let availableModels: AIModel[];

  if ((user.userType === "member" || user.userType === "admin") && user.organization) {
    // 組織メンバーまたは管理者
    const orgPlan = user.organization.plan;
    availableModels = ORGANIZATION_PLANS[orgPlan].features.availableModels;
  } else if (user.subscription?.individualPlan) {
    // 個人有料プラン
    availableModels =
      INDIVIDUAL_PLANS[user.subscription.individualPlan].features.availableModels;
  } else {
    // Freeプラン
    availableModels = INDIVIDUAL_PLANS.free.features.availableModels;
  }

  if (!availableModels.includes(model)) {
    return {
      allowed: false,
      reason: `Model ${model} is not available in your plan`,
      reasonJa:
        model === "opus"
          ? "高性能モデルはこのプランでは利用できません"
          : "このモデルは利用できません",
    };
  }

  return { allowed: true };
}

/**
 * 利用可能なモデル一覧を取得
 */
export async function getAvailableModels(userId: string): Promise<AIModel[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      organization: true,
    },
  });

  if (!user) return ["sonnet"];

  if ((user.userType === "member" || user.userType === "admin") && user.organization) {
    // 組織メンバーまたは管理者
    return ORGANIZATION_PLANS[user.organization.plan].features.availableModels;
  }

  if (user.subscription?.individualPlan) {
    return INDIVIDUAL_PLANS[user.subscription.individualPlan].features
      .availableModels;
  }

  return INDIVIDUAL_PLANS.free.features.availableModels;
}

// ============================================
// Monthly Reset (Cron Job)
// ============================================

/**
 * 月初の残高リセット（Cronジョブから呼び出し）
 */
export async function resetMonthlyUsage(): Promise<{
  usersReset: number;
  orgsReset: number;
}> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 期間が過ぎたクレジット残高をリセット
  const result = await prisma.creditBalance.updateMany({
    where: {
      periodEnd: { lt: now },
    },
    data: {
      monthlyUsed: 0,
      purchasedUsed: 0,
      periodStart: monthStart,
      periodEnd: monthEnd,
    },
  });

  // 期間が過ぎた割り当てをリセット
  const allocationsResult = await prisma.creditAllocation.updateMany({
    where: {
      periodEnd: { lt: now },
    },
    data: {
      usedPoints: 0,
      periodStart: monthStart,
      periodEnd: monthEnd,
    },
  });

  return {
    usersReset: result.count,
    orgsReset: allocationsResult.count,
  };
}
