"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Zap,
  CreditCard,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  CREDIT_PACKS,
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
  formatPrice,
  IndividualPlan,
  OrganizationPlan,
  getNextIndividualPlan,
  getNextOrganizationPlan,
} from "@/config/plans";

interface OutOfCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 残りポイント */
  remainingPoints: number;
  /** 残り会話回数（Sonnet基準） */
  remainingConversations: number;
  /** 現在のプラン */
  currentPlan: IndividualPlan | OrganizationPlan;
  /** 組織プランか */
  isOrganization: boolean;
  /** 組織メンバーか（購入不可） */
  isOrganizationMember: boolean;
  /** 完全にポイントがないか */
  isCompletelyOut?: boolean;
}

export function OutOfCreditsModal({
  open,
  onOpenChange,
  remainingPoints,
  remainingConversations,
  currentPlan,
  isOrganization,
  isOrganizationMember,
  isCompletelyOut = false,
}: OutOfCreditsModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"credits" | "upgrade">("credits");

  const canPurchaseCredits = !isOrganizationMember;
  const canUpgrade = !isOrganization || (isOrganization && !isOrganizationMember);

  // 次のプランを取得
  const nextPlan = isOrganization
    ? getNextOrganizationPlan(currentPlan as OrganizationPlan)
    : getNextIndividualPlan(currentPlan as IndividualPlan);

  const currentPlanConfig = isOrganization
    ? ORGANIZATION_PLANS[currentPlan as OrganizationPlan]
    : INDIVIDUAL_PLANS[currentPlan as IndividualPlan];

  const nextPlanConfig = nextPlan
    ? isOrganization
      ? ORGANIZATION_PLANS[nextPlan as OrganizationPlan]
      : INDIVIDUAL_PLANS[nextPlan as IndividualPlan]
    : null;

  const handlePurchaseCredits = async (packId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.errorJa || "決済ページの作成に失敗しました");
      }
    } catch (error) {
      console.error("Purchase error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!nextPlan) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: nextPlan,
          billingPeriod: "monthly",
          isOrganization,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("決済ページの作成に失敗しました");
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAllocation = () => {
    router.push("/settings/credits/request");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {isCompletelyOut ? "ポイントがありません" : "ポイントが残りわずかです"}
              </DialogTitle>
              <DialogDescription>
                {isCompletelyOut
                  ? "会話を続けるにはポイントが必要です"
                  : `残り約${remainingConversations}回の会話が可能です`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 組織メンバーの場合 */}
        {isOrganizationMember && (
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-2">ポイントをリクエストしてください</h3>
              <p className="text-sm text-muted-foreground mb-4">
                組織メンバーは直接クレジットを購入できません。
                <br />
                管理者にポイントの追加割り当てをリクエストしてください。
              </p>
              <Button onClick={handleRequestAllocation} className="w-full">
                <Users className="h-4 w-4 mr-2" />
                ポイントをリクエスト
              </Button>
            </div>
          </div>
        )}

        {/* 個人または組織管理者の場合 */}
        {!isOrganizationMember && (
          <>
            {/* タブ切り替え */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab("credits")}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "credits"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <CreditCard className="h-4 w-4 inline mr-2" />
                クレジット購入
              </button>
              {nextPlanConfig && (
                <button
                  onClick={() => setActiveTab("upgrade")}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "upgrade"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Zap className="h-4 w-4 inline mr-2" />
                  プランアップグレード
                </button>
              )}
            </div>

            {/* クレジット購入タブ */}
            {activeTab === "credits" && (
              <div className="py-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  追加のポイントを購入して会話を続けましょう
                </p>
                {CREDIT_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => handlePurchaseCredits(pack.id)}
                    disabled={isLoading}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
                      pack.recommended ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{pack.nameJa}</span>
                          {pack.recommended && (
                            <Badge variant="default" className="text-xs">
                              おすすめ
                            </Badge>
                          )}
                          {pack.discount > 0 && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              {pack.discount}%お得
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pack.points.toLocaleString()}ポイント
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">{formatPrice(pack.price)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* アップグレードタブ */}
            {activeTab === "upgrade" && nextPlanConfig && (
              <div className="py-4">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="font-medium">おすすめ</span>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">現在のプラン</p>
                      <p className="font-medium">{currentPlanConfig.nameJa}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">アップグレード先</p>
                      <p className="font-medium text-primary">{nextPlanConfig.nameJa}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span>月間ポイント</span>
                      <span className="font-medium text-green-600">
                        {currentPlanConfig.features.monthlyConversationPoints.toLocaleString()}pt
                        <ArrowRight className="h-3 w-3 inline mx-1" />
                        {nextPlanConfig.features.monthlyConversationPoints.toLocaleString()}pt
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>月額料金</span>
                      <span className="font-medium">
                        {formatPrice(nextPlanConfig.priceMonthly)}/月
                      </span>
                    </div>
                    {nextPlanConfig.features.availableModels.includes("opus") &&
                      !currentPlanConfig.features.availableModels.includes("opus") && (
                        <div className="flex justify-between text-green-600">
                          <span>高性能モデル</span>
                          <span>利用可能に</span>
                        </div>
                      )}
                  </div>

                  <Button
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {nextPlanConfig.nameJa}にアップグレード
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center mt-3">
                  クレジット購入より月額プランの方がお得です
                </p>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            後で
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ポイント不足時のインラインメッセージ（チャット内表示用）
 */
export function OutOfCreditsMessage({
  remainingConversations,
  isOrganizationMember,
  onOpenModal,
}: {
  remainingConversations: number;
  isOrganizationMember: boolean;
  onOpenModal: () => void;
}) {
  const isOut = remainingConversations === 0;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div
        className={`rounded-lg p-4 ${
          isOut ? "bg-destructive/10 border border-destructive/20" : "bg-yellow-500/10 border border-yellow-500/20"
        }`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={`h-5 w-5 mt-0.5 ${isOut ? "text-destructive" : "text-yellow-600"}`}
          />
          <div className="flex-1">
            <h3 className="font-medium">
              {isOut ? "ポイントがありません" : "ポイントが残りわずかです"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isOut
                ? "会話を続けるにはポイントが必要です。"
                : `残り約${remainingConversations}回の会話が可能です。`}
            </p>
            <Button
              size="sm"
              variant={isOut ? "default" : "outline"}
              className="mt-3"
              onClick={onOpenModal}
            >
              {isOrganizationMember ? (
                <>
                  <Users className="h-4 w-4 mr-1" />
                  ポイントをリクエスト
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-1" />
                  ポイントを追加
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
