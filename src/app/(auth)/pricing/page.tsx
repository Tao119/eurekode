"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
  getAllIndividualPlans,
  getAllOrganizationPlans,
  formatPrice,
  formatConversationPoints,
  type IndividualPlanConfig,
  type OrganizationPlanConfig,
} from "@/config/plans";
import { Check, X, Sparkles, Users, Building2, Zap } from "lucide-react";

export default function PricingPage() {
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [planType, setPlanType] = useState<"individual" | "organization">("individual");

  const individualPlans = getAllIndividualPlans();
  const organizationPlans = getAllOrganizationPlans();

  const currentPlan = session?.user?.plan || "free";
  const isOrganization = session?.user?.userType === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="container max-w-6xl pt-8 pb-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-sm font-medium">戻る</span>
          </Link>
          {!session && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">ログイン</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">無料で始める</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="container max-w-6xl py-12 text-center">
        <Badge variant="outline" className="mb-4">
          <Sparkles className="h-3 w-3 mr-1" />
          シンプルな料金体系
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          あなたの学習に合わせたプラン
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          プログラミング学習をAIと一緒に。<br />
          すべてのプランで全機能が使えます。
        </p>

        {/* Plan Type Toggle */}
        <Tabs value={planType} onValueChange={(v) => setPlanType(v as "individual" | "organization")} className="mb-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="individual" className="gap-2">
              <Users className="h-4 w-4" />
              個人向け
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              組織向け
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingCycle === "monthly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            月払い
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              billingCycle === "yearly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            年払い
            <Badge variant="secondary" className="absolute -top-2 -right-12 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              2ヶ月分お得
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container max-w-6xl pb-20">
        {planType === "individual" ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {individualPlans.map((plan) => (
              <IndividualPlanCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                isCurrentPlan={currentPlan === plan.id && !isOrganization}
                isLoggedIn={!!session}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {organizationPlans.map((plan) => (
              <OrganizationPlanCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                isCurrentPlan={currentPlan === plan.id && isOrganization}
                isLoggedIn={!!session}
              />
            ))}
          </div>
        )}

        {/* Features Comparison */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-center mb-8">全プラン共通機能</h2>
          <div className="grid gap-4 md:grid-cols-3 max-w-3xl mx-auto">
            <FeatureItem icon="school" title="コード解説モード" description="AIがコードをわかりやすく解説" />
            <FeatureItem icon="auto_fix_high" title="コード生成モード" description="自然言語からコードを生成" />
            <FeatureItem icon="lightbulb" title="壁打ちモード" description="アイデアを一緒に整理" />
            <FeatureItem icon="history" title="会話履歴" description="過去の学習を振り返り" />
            <FeatureItem icon="folder_open" title="プロジェクト管理" description="学習を整理して管理" />
            <FeatureItem icon="insights" title="学習ダッシュボード" description="進捗を可視化" />
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">よくある質問</h2>
          <div className="space-y-4">
            <FAQItem
              question="ポイントとは何ですか？"
              answer="AIとの会話に必要なクレジットです。標準モデル（Sonnet）は1ポイント、高性能モデル（Opus）は1.6ポイント消費します。"
            />
            <FAQItem
              question="ポイントが足りなくなったら？"
              answer="追加クレジットを購入するか、上位プランにアップグレードできます。翌月にはポイントがリセットされます。"
            />
            <FAQItem
              question="プランの変更はいつでもできますか？"
              answer="はい、いつでもアップグレード・ダウングレードが可能です。差額は日割り計算されます。"
            />
            <FAQItem
              question="組織プランと個人プランの違いは？"
              answer="組織プランはチームメンバーを招待して一括管理できます。また、組織全体でポイントを共有します。"
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <Card className="max-w-2xl mx-auto bg-primary/5 border-primary/20">
            <CardContent className="pt-8 pb-8">
              <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">まずは無料で始めよう</h2>
              <p className="text-muted-foreground mb-6">
                クレジットカード不要。今すぐ学習を始められます。
              </p>
              <Button size="lg" asChild>
                <Link href="/register">無料アカウントを作成</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Individual Plan Card Component
function IndividualPlanCard({
  plan,
  billingCycle,
  isCurrentPlan,
  isLoggedIn,
}: {
  plan: IndividualPlanConfig;
  billingCycle: "monthly" | "yearly";
  isCurrentPlan: boolean;
  isLoggedIn: boolean;
}) {
  const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  const isPopular = plan.id === "pro";
  const isFree = plan.id === "free";

  return (
    <Card className={`relative ${isPopular ? "border-primary shadow-lg scale-105" : ""} ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          人気
        </Badge>
      )}
      {isCurrentPlan && (
        <Badge variant="outline" className="absolute -top-3 right-4">
          現在のプラン
        </Badge>
      )}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {plan.nameJa}
          {plan.features.prioritySupport && (
            <Sparkles className="h-4 w-4 text-amber-500" />
          )}
        </CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <span className="text-3xl font-bold">{formatPrice(price)}</span>
          {!isFree && (
            <span className="text-muted-foreground">
              /{billingCycle === "monthly" ? "月" : "年"}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatConversationPoints(plan.features.monthlyConversationPoints)}
        </div>
        <ul className="space-y-2 text-sm">
          <FeatureListItem included>全モード利用可能</FeatureListItem>
          <FeatureListItem included={plan.features.availableModels.includes("opus")}>
            高性能モデル（Opus）
          </FeatureListItem>
          <FeatureListItem included>
            履歴保持: {plan.features.historyRetentionDays === null ? "無制限" : `${plan.features.historyRetentionDays}日`}
          </FeatureListItem>
          <FeatureListItem included={plan.features.prioritySupport}>
            優先サポート
          </FeatureListItem>
        </ul>
      </CardContent>
      <CardFooter>
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full" disabled>
            利用中
          </Button>
        ) : isFree ? (
          <Button variant="outline" className="w-full" asChild>
            <Link href={isLoggedIn ? "/settings/billing" : "/register"}>
              {isLoggedIn ? "現在のプラン" : "無料で始める"}
            </Link>
          </Button>
        ) : (
          <Button className="w-full" asChild>
            <Link href={isLoggedIn ? "/settings/billing" : `/register?plan=${plan.id}`}>
              {isLoggedIn ? "アップグレード" : "このプランで始める"}
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Organization Plan Card Component
function OrganizationPlanCard({
  plan,
  billingCycle,
  isCurrentPlan,
  isLoggedIn,
}: {
  plan: OrganizationPlanConfig;
  billingCycle: "monthly" | "yearly";
  isCurrentPlan: boolean;
  isLoggedIn: boolean;
}) {
  const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  const isPopular = plan.id === "business";
  const isFree = plan.id === "free";
  const isEnterprise = plan.id === "enterprise";

  return (
    <Card className={`relative ${isPopular ? "border-primary shadow-lg scale-105" : ""} ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          おすすめ
        </Badge>
      )}
      {isCurrentPlan && (
        <Badge variant="outline" className="absolute -top-3 right-4">
          現在のプラン
        </Badge>
      )}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {plan.nameJa}
          {plan.features.prioritySupport && (
            <Sparkles className="h-4 w-4 text-amber-500" />
          )}
        </CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <span className="text-3xl font-bold">{formatPrice(price)}</span>
          {!isFree && !isEnterprise && (
            <span className="text-muted-foreground">
              /{billingCycle === "monthly" ? "月" : "年"}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {plan.maxMembers === null ? "メンバー数無制限" : `最大${plan.maxMembers}名`}
        </div>
        <ul className="space-y-2 text-sm">
          <FeatureListItem included>
            {formatConversationPoints(plan.features.monthlyConversationPoints)}（組織全体）
          </FeatureListItem>
          <FeatureListItem included={plan.features.availableModels.includes("opus")}>
            高性能モデル（Opus）
          </FeatureListItem>
          <FeatureListItem included>
            履歴保持: {plan.features.historyRetentionDays === null ? "無制限" : `${plan.features.historyRetentionDays}日`}
          </FeatureListItem>
          <FeatureListItem included={plan.features.prioritySupport}>
            優先サポート
          </FeatureListItem>
        </ul>
      </CardContent>
      <CardFooter>
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full" disabled>
            利用中
          </Button>
        ) : isEnterprise ? (
          <Button variant="outline" className="w-full" asChild>
            <Link href="mailto:contact@eurecode.com">お問い合わせ</Link>
          </Button>
        ) : isFree ? (
          <Button variant="outline" className="w-full" asChild>
            <Link href={isLoggedIn ? "/settings/billing" : "/register?type=admin"}>
              {isLoggedIn ? "現在のプラン" : "無料で始める"}
            </Link>
          </Button>
        ) : (
          <Button className="w-full" asChild>
            <Link href={isLoggedIn ? "/settings/billing" : `/register?type=admin&plan=${plan.id}`}>
              {isLoggedIn ? "アップグレード" : "このプランで始める"}
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Feature List Item
function FeatureListItem({ children, included }: { children: React.ReactNode; included: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${!included ? "text-muted-foreground/60" : ""}`}>
      {included ? (
        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
      )}
      {children}
    </li>
  );
}

// Feature Item (for common features section)
function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
      <span className="material-symbols-outlined text-primary text-xl flex-shrink-0">{icon}</span>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// FAQ Item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group p-4 rounded-lg border bg-card">
      <summary className="flex items-center justify-between cursor-pointer font-medium">
        {question}
        <span className="material-symbols-outlined text-muted-foreground group-open:rotate-180 transition-transform">
          expand_more
        </span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{answer}</p>
    </details>
  );
}
