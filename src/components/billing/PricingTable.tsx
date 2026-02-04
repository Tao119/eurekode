"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PricingCard } from "./PricingCard";
import { Button } from "@/components/ui/button";
import {
  getAllIndividualPlans,
  getAllOrganizationPlans,
  IndividualPlan,
  OrganizationPlan,
} from "@/config/plans";
import { cn } from "@/lib/utils";

interface PricingTableProps {
  currentPlan?: IndividualPlan | OrganizationPlan;
  isOrganization?: boolean;
  showOrganizationPlans?: boolean;
}

export function PricingTable({
  currentPlan = "free",
  isOrganization = false,
  showOrganizationPlans = false,
}: PricingTableProps) {
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"individual" | "organization">(
    showOrganizationPlans ? "organization" : "individual"
  );

  const individualPlans = getAllIndividualPlans();
  const organizationPlans = getAllOrganizationPlans();

  const handleSelectPlan = async (planId: string) => {
    if (planId === "free") return;

    if (planId === "enterprise") {
      // Enterpriseはお問い合わせフォームへ
      router.push("/contact?plan=enterprise");
      return;
    }

    setIsLoading(planId);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          billingPeriod,
          isOrganization: activeTab === "organization",
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout failed:", data.error);
        alert("決済ページの作成に失敗しました");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* タブ切り替え */}
      {showOrganizationPlans && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border p-1">
            <Button
              variant={activeTab === "individual" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("individual")}
            >
              個人プラン
            </Button>
            <Button
              variant={activeTab === "organization" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("organization")}
            >
              組織プラン
            </Button>
          </div>
        </div>
      )}

      {/* 支払い期間切り替え */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border p-1">
          <Button
            variant={billingPeriod === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("monthly")}
          >
            月払い
          </Button>
          <Button
            variant={billingPeriod === "yearly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("yearly")}
            className="relative"
          >
            年払い
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              お得
            </span>
          </Button>
        </div>
      </div>

      {/* プランカード */}
      <div
        className={cn(
          "grid gap-6",
          activeTab === "individual"
            ? "md:grid-cols-2 lg:grid-cols-4"
            : "md:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {activeTab === "individual"
          ? individualPlans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={!isOrganization && currentPlan === plan.id}
                isPopular={plan.id === "pro"}
                billingPeriod={billingPeriod}
                onSelect={handleSelectPlan}
                isLoading={isLoading === plan.id}
              />
            ))
          : organizationPlans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                isOrganization
                isCurrentPlan={isOrganization && currentPlan === plan.id}
                isPopular={plan.id === "business"}
                billingPeriod={billingPeriod}
                onSelect={handleSelectPlan}
                isLoading={isLoading === plan.id}
              />
            ))}
      </div>

      {/* 注意書き */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          すべてのプランで全モード（解説・生成・壁打ち）が利用可能です。
          <br />
          いつでもプランの変更・キャンセルが可能です。
        </p>
      </div>
    </div>
  );
}
