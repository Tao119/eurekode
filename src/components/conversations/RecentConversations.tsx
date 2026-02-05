"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MODE_CONFIG } from "@/config/modes";
import type { ChatMode } from "@/types/chat";

interface RecentConversation {
  id: string;
  mode: ChatMode;
  title: string | null;
  updatedAt: string;
}

interface RecentConversationsProps {
  limit?: number;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
  return date.toLocaleDateString("ja-JP");
}

export function RecentConversations({ limit = 3 }: RecentConversationsProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const response = await fetch(`/api/conversations?limit=${limit}`);
        const result = await response.json();
        if (result.success) {
          setConversations(result.data.items);
        } else {
          setError(new Error(result.error?.message || "会話の取得に失敗しました"));
        }
      } catch {
        setError(new Error("会話の取得に失敗しました"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchConversations();
  }, [limit]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="size-8 bg-muted rounded-lg" />
                  <div className="h-5 w-32 bg-muted rounded" />
                </div>
                <div className="h-4 w-12 bg-muted rounded" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="col-span-full border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <span className="material-symbols-outlined">error</span>
              <span>{error.message}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <Card
            key={i}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push("/chat/explanation")}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                  <span className="material-symbols-outlined text-muted-foreground text-lg">
                    chat_bubble
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">--</span>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-base mb-1">
                まだ会話がありません
              </CardTitle>
              <p className="text-muted-foreground text-sm line-clamp-2">
                学習モードを選んで、最初の会話を始めましょう。
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {conversations.slice(0, limit).map((conversation) => {
        const config = MODE_CONFIG[conversation.mode];
        return (
          <Card
            key={conversation.id}
            className="cursor-pointer hover:bg-muted/50 hover:border-primary/30 transition-all"
            onClick={() =>
              router.push(`/chat/${conversation.mode}/${conversation.id}`)
            }
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${config.bgColor}`}
                  >
                    <span
                      className={`material-symbols-outlined text-lg ${config.color}`}
                    >
                      {config.icon}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
                  >
                    {config.title}
                  </span>
                </div>
                <span className="text-muted-foreground text-xs shrink-0">
                  {formatRelativeDate(conversation.updatedAt)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium line-clamp-2">
                {conversation.title || "無題の会話"}
              </p>
            </CardContent>
          </Card>
        );
      })}
      {conversations.length < limit &&
        Array.from({ length: limit - conversations.length }).map((_, i) => (
          <Card
            key={`empty-${i}`}
            className="cursor-pointer hover:bg-muted/50 transition-colors opacity-50"
            onClick={() => router.push("/chat/explanation")}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                  <span className="material-symbols-outlined text-muted-foreground text-lg">
                    add
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-base mb-1 text-muted-foreground">
                新しい会話を始める
              </CardTitle>
              <p className="text-muted-foreground text-sm line-clamp-2">
                学習モードを選んで会話を始めましょう。
              </p>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

export function RecentConversationsSection() {
  return (
    <section className="mb-6 sm:mb-10">
      <div className="flex items-center justify-between mb-3 sm:mb-5">
        <h2 className="text-base sm:text-xl font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl sm:text-2xl">
            forum
          </span>
          最近の会話
        </h2>
        <Link
          href="/history"
          className="text-sm text-primary hover:underline"
        >
          すべて見る
        </Link>
      </div>
      <RecentConversations limit={3} />
    </section>
  );
}
