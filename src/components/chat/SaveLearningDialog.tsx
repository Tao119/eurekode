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
import { toast } from "sonner";

interface SaveLearningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  sourceMessage: string;
  conversationId?: string;
  onSaveSuccess?: () => void;
}

export function SaveLearningDialog({
  open,
  onOpenChange,
  content,
  sourceMessage,
  conversationId,
  onSaveSuccess,
}: SaveLearningDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [memo, setMemo] = useState("");
  const [showSource, setShowSource] = useState(false);

  const isPartialSelection = content !== sourceMessage;

  // Reset state when dialog opens with new content
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setEditedContent(content);
      setMemo("");
      setShowSource(false);
    }
    onOpenChange(newOpen);
  }, [content, onOpenChange]);

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
          sourceMessage,
          memo: memo.trim() || undefined,
          tags: [],
          type: "insight",
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "保存に失敗しました");
      }

      toast.success("学びを保存しました");
      onSaveSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <span className="material-symbols-outlined text-primary text-xl sm:text-2xl">bookmark_add</span>
            学びとして保存
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            AIの回答から重要なポイントを学びとして保存
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4">
          {/* Content Preview/Edit */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-xs sm:text-sm font-medium">保存する内容</label>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-32 sm:h-40 p-2.5 sm:p-3 rounded-lg border border-border bg-muted/30 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="保存する内容..."
            />
          </div>

          {/* Memo */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-500 text-sm">edit_note</span>
              メモ（任意）
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full h-20 sm:h-24 p-2.5 sm:p-3 rounded-lg border border-border bg-muted/30 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="この学びについてメモを追加..."
            />
          </div>

          {/* Source Message (collapsible, only for partial selections) */}
          {isPartialSelection && (
            <div className="rounded-lg border border-border bg-muted/30">
              <button
                type="button"
                onClick={() => setShowSource((prev) => !prev)}
                className="w-full flex items-center justify-between p-2.5 sm:p-3 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">smart_toy</span>
                  <span>元のAIメッセージを見る</span>
                </div>
                <span className="material-symbols-outlined text-sm">
                  {showSource ? "expand_less" : "expand_more"}
                </span>
              </button>
              {showSource && (
                <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3 max-h-48 overflow-y-auto">
                  <p className="whitespace-pre-wrap text-foreground/70 text-[10px] sm:text-xs leading-relaxed">
                    {sourceMessage}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-3 sm:mt-4 gap-2 sm:gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !editedContent.trim()} className="w-full sm:w-auto">
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
