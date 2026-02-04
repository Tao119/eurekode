"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Zap, ArrowRight, CreditCard, Users } from "lucide-react";
import {
  CreditPack,
  CREDIT_PACKS,
  formatPrice,
  IndividualPlanConfig,
  OrganizationPlanConfig,
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
  IndividualPlan,
  OrganizationPlan,
} from "@/config/plans";

interface CreditAlertProps {
  /** 残りポイント */
  remainingPoints: number;
  /** 残り会話回数（Sonnet基準） */
  remainingConversations: number;
  /** 低残高警告表示 */
  showWarning: boolean;
  /** クレジット購入可能か */
  canPurchaseCredits: boolean;
  /** 組織メンバーか */
  isOrganizationMember?: boolean;
  /** 現在のプラン */
  currentPlan?: IndividualPlan | OrganizationPlan;
  /** 組織プランか */
  isOrganization?: boolean;
  /** カスタムクラス */
  className?: string;
}

export function CreditAlert({
  remainingPoints,
  remainingConversations,
  showWarning,
  canPurchaseCredits,
  isOrganizationMember = false,
  currentPlan = "free",
  isOrganization = false,
  className,
}: CreditAlertProps) {
  const router = useRouter();
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!showWarning && remainingConversations > 0) {
    return null;
  }

  const isOutOfCredits = remainingConversations === 0;
  const variant = isOutOfCredits ? "destructive" : "default";

  const handlePurchaseCredits = () => {
    setShowPurchaseDialog(true);
  };

  const handleUpgrade = () => {
    setShowUpgradeDialog(true);
  };

  const handleRequestAllocation = () => {
    router.push("/settings/credits/request");
  };

  return (
    <>
      <Alert variant={variant} className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>
          {isOutOfCredits ? "ポイントがありません" : "ポイントが残りわずかです"}
        </AlertTitle>
        <AlertDescription className="mt-2">
          <div className="flex flex-col gap-3">
            <p>
              {isOutOfCredits
                ? "会話を続けるにはポイントが必要です。"
                : `残り約${remainingConversations}回の会話が可能です。`}
            </p>

            <div className="flex flex-wrap gap-2">
              {canPurchaseCredits && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handlePurchaseCredits}
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  クレジットを購入
                </Button>
              )}

              {!isOrganization && currentPlan !== "max" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUpgrade}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  プランをアップグレード
                </Button>
              )}

              {isOrganizationMember && !canPurchaseCredits && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRequestAllocation}
                >
                  <Users className="h-4 w-4 mr-1" />
                  ポイントをリクエスト
                </Button>
              )}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* クレジット購入ダイアログ */}
      <CreditPurchaseDialog
        open={showPurchaseDialog}
        onOpenChange={setShowPurchaseDialog}
      />

      {/* アップグレードダイアログ */}
      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentPlan={currentPlan}
        isOrganization={isOrganization}
      />
    </>
  );
}

// ============================================
// Credit Purchase Dialog
// ============================================

interface CreditPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreditPurchaseDialog({ open, onOpenChange }: CreditPurchaseDialogProps) {
  const [selectedPack, setSelectedPack] = useState<string | null>("medium");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      const body = selectedPack
        ? { packId: selectedPack }
        : { customAmount: parseInt(customAmount, 10) };

      const response = await fetch("/api/billing/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout failed:", data.error);
        alert(data.errorJa || "決済ページの作成に失敗しました");
      }
    } catch (error) {
      console.error("Purchase error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>クレジットを購入</DialogTitle>
          <DialogDescription>
            追加のポイントを購入して会話を続けましょう
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* パック選択 */}
          <div className="grid gap-3">
            {CREDIT_PACKS.map((pack) => (
              <CreditPackCard
                key={pack.id}
                pack={pack}
                selected={selectedPack === pack.id}
                onSelect={() => {
                  setSelectedPack(pack.id);
                  setCustomAmount("");
                }}
              />
            ))}
          </div>

          {/* カスタム金額 */}
          <div className="border-t pt-4">
            <label className="text-sm text-muted-foreground">
              またはカスタム金額を入力（最低¥300）
            </label>
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                min="300"
                step="100"
                placeholder="¥300"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedPack(null);
                }}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <span className="flex items-center text-sm text-muted-foreground">
                = {customAmount ? Math.floor(parseInt(customAmount, 10) / 3) : 0}pt
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={isLoading || (!selectedPack && !customAmount)}
          >
            {isLoading ? "処理中..." : "購入する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Credit Pack Card
// ============================================

interface CreditPackCardProps {
  pack: CreditPack;
  selected: boolean;
  onSelect: () => void;
}

function CreditPackCard({ pack, selected, onSelect }: CreditPackCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full p-4 rounded-lg border-2 text-left transition-colors
        ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
      `}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{pack.nameJa}</span>
            {pack.recommended && (
              <Badge variant="secondary" className="text-xs">
                おすすめ
              </Badge>
            )}
            {pack.discount > 0 && (
              <Badge variant="outline" className="text-xs text-green-600">
                {pack.discount}%お得
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {pack.points.toLocaleString()}ポイント（¥{pack.unitPrice}/pt）
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold">{formatPrice(pack.price)}</span>
        </div>
      </div>
    </button>
  );
}

// ============================================
// Upgrade Dialog
// ============================================

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: IndividualPlan | OrganizationPlan;
  isOrganization: boolean;
}

function UpgradeDialog({
  open,
  onOpenChange,
  currentPlan,
  isOrganization,
}: UpgradeDialogProps) {
  const router = useRouter();

  const getNextPlan = (): IndividualPlanConfig | OrganizationPlanConfig | null => {
    if (isOrganization) {
      const planOrder: OrganizationPlan[] = ["free", "starter", "business", "enterprise"];
      const currentIndex = planOrder.indexOf(currentPlan as OrganizationPlan);
      if (currentIndex < planOrder.length - 1) {
        return ORGANIZATION_PLANS[planOrder[currentIndex + 1]];
      }
    } else {
      const planOrder: IndividualPlan[] = ["free", "starter", "pro", "max"];
      const currentIndex = planOrder.indexOf(currentPlan as IndividualPlan);
      if (currentIndex < planOrder.length - 1) {
        return INDIVIDUAL_PLANS[planOrder[currentIndex + 1]];
      }
    }
    return null;
  };

  const nextPlan = getNextPlan();
  const currentPlanConfig = isOrganization
    ? ORGANIZATION_PLANS[currentPlan as OrganizationPlan]
    : INDIVIDUAL_PLANS[currentPlan as IndividualPlan];

  if (!nextPlan) return null;

  const pointsGain =
    nextPlan.features.monthlyConversationPoints -
    currentPlanConfig.features.monthlyConversationPoints;

  const handleUpgrade = () => {
    router.push("/settings/billing?upgrade=true");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>プランをアップグレード</DialogTitle>
          <DialogDescription>
            より多くのポイントとプレミアム機能を利用できます
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">現在のプラン</p>
                <p className="font-medium">{currentPlanConfig.nameJa}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">おすすめ</p>
                <p className="font-medium text-primary">{nextPlan.nameJa}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>月間ポイント</span>
                <span className="text-green-600">+{pointsGain.toLocaleString()}pt</span>
              </div>
              <div className="flex justify-between">
                <span>月額料金</span>
                <span>{formatPrice(nextPlan.priceMonthly)}/月</span>
              </div>
              {nextPlan.features.availableModels.includes("opus") &&
                !currentPlanConfig.features.availableModels.includes("opus") && (
                <div className="flex justify-between text-green-600">
                  <span>高性能モデル</span>
                  <span>利用可能に</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleUpgrade}>
            <Zap className="h-4 w-4 mr-1" />
            アップグレード
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Credit Balance Display
// ============================================

interface CreditBalanceDisplayProps {
  totalPoints: number;
  usedPoints: number;
  remainingConversations: number;
  className?: string;
}

export function CreditBalanceDisplay({
  totalPoints,
  usedPoints,
  remainingConversations,
  className,
}: CreditBalanceDisplayProps) {
  const usagePercent = totalPoints > 0 ? (usedPoints / totalPoints) * 100 : 0;
  const remaining = totalPoints - usedPoints;

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-muted-foreground">今月の残りポイント</span>
        <span className="font-medium">
          {remaining.toLocaleString()} / {totalPoints.toLocaleString()} pt
        </span>
      </div>
      <Progress value={100 - usagePercent} className="h-2" />
      <p className="text-xs text-muted-foreground mt-1">
        約{remainingConversations}回の会話が可能です
      </p>
    </div>
  );
}
