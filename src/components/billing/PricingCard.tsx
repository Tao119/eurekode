"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  IndividualPlanConfig,
  OrganizationPlanConfig,
  formatPrice,
} from "@/config/plans";

interface PricingCardProps {
  plan: IndividualPlanConfig | OrganizationPlanConfig;
  isOrganization?: boolean;
  isCurrentPlan?: boolean;
  isPopular?: boolean;
  billingPeriod: "monthly" | "yearly";
  onSelect: (planId: string) => void;
  isLoading?: boolean;
}

export function PricingCard({
  plan,
  isOrganization = false,
  isCurrentPlan = false,
  isPopular = false,
  billingPeriod,
  onSelect,
  isLoading = false,
}: PricingCardProps) {
  const price =
    billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;
  const monthlyEquivalent =
    billingPeriod === "yearly" && plan.priceYearly
      ? Math.round(plan.priceYearly / 12)
      : plan.priceMonthly;

  const isEnterprise = plan.id === "enterprise";
  const isFree = plan.id === "free";

  // 組織プランの場合、メンバー数制限を取得
  const maxMembers = isOrganization
    ? (plan as OrganizationPlanConfig).maxMembers
    : null;

  // 機能リスト (memoized to avoid recreation on every render)
  const features = useMemo(() => [
    `AIモデル: ${plan.features.availableModels.join(", ").toUpperCase()}`,
    plan.features.historyRetentionDays === null
      ? "履歴保持: 無制限"
      : `履歴保持: ${plan.features.historyRetentionDays}日`,
    "全モード利用可能",
    ...(isOrganization && maxMembers
      ? [`最大${maxMembers}名まで`]
      : isOrganization && !maxMembers
        ? ["メンバー数無制限"]
        : []),
  ], [plan.features.availableModels, plan.features.historyRetentionDays, isOrganization, maxMembers]);

  return (
    <Card
      className={cn(
        "relative flex flex-col",
        isPopular && "border-primary shadow-lg",
        isCurrentPlan && "border-green-500"
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
            おすすめ
          </span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-green-500 text-white text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
            現在のプラン
          </span>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="text-center mb-6">
          {isEnterprise ? (
            <div className="text-3xl font-bold">応相談</div>
          ) : (
            <>
              <div className="text-4xl font-bold">
                {formatPrice(monthlyEquivalent)}
                {!isFree && <span className="text-base font-normal">/月</span>}
              </div>
              {billingPeriod === "yearly" && !isFree && price !== null && (
                <p className="text-sm text-muted-foreground mt-1">
                  年額 {formatPrice(price)}（2ヶ月分お得）
                </p>
              )}
            </>
          )}
        </div>

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={isPopular ? "default" : "outline"}
          disabled={isCurrentPlan || isLoading || isFree}
          onClick={() => onSelect(plan.id)}
        >
          {isLoading
            ? "処理中..."
            : isCurrentPlan
              ? "現在のプラン"
              : isFree
                ? "無料で利用中"
                : isEnterprise
                  ? "お問い合わせ"
                  : "このプランを選択"}
        </Button>
      </CardFooter>
    </Card>
  );
}
