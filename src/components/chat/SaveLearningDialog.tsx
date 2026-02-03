"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SaveLearningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  conversationId?: string;
}

// Common tags for quick selection
const SUGGESTED_TAGS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "セキュリティ",
  "パフォーマンス",
  "設計パターン",
  "データベース",
  "API",
  "テスト",
];

export function SaveLearningDialog({
  open,
  onOpenChange,
  content,
  conversationId,
}: SaveLearningDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  // Reset state when dialog opens with new content
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setEditedContent(content);
      setSelectedTags([]);
      setCustomTag("");
    }
    onOpenChange(newOpen);
  }, [content, onOpenChange]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const addCustomTag = useCallback(() => {
    const trimmed = customTag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
      setCustomTag("");
    }
  }, [customTag, selectedTags]);

  const handleSave = async () => {
    if (!editedContent.trim()) {
      toast.error("内容を入力してください");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editedContent.trim(),
          tags: selectedTags,
          type: "insight",
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "保存に失敗しました");
      }

      toast.success("学びを保存しました", {
        description: `${selectedTags.length > 0 ? `タグ: ${selectedTags.join(", ")}` : "タグなし"}`,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">bookmark_add</span>
            学びとして保存
          </DialogTitle>
          <DialogDescription>
            AIの回答から重要なポイントを学びとして保存できます
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Content Preview/Edit */}
          <div className="space-y-2">
            <label className="text-sm font-medium">内容</label>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-40 p-3 rounded-lg border border-border bg-muted/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="保存する内容..."
            />
          </div>

          {/* Tag Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">タグ（任意）</label>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                    selectedTags.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder="カスタムタグを追加..."
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addCustomTag}
                disabled={!customTag.trim()}
              >
                追加
              </Button>
            </div>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="text-xs text-muted-foreground">選択中:</span>
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary"
                  >
                    {tag}
                    <button
                      onClick={() => toggleTag(tag)}
                      className="hover:text-primary-foreground"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !editedContent.trim()}>
            {isSaving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base mr-1">
                  progress_activity
                </span>
                保存中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base mr-1">bookmark</span>
                保存
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
