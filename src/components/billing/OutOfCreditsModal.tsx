"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  Zap,
  CreditCard,
  Users,
  ArrowRight,
  Sparkles,
  Clock,
  Send,
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

interface PendingRequestInfo {
  requestedPoints: number;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState<"allocate" | "credits" | "upgrade">(
    isOrganization && !isOrganizationMember ? "allocate" : "credits"
  );

  // メンバー用リクエストフォーム state
  const [requestPoints, setRequestPoints] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequestInfo, setPendingRequestInfo] = useState<PendingRequestInfo | null>(null);

  // 管理者用: 保留リクエスト件数
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  // モーダルが開いた時に保留リクエスト情報を取得
  useEffect(() => {
    if (!open) return;

    if (isOrganizationMember) {
      // メンバー: 自分の保留リクエストを確認
      fetch("/api/billing/credits/allocation/request")
        .then((res) => res.json())
        .then((data) => {
          const pending = data.requests?.find(
            (r: { status: string }) => r.status === "pending"
          );
          if (pending) {
            setHasPendingRequest(true);
            setPendingRequestInfo({
              requestedPoints: pending.requestedPoints,
              createdAt: pending.createdAt,
            });
          } else {
            setHasPendingRequest(false);
            setPendingRequestInfo(null);
          }
        })
        .catch((err) => {
          console.error("[OutOfCreditsModal] Failed to check pending request:", err);
        });
    } else if (isOrganization) {
      // 管理者: 保留リクエスト件数を取得
      fetch("/api/billing/credits/allocation/request")
        .then((res) => res.json())
        .then((data) => {
          const count = data.requests?.filter(
            (r: { status: string }) => r.status === "pending"
          ).length || 0;
          setPendingRequestCount(count);
        })
        .catch((err) => {
          console.error("[OutOfCreditsModal] Failed to fetch pending requests:", err);
        });
    }
  }, [open, isOrganizationMember, isOrganization]);

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
      } else if (data.success) {
        router.push("/settings/billing?success=true");
        router.refresh();
      } else {
        alert(data.errorJa || "決済ページの作成に失敗しました");
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRequest = useCallback(async () => {
    const points = parseFloat(requestPoints);
    if (!points || points <= 0) {
      toast.error("有効なポイント数を入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/billing/credits/allocation/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedPoints: points,
          reason: requestReason.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("リクエストを送信しました");
        setHasPendingRequest(true);
        setPendingRequestInfo({
          requestedPoints: points,
          createdAt: new Date().toISOString(),
        });
        setRequestPoints("");
        setRequestReason("");
      } else {
        toast.error(data.errorJa || data.error || "リクエストに失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }, [requestPoints, requestReason]);

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

        {/* 組織メンバーの場合: インラインリクエストフォーム */}
        {isOrganizationMember && (
          <div className="py-4">
            {hasPendingRequest && pendingRequestInfo ? (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Clock className="h-10 w-10 mx-auto mb-3 text-yellow-500" />
                <h3 className="font-medium mb-1">リクエスト送信済み</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {pendingRequestInfo.requestedPoints.toLocaleString()} pt のリクエストを送信しました。
                  <br />
                  管理者の承認をお待ちください。
                </p>
                <p className="text-xs text-muted-foreground">
                  送信日時: {new Date(pendingRequestInfo.createdAt).toLocaleDateString("ja-JP", {
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">管理者にポイントをリクエスト</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    リクエストするポイント数を入力してください。管理者が確認後、ポイントが追加されます。
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        リクエストポイント数
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="例: 100"
                        value={requestPoints}
                        onChange={(e) => setRequestPoints(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        理由（任意）
                      </label>
                      <textarea
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        placeholder="ポイントが必要な理由..."
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      />
                    </div>
                    <Button
                      onClick={handleSubmitRequest}
                      disabled={isSubmitting || !requestPoints}
                      className="w-full"
                    >
                      {isSubmitting ? (
                        <span className="material-symbols-outlined animate-spin text-base mr-2">
                          progress_activity
                        </span>
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      リクエストを送信
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 個人または組織管理者の場合 */}
        {!isOrganizationMember && (
          <>
            {/* タブ切り替え */}
            <div className="flex border-b">
              {/* 組織管理者のみ: ポイント割り振りタブ */}
              {isOrganization && (
                <button
                  onClick={() => setActiveTab("allocate")}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "allocate"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="h-4 w-4 inline mr-1.5" />
                  ポイント割り振り
                </button>
              )}
              <button
                onClick={() => setActiveTab("credits")}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "credits"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <CreditCard className="h-4 w-4 inline mr-1.5" />
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
                  <Zap className="h-4 w-4 inline mr-1.5" />
                  プラン変更
                </button>
              )}
            </div>

            {/* ポイント割り振りタブ（組織管理者のみ） */}
            {activeTab === "allocate" && isOrganization && (
              <div className="py-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  メンバーへのポイント配分を調整して、ポイントを確保できます。
                </p>

                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <Button
                    onClick={() => {
                      router.push("/admin/members");
                      onOpenChange(false);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    メンバーのポイント配分を管理
                  </Button>

                  {pendingRequestCount > 0 && (
                    <Button
                      onClick={() => {
                        router.push("/admin/requests");
                        onOpenChange(false);
                      }}
                      variant="outline"
                      className="w-full border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/5"
                    >
                      <span className="material-symbols-outlined text-base mr-2">inbox</span>
                      {pendingRequestCount}件のポイントリクエストを確認
                    </Button>
                  )}
                </div>
              </div>
            )}

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
