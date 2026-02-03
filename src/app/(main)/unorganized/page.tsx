"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/types/chat";

interface UnorganizedConversation {
  id: string;
  mode: ChatMode;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  tokensConsumed: number;
}

interface Project {
  id: string;
  title: string;
  projectType: "product" | "learning";
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

export default function UnorganizedPage() {
  const [conversations, setConversations] = useState<UnorganizedConversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [showOrganizeModal, setShowOrganizeModal] = useState(false);
  const [organizingId, setOrganizingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [convResponse, projectResponse] = await Promise.all([
          fetch("/api/conversations?unorganizedOnly=true"),
          fetch("/api/projects"),
        ]);

        const convData = await convResponse.json();
        const projectData = await projectResponse.json();

        if (convData.success) {
          setConversations(convData.data.items || convData.data);
        }
        if (projectData.success) {
          setProjects(projectData.data.items || projectData.data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

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

  const handleOrganize = async (conversationId: string, projectId: string) => {
    setOrganizingId(conversationId);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/organize`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        setSelectedConversations((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
      }
    } catch (error) {
      console.error("Failed to organize conversation:", error);
    } finally {
      setOrganizingId(null);
      setShowOrganizeModal(false);
    }
  };

  const handleDismiss = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/organize`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convertToLearning: true }),
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      }
    } catch (error) {
      console.error("Failed to dismiss conversation:", error);
    }
  };

  const handleDelete = async (conversationId: string) => {
    if (!confirm("この会話を削除しますか？")) return;

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const handleBulkOrganize = async (projectId: string) => {
    const ids = Array.from(selectedConversations);
    for (const id of ids) {
      await handleOrganize(id, projectId);
    }
    setShowOrganizeModal(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedConversations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedConversations.size === conversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(conversations.map((c) => c.id)));
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">未整理の会話</h1>
          <p className="text-muted-foreground">
            プロジェクトに紐づいていない会話を整理する
          </p>
        </div>
        {conversations.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              {selectedConversations.size === conversations.length
                ? "選択解除"
                : "すべて選択"}
            </button>
            {selectedConversations.size > 0 && (
              <button
                onClick={() => setShowOrganizeModal(true)}
                className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">folder</span>
                一括整理 ({selectedConversations.size})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Conversation list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">
            check_circle
          </span>
          <p className="text-muted-foreground">未整理の会話はありません</p>
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
            const isSelected = selectedConversations.has(conversation.id);
            const isOrganizing = organizingId === conversation.id;

            return (
              <div
                key={conversation.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border transition-colors group",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelection(conversation.id)}
                  className={cn(
                    "size-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 hover:border-primary/50"
                  )}
                >
                  {isSelected && (
                    <span className="material-symbols-outlined text-sm">check</span>
                  )}
                </button>

                {/* Mode icon */}
                <div
                  className={cn(
                    "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    config.bgColor,
                    config.color
                  )}
                >
                  <span className="material-symbols-outlined">{config.icon}</span>
                </div>

                {/* Content */}
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

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Quick organize dropdown */}
                  <div className="relative group/dropdown">
                    <button
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      disabled={isOrganizing}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {isOrganizing ? "sync" : "folder"}
                      </span>
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-10">
                      <div className="p-1">
                        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                          プロジェクトに整理
                        </div>
                        {projects.slice(0, 5).map((project) => (
                          <button
                            key={project.id}
                            onClick={() => handleOrganize(conversation.id, project.id)}
                            className="w-full px-2 py-1.5 text-sm text-left rounded hover:bg-muted transition-colors truncate"
                          >
                            {project.title}
                          </button>
                        ))}
                        {projects.length > 5 && (
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            他{projects.length - 5}件...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={() => handleDismiss(conversation.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="学びとして整理"
                  >
                    <span className="material-symbols-outlined text-xl">school</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(conversation.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk organize modal */}
      {showOrganizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold">一括整理</h2>
              <p className="text-sm text-muted-foreground">
                {selectedConversations.size}件の会話をプロジェクトに整理
              </p>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  プロジェクトがありません
                </p>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleBulkOrganize(project.id)}
                      className="w-full p-3 text-left rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <div className="font-medium">{project.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {project.projectType === "product"
                          ? "プロダクト開発"
                          : "学習プロジェクト"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowOrganizeModal(false)}
                className="px-4 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
