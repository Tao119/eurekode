"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingTable } from "@/components/billing/PricingTable";
import { CreditAlert, CreditBalanceDisplay } from "@/components/billing/CreditAlert";
import {
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
  CREDIT_PACKS,
  formatPrice,
  IndividualPlan,
  OrganizationPlan,
} from "@/config/plans";
import {
  CreditCard,
  Zap,
  Receipt,
  Settings,
  Check,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface SubscriptionData {
  plan: IndividualPlan | OrganizationPlan;
  planType: "individual" | "organization";
  status: "active" | "canceled" | "past_due";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface CreditBalanceData {
  plan: string;
  points: {
    monthly: {
      total: number;
      used: number;
      remaining: number;
    };
    purchased: {
      balance: number;
      used: number;
      remaining: number;
    };
    totalRemaining: number;
  };
  remainingConversations: {
    sonnet: number;
    opus: number;
  };
  period: {
    start: string;
    end: string;
  };
}

interface BillingHistoryItem {
  id: string;
  type: "subscription" | "credit_purchase";
  amount: number;
  status: string;
  date: string;
  description: string;
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-4xl py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [creditBalance, setCreditBalance] = useState<CreditBalanceData | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  // Check for success/cancel messages
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const creditPurchase = searchParams.get("credit_purchase");

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const [subRes, creditRes] = await Promise.all([
        fetch("/api/billing/subscription"),
        fetch("/api/billing/credits/balance"),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }

      if (creditRes.ok) {
        const creditData = await creditRes.json();
        setCreditBalance(creditData);
      }
    } catch (error) {
      console.error("Failed to fetch billing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("ポータルの作成に失敗しました");
      }
    } catch (error) {
      console.error("Portal error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const currentPlanConfig = subscription
    ? subscription.planType === "organization"
      ? ORGANIZATION_PLANS[subscription.plan as OrganizationPlan]
      : INDIVIDUAL_PLANS[subscription.plan as IndividualPlan]
    : INDIVIDUAL_PLANS.free;

  const remainingPoints = creditBalance?.points?.totalRemaining ?? 0;
  const remainingConversations = creditBalance?.remainingConversations?.sonnet ?? 0;
  const showWarning = remainingConversations <= 5;

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">プランと請求</h1>
        <p className="text-muted-foreground mt-2">
          サブスクリプションの管理とクレジットの購入
        </p>
      </div>

      {/* Success/Cancel Messages */}
      {success && (
        <Alert className="border-green-500 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            プランの変更が完了しました。ご利用ありがとうございます。
          </AlertDescription>
        </Alert>
      )}

      {canceled && (
        <Alert>
          <X className="h-4 w-4" />
          <AlertDescription>
            決済がキャンセルされました。
          </AlertDescription>
        </Alert>
      )}

      {creditPurchase === "success" && (
        <Alert className="border-green-500 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            クレジットの購入が完了しました。
          </AlertDescription>
        </Alert>
      )}

      {/* Credit Alert */}
      {showWarning && (
        <CreditAlert
          remainingPoints={remainingPoints}
          remainingConversations={remainingConversations}
          showWarning={showWarning}
          canPurchaseCredits={true}
          currentPlan={subscription?.plan || "free"}
          isOrganization={subscription?.planType === "organization"}
        />
      )}

      <Tabs defaultValue="plan" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plan">
            <Zap className="h-4 w-4 mr-2" />
            プラン
          </TabsTrigger>
          <TabsTrigger value="credits">
            <CreditCard className="h-4 w-4 mr-2" />
            クレジット
          </TabsTrigger>
          <TabsTrigger value="history">
            <Receipt className="h-4 w-4 mr-2" />
            履歴
          </TabsTrigger>
        </TabsList>

        {/* Plan Tab */}
        <TabsContent value="plan" className="space-y-6">
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>現在のプラン</span>
                {subscription && subscription.status === "active" && (
                  <Badge variant="default">アクティブ</Badge>
                )}
                {subscription && subscription.status === "past_due" && (
                  <Badge variant="destructive">支払い遅延</Badge>
                )}
                {subscription && subscription.status === "canceled" && (
                  <Badge variant="secondary">キャンセル済み</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {subscription?.planType === "organization" ? "組織プラン" : "個人プラン"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{currentPlanConfig.nameJa}</h3>
                  <p className="text-muted-foreground">
                    {formatPrice(currentPlanConfig.priceMonthly)}/月
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">月間ポイント</p>
                  <p className="text-xl font-semibold">
                    {currentPlanConfig.features.monthlyConversationPoints.toLocaleString()} pt
                  </p>
                </div>
              </div>

              {subscription?.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  次回更新日: {new Date(subscription.currentPeriodEnd).toLocaleDateString("ja-JP")}
                  {subscription.cancelAtPeriodEnd && (
                    <span className="text-orange-500 ml-2">（期間終了時にキャンセル）</span>
                  )}
                </p>
              )}

              <div className="flex gap-2">
                {subscription?.status === "active" && (
                  <Button
                    variant="outline"
                    onClick={handleManageSubscription}
                    disabled={isPortalLoading}
                  >
                    {isPortalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    プランを管理
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plan Selection */}
          <Card>
            <CardHeader>
              <CardTitle>プランを変更</CardTitle>
              <CardDescription>
                より多くのポイントや機能が必要な場合はアップグレードしてください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PricingTable
                currentPlan={subscription?.plan || "free"}
                isOrganization={subscription?.planType === "organization"}
                showOrganizationPlans={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-6">
          {/* Credit Balance Card */}
          <Card>
            <CardHeader>
              <CardTitle>クレジット残高</CardTitle>
              <CardDescription>
                今月の利用状況と残りポイント
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {creditBalance && (
                <>
                  <CreditBalanceDisplay
                    totalPoints={creditBalance.points.monthly.total + creditBalance.points.purchased.balance}
                    usedPoints={creditBalance.points.monthly.used + creditBalance.points.purchased.used}
                    remainingConversations={remainingConversations}
                  />

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">月間付与ポイント</p>
                      <p className="text-lg font-semibold">
                        {creditBalance.points.monthly.total.toLocaleString()} pt
                      </p>
                      <p className="text-xs text-muted-foreground">
                        残り: {creditBalance.points.monthly.remaining.toLocaleString()} pt
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">購入済みポイント</p>
                      <p className="text-lg font-semibold">
                        {creditBalance.points.purchased.remaining.toLocaleString()} pt
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    次回リセット: {new Date(creditBalance.period.end).toLocaleDateString("ja-JP")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Credit Packs Card */}
          <Card>
            <CardHeader>
              <CardTitle>クレジットを購入</CardTitle>
              <CardDescription>
                追加のポイントを購入して会話を続けましょう
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {CREDIT_PACKS.map((pack) => (
                  <CreditPackPurchaseCard key={pack.id} pack={pack} />
                ))}
              </div>

              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-4">カスタム金額で購入</h4>
                <CustomCreditPurchase />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>請求履歴</CardTitle>
              <CardDescription>
                過去の支払い履歴を確認できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>請求履歴はStripeポータルから確認できます</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleManageSubscription}
                  disabled={isPortalLoading}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Stripeポータルを開く
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Credit Pack Purchase Card
// ============================================

interface CreditPackPurchaseCardProps {
  pack: typeof CREDIT_PACKS[number];
}

function CreditPackPurchaseCard({ pack }: CreditPackPurchaseCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
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

  return (
    <Card className={pack.recommended ? "border-primary" : ""}>
      <CardContent className="pt-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center gap-2">
            <h3 className="font-semibold">{pack.nameJa}</h3>
            {pack.recommended && (
              <Badge variant="default" className="text-xs">おすすめ</Badge>
            )}
          </div>
          <p className="text-3xl font-bold">{formatPrice(pack.price)}</p>
          <p className="text-sm text-muted-foreground">
            {pack.points.toLocaleString()} ポイント
          </p>
          {pack.discount > 0 && (
            <Badge variant="outline" className="text-green-600">
              {pack.discount}%お得
            </Badge>
          )}
        </div>
        <Button
          className="w-full mt-4"
          variant={pack.recommended ? "default" : "outline"}
          onClick={handlePurchase}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "購入する"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// Custom Credit Purchase
// ============================================

function CustomCreditPurchase() {
  const [amount, setAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const points = amount ? Math.floor(parseInt(amount, 10) / 3) : 0;
  const isValid = parseInt(amount, 10) >= 300;

  const handlePurchase = async () => {
    if (!isValid) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customAmount: parseInt(amount, 10) }),
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

  return (
    <div className="flex gap-4 items-end">
      <div className="flex-1">
        <label className="text-sm text-muted-foreground">金額（円）</label>
        <input
          type="number"
          min="300"
          step="100"
          placeholder="¥300〜"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-md"
        />
      </div>
      <div className="text-center px-4">
        <p className="text-sm text-muted-foreground">獲得ポイント</p>
        <p className="text-xl font-bold">{points.toLocaleString()} pt</p>
      </div>
      <Button onClick={handlePurchase} disabled={!isValid || isLoading}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "購入"}
      </Button>
    </div>
  );
}
