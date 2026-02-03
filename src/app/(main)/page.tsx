"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { ModeCard } from "@/components/common/ModeCard";
import { LearningStats } from "@/components/common/LearningStats";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FullPageLoading } from "@/components/common/LoadingSpinner";
import { RecentLearningsSection } from "@/components/learnings/RecentLearnings";

export default function HomePage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <FullPageLoading />;
  }

  // Logged in user dashboard
  if (session) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              おかえりなさい, {session.user.displayName}さん
            </h1>
            <p className="text-muted-foreground">
              今日も新しいスキルを身につけましょう。
            </p>
          </div>
          <LearningStats />
        </div>

        {/* Mode Selection */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              grid_view
            </span>
            学習モードを選択
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ModeCard mode="explanation" />
            <ModeCard mode="generation" />
            <ModeCard mode="brainstorm" />
          </div>
        </section>

        {/* Recent Learnings */}
        <RecentLearningsSection />
      </div>
    );
  }

  // Landing page for non-logged in users
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background opacity-50" />
        <div
          className="absolute inset-0 -z-10 opacity-20"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-6 text-center lg:text-left">
              <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                <span className="block text-primary text-2xl sm:text-3xl font-bold mb-2">
                  Think, Don&apos;t Just Copy
                </span>
                コードを渡すのではなく、
                <br className="hidden sm:block" />
                思考を渡す
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                AIがあなたの「なぜ？」に答えます。
                <br className="hidden sm:block" />
                単に答えを教えるのではなく、解決への道筋を共に歩む
                <br className="hidden sm:block" />
                全く新しいプログラミング学習プラットフォーム。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                <Button size="lg" className="shadow-lg" asChild>
                  <Link href="/register">無料で始める</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/join">
                    <span className="material-symbols-outlined mr-2 text-xl">
                      vpn_key
                    </span>
                    キーで参加
                  </Link>
                </Button>
              </div>
              <div className="pt-6 flex items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    check_circle
                  </span>
                  クレカ登録不要
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    check_circle
                  </span>
                  14日間無料トライアル
                </span>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
              <Card className="shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-destructive/80" />
                    <div className="h-3 w-3 rounded-full bg-warning/80" />
                    <div className="h-3 w-3 rounded-full bg-success/80" />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    mentor_session.ts
                  </div>
                  <div className="w-10" />
                </div>
                <CardContent className="p-6 font-mono text-sm space-y-6 bg-muted/30 min-h-[300px]">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 size-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold border border-blue-500/30">
                      U
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground">
                        ReactのuseEffectで無限ループが発生してしまいます。
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold border border-primary/30">
                      <span className="material-symbols-outlined text-[18px]">
                        smart_toy
                      </span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        思考プロセスを展開中...
                      </div>
                      <p className="text-muted-foreground">
                        答えを出す前に、まず原因を特定しましょう。
                        <code className="bg-muted text-foreground rounded px-1">
                          useEffect
                        </code>
                        の依存配列には何が含まれていますか？
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-primary font-bold tracking-wide uppercase text-sm mb-3">
              Features
            </h2>
            <h3 className="text-3xl font-bold text-foreground sm:text-4xl">
              学習を加速する3つのモード
            </h3>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Eurecodeは単なるコード生成ツールではありません。
              あなたの思考プロセスをサポートし、真の理解へと導きます。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ModeCard mode="explanation" />
            <ModeCard mode="generation" />
            <ModeCard mode="brainstorm" />
          </div>
        </div>
      </section>
    </div>
  );
}
