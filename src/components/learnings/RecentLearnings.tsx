"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLearnings } from "@/hooks/useLearnings";
import { LearningCard } from "./LearningCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecentLearningsProps {
  limit?: number;
}

export function RecentLearnings({ limit = 3 }: RecentLearningsProps) {
  const router = useRouter();
  const { learnings, isLoading, error } = useLearnings({
    initialLimit: limit,
    autoFetch: true,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="h-5 w-20 bg-muted rounded" />
                <div className="h-4 w-12 bg-muted rounded" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-3/4 bg-muted rounded mb-2" />
              <div className="h-3 w-full bg-muted rounded mb-1" />
              <div className="h-3 w-2/3 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-full border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <span className="material-symbols-outlined">error</span>
              <span>学びの読み込みに失敗しました: {error.message}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (learnings.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <Card
            key={i}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push("/chat/explanation")}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-bold">
                  --
                </span>
                <span className="text-muted-foreground text-xs">--</span>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-base mb-2">
                まだ学びがありません
              </CardTitle>
              <p className="text-muted-foreground text-sm line-clamp-2">
                チャットを始めて、新しい学びを記録しましょう。
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {learnings.slice(0, limit).map((learning) => (
        <LearningCard
          key={learning.id}
          learning={learning}
          variant="compact"
          onClick={() => router.push(`/learnings?id=${learning.id}`)}
        />
      ))}
      {/* Fill remaining slots with empty cards if less than limit */}
      {learnings.length < limit &&
        Array.from({ length: limit - learnings.length }).map((_, i) => (
          <Card
            key={`empty-${i}`}
            className="cursor-pointer hover:bg-muted/50 transition-colors opacity-50"
            onClick={() => router.push("/chat/explanation")}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-bold">
                  +
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-base mb-2 text-muted-foreground">
                新しい学びを追加
              </CardTitle>
              <p className="text-muted-foreground text-sm line-clamp-2">
                チャットで学習して、インサイトを記録しましょう。
              </p>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

// Standalone section component for the home page
export function RecentLearningsSection() {
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">history</span>
          最近の学び
        </h2>
        <Link
          href="/learnings"
          className="text-sm text-primary hover:underline"
        >
          すべて見る
        </Link>
      </div>
      <RecentLearnings limit={3} />
    </section>
  );
}
