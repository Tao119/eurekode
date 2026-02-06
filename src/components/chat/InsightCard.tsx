"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { InsightSuggestion } from "@/types/chat";

interface InsightCardProps {
  insight: InsightSuggestion;
  onSave: (insight: InsightSuggestion) => void;
  onDismiss: () => void;
  autoSave?: boolean;
}

export function InsightCard({
  insight,
  onSave,
  onDismiss,
  autoSave = false,
}: InsightCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(insight.content);
  const [editedTags, setEditedTags] = useState(insight.tags);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    const updatedInsight = {
      ...insight,
      content: editedContent,
      tags: editedTags,
    };
    onSave(updatedInsight);
    setIsSaved(true);
    setIsEditing(false);
  };

  const handleAddTag = (tag: string) => {
    if (tag && !editedTags.includes(tag)) {
      setEditedTags([...editedTags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditedTags(editedTags.filter((t) => t !== tag));
  };

  if (isSaved) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-green-500/30 bg-green-500/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-green-400">
            check_circle
          </span>
          <span className="font-medium text-green-400">学びを保存しました</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg">
              lightbulb
            </span>
          </div>
          <span className="font-semibold text-primary">気づきカード</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              {isEditing ? "close" : "edit"}
            </span>
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              close
            </span>
          </button>
        </div>
      </div>

      {/* Title */}
      <h4 className="font-bold text-foreground mb-2">{insight.title}</h4>

      {/* Content */}
      {isEditing ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="学びの内容を編集..."
        />
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {editedContent}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {editedTags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              "bg-primary/10 text-primary"
            )}
          >
            {tag}
            {isEditing && (
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-primary/70"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </span>
        ))}
        {isEditing && (
          <TagInput onAdd={handleAddTag} />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          {isEditing ? "保存する" : "この内容で保存"}
        </button>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            編集する
          </button>
        )}
      </div>
    </div>
  );
}

function TagInput({ onAdd }: { onAdd: (tag: string) => void }) {
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        タグを追加
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") setIsOpen(false);
        }}
        className="w-24 px-2 py-1 rounded text-xs border border-primary bg-background focus:outline-none"
        placeholder="タグ名"
        autoFocus
      />
      <button
        onClick={handleSubmit}
        className="p-2 rounded hover:bg-muted/50"
        aria-label="タグを追加"
      >
        <span className="material-symbols-outlined text-sm text-primary" aria-hidden="true">check</span>
      </button>
      <button
        onClick={() => setIsOpen(false)}
        className="p-2 rounded hover:bg-muted/50"
        aria-label="キャンセル"
      >
        <span className="material-symbols-outlined text-sm text-muted-foreground" aria-hidden="true">close</span>
      </button>
    </div>
  );
}

// Compact version for inline use
interface InsightSuggestionBannerProps {
  insight: InsightSuggestion;
  onSave: () => void;
  onExpand: () => void;
}

export function InsightSuggestionBanner({
  insight,
  onSave,
  onExpand,
}: InsightSuggestionBannerProps) {
  return (
    <div className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center gap-3">
      <span className="material-symbols-outlined text-primary">
        lightbulb
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{insight.title}</p>
        <p className="text-xs text-muted-foreground truncate">{insight.content}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onSave}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          保存
        </button>
        <button
          onClick={onExpand}
          className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
        >
          <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
      </div>
    </div>
  );
}
