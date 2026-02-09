"use client";

import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModeCard } from "@/components/common/ModeCard";
import { LearningStats } from "@/components/common/LearningStats";
import { FullPageLoading } from "@/components/common/LoadingSpinner";
import { RecentLearningsSection } from "@/components/learnings/RecentLearnings";
import { RecentConversationsSection } from "@/components/conversations/RecentConversations";
import { useUserSettings } from "@/contexts/UserSettingsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/home");
    }
  }, [status, router]);

  if (status === "loading") {
    return <FullPageLoading />;
  }

  if (!session) {
    return null;
  }

  return <LoggedInDashboard displayName={session.user.displayName} />;
}

function LoggedInDashboard({ displayName }: { displayName: string }) {
  const { allowedModes } = useUserSettings();

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "おはようございます";
    if (hour < 18) return "こんにちは";
    return "こんばんは";
  }, []);

  // Today's date
  const today = useMemo(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      month: "long",
      day: "numeric",
      weekday: "long",
    };
    return now.toLocaleDateString("ja-JP", options);
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Hero Welcome Section */}
      <div className="mb-8 sm:mb-12">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{today}</p>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2">
              {greeting}、{displayName}さん
            </h1>
            <p className="text-muted-foreground">
              さあ、今日も一緒に学習を始めましょう。
            </p>
          </div>
          <LearningStats />
        </div>
      </div>

      {/* Quick Start Section - Primary CTA */}
      <section className="mb-8 sm:mb-12">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              rocket_launch
            </span>
            今すぐ始める
          </h2>
          <Link
            href="/dashboard"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            学習統計を見る
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {/* Brainstorm - Primary */}
          <Card className="group relative overflow-hidden border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-500/5 hover:border-purple-500/50 transition-all cursor-pointer">
            <Link href="/chat/brainstorm" className="block">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="size-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-purple-400">
                      lightbulb
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    arrow_forward
                  </span>
                </div>
                <h3 className="text-lg font-bold text-purple-400 mb-1">壁打ちモード</h3>
                <p className="text-sm text-muted-foreground">
                  アイデアを整理・深掘りして、思考を明確に
                </p>
              </CardContent>
            </Link>
          </Card>

          {/* Explanation */}
          <Card className="group relative overflow-hidden border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:border-blue-500/50 transition-all cursor-pointer">
            <Link href="/chat/explanation" className="block">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="size-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-blue-400">
                      school
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    arrow_forward
                  </span>
                </div>
                <h3 className="text-lg font-bold text-blue-400 mb-1">解説モード</h3>
                <p className="text-sm text-muted-foreground">
                  コードの理解を深め、「なぜ」を解消
                </p>
              </CardContent>
            </Link>
          </Card>

          {/* Generation */}
          <Card className="group relative overflow-hidden border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 hover:border-yellow-500/50 transition-all cursor-pointer">
            <Link href="/chat/generation" className="block">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="size-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-yellow-400">
                      code
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    arrow_forward
                  </span>
                </div>
                <h3 className="text-lg font-bold text-yellow-400 mb-1">生成モード</h3>
                <p className="text-sm text-muted-foreground">
                  一緒にコードを作成し、実装力を磨く
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* Disabled modes notice */}
        {allowedModes.length < 3 && (
          <p className="mt-4 text-sm text-muted-foreground text-center">
            <span className="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
            一部のモードは管理者によって制限されています
          </p>
        )}
      </section>

      {/* Recent Activity Sections - Stacked Layout */}
      <div className="space-y-8">
        <RecentConversationsSection />
        <RecentLearningsSection />
      </div>

      {/* Tips Section */}
      <section className="mt-8 sm:mt-12">
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">
                  tips_and_updates
                </span>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">学習のコツ</h3>
                <p className="text-sm text-muted-foreground">
                  分からないことがあったら、まず<strong>壁打ちモード</strong>で自分の考えを整理してみましょう。
                  問題を言語化することで、解決の糸口が見つかることが多いです。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
