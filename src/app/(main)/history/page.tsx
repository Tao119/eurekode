"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/types/chat";

interface Conversation {
  id: string;
  mode: ChatMode;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  tokensConsumed: number;
}

const modeConfig: Record<
  ChatMode,
  { title: string; icon: string; color: string; bgColor: string }
> = {
  explanation: {
    title: "解説",
    icon: "menu_book",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  generation: {
    title: "生成",
    icon: "bolt",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
  },
  brainstorm: {
    title: "壁打ち",
    icon: "lightbulb",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
};

export default function HistoryPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ChatMode | "all">("all");

  useEffect(() => {
    async function fetchConversations() {
      try {
        const params = filter !== "all" ? `?mode=${filter}` : "";
        const response = await fetch(`/api/conversations${params}`);
        const data = await response.json();
        if (data.success) {
          // APIレスポンスが { items, total, hasMore } 形式に変更
          setConversations(data.data.items || data.data);
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchConversations();
  }, [filter]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "今日";
    } else if (diffDays === 1) {
      return "昨日";
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else {
      return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この会話を削除しますか？")) return;

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">学習履歴</h1>
          <p className="text-muted-foreground">過去の対話を振り返る</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            filter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          すべて
        </button>
        {(Object.keys(modeConfig) as ChatMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              filter === mode
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <span className={cn("material-symbols-outlined text-lg", filter === mode ? "" : modeConfig[mode].color)}>
              {modeConfig[mode].icon}
            </span>
            {modeConfig[mode].title}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">
            history
          </span>
          <p className="text-muted-foreground">まだ履歴がありません</p>
          <Link
            href="/"
            className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            学習を始める
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => {
            const config = modeConfig[conversation.mode];
            return (
              <div
                key={conversation.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors group"
              >
                <div
                  className={cn(
                    "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    config.bgColor,
                    config.color
                  )}
                >
                  <span className="material-symbols-outlined">
                    {config.icon}
                  </span>
                </div>

                <Link
                  href={`/chat/${conversation.mode}/${conversation.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="font-medium truncate">
                    {conversation.title || "無題の会話"}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className={cn("font-medium", config.color)}>
                      {config.title}モード
                    </span>
                    <span>{formatDate(conversation.updatedAt)}</span>
                    {conversation.tokensConsumed > 0 && (
                      <span>{conversation.tokensConsumed} tokens</span>
                    )}
                  </div>
                </Link>

                <button
                  onClick={() => handleDelete(conversation.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <span className="material-symbols-outlined text-xl">
                    delete
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
