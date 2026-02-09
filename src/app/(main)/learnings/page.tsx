"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLearnings } from "@/hooks/useLearnings";
import { LearningCard } from "@/components/learnings/LearningCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Learning, LearningType } from "@/types/learning";

type FilterType = "all" | "insight" | "reflection";

function LearningsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLearning, setSelectedLearning] = useState<Learning | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [learningToDelete, setLearningToDelete] = useState<Learning | null>(null);

  const {
    learnings,
    isLoading,
    hasMore,
    total,
    fetchLearnings,
    deleteLearning,
    setFilters,
  } = useLearnings({
    initialLimit: 20,
    autoFetch: true,
    initialFilter: filterType !== "all" ? { type: filterType as LearningType } : {},
  });

  const handleFilterChange = useCallback(
    (type: FilterType) => {
      setFilterType(type);
      setFilters(type !== "all" ? { type: type as LearningType } : {});
    },
    [setFilters]
  );

  const handleSearch = useCallback(() => {
    setFilters({
      ...(filterType !== "all" && { type: filterType as LearningType }),
      ...(searchQuery && { search: searchQuery }),
    });
  }, [filterType, searchQuery, setFilters]);

  const handleLoadMore = useCallback(() => {
    fetchLearnings({ offset: learnings.length, append: true });
  }, [fetchLearnings, learnings.length]);

  const handleCardClick = useCallback(
    (learning: Learning) => {
      setSelectedLearning(learning);
      router.push(`/learnings?id=${learning.id}`, { scroll: false });
    },
    [router]
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedLearning(null);
    router.push("/learnings", { scroll: false });
  }, [router]);

  const handleDeleteClick = useCallback((learning: Learning) => {
    setLearningToDelete(learning);
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!learningToDelete) return;

    const success = await deleteLearning(learningToDelete.id);
    if (success) {
      setDeleteConfirmOpen(false);
      setLearningToDelete(null);
      if (selectedLearning?.id === learningToDelete.id) {
        handleCloseDetail();
      }
    }
  }, [learningToDelete, deleteLearning, selectedLearning, handleCloseDetail]);

  // Fetch learning by ID when navigating from dashboard (selectedId set but selectedLearning is null)
  useEffect(() => {
    if (!selectedId || selectedLearning) return;

    // First try to find in already-loaded learnings
    const found = learnings.find((l) => l.id === selectedId);
    if (found) {
      setSelectedLearning(found);
      return;
    }

    // If not found in loaded list, fetch from API
    async function fetchLearningById() {
      try {
        const response = await fetch(`/api/learnings/${selectedId}`);
        const data = await response.json();
        if (data.success && data.data) {
          setSelectedLearning(data.data);
        }
      } catch {
        // Silently ignore - dialog will show empty
      }
    }
    fetchLearningById();
  }, [selectedId, selectedLearning, learnings]);

  const filterButtons: { type: FilterType; label: string; icon: string }[] = [
    { type: "all", label: "すべて", icon: "list" },
    { type: "insight", label: "インサイト", icon: "lightbulb" },
    { type: "reflection", label: "振り返り", icon: "psychology" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">学びの記録</h1>
            <p className="text-sm text-muted-foreground">
              {total}件の学びがあります
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          {filterButtons.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => handleFilterChange(type)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                filterType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="material-symbols-outlined text-lg">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="学びを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} variant="outline" size="icon">
            <span className="material-symbols-outlined">search</span>
          </Button>
        </div>
      </div>

      {/* Learning List */}
      {isLoading && learnings.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : learnings.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">
            school
          </span>
          <h3 className="text-lg font-semibold mb-2">まだ学びがありません</h3>
          <p className="text-muted-foreground mb-4">
            チャットで学習して、インサイトや振り返りを記録しましょう。
          </p>
          <Button asChild>
            <Link href="/chat/explanation">
              <span className="material-symbols-outlined mr-2">chat</span>
              学習を始める
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {learnings.map((learning) => (
              <LearningCard
                key={learning.id}
                learning={learning}
                variant="full"
                onClick={() => handleCardClick(learning)}
                onDelete={() => handleDeleteClick(learning)}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined mr-2">
                    expand_more
                  </span>
                )}
                もっと見る
              </Button>
            </div>
          )}
        </>
      )}

      {/* Learning Detail Modal */}
      <Dialog
        open={!!selectedLearning}
        onOpenChange={(open) => !open && handleCloseDetail()}
      >
        <DialogContent className="max-w-2xl">
          {selectedLearning && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      selectedLearning.type === "insight"
                        ? "bg-yellow-500/10 text-yellow-600"
                        : "bg-purple-500/10 text-purple-600"
                    )}
                  >
                    {selectedLearning.type === "insight"
                      ? "インサイト"
                      : "振り返り"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(selectedLearning.createdAt).toLocaleDateString(
                      "ja-JP",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </span>
                </div>
                <DialogTitle className="text-left line-clamp-2">
                  {selectedLearning.content.split("\n")[0]}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  学びの詳細表示
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedLearning.content.split("\n\n").slice(1).join("\n\n")}
                </p>

                {selectedLearning.memo && (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="material-symbols-outlined text-amber-500 text-sm">edit_note</span>
                      <span className="text-xs font-medium text-amber-600">メモ</span>
                    </div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                      {selectedLearning.memo}
                    </p>
                  </div>
                )}

                {selectedLearning.sourceMessage && (
                  <SourceMessageSection sourceMessage={selectedLearning.sourceMessage} />
                )}

                {selectedLearning.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedLearning.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {selectedLearning.conversation && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">
                      関連する会話
                    </p>
                    <Link
                      href={`/chat/${selectedLearning.conversation.mode}/${selectedLearning.conversation.id}`}
                      onClick={() => {
                        if (selectedLearning.sourceMessage) {
                          sessionStorage.setItem(
                            "learning-scroll-target",
                            selectedLearning.sourceMessage
                          );
                        }
                      }}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">
                        chat_bubble_outline
                      </span>
                      {selectedLearning.conversation.title || "無題の会話"}
                    </Link>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteClick(selectedLearning)}
                >
                  <span className="material-symbols-outlined mr-2">delete</span>
                  削除
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>学びを削除しますか？</DialogTitle>
            <DialogDescription>
              この操作は取り消せません。本当に削除してよろしいですか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LearningsLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </div>
  );
}

function SourceMessageSection({ sourceMessage }: { sourceMessage: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">smart_toy</span>
          <span>元のAIメッセージ</span>
        </div>
        <span className="material-symbols-outlined text-sm">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 max-h-60 overflow-y-auto">
          <p className="whitespace-pre-wrap text-foreground/70 text-xs leading-relaxed">
            {sourceMessage}
          </p>
        </div>
      )}
    </div>
  );
}

export default function LearningsPage() {
  return (
    <Suspense fallback={<LearningsLoading />}>
      <LearningsContent />
    </Suspense>
  );
}
