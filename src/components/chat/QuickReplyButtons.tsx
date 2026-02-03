"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { QuickReply } from "@/types/chat";

interface QuickReplyButtonsProps {
  replies: QuickReply[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  layout?: "horizontal" | "vertical" | "grid";
  allowCustomInput?: boolean;
}

export function QuickReplyButtons({
  replies,
  onSelect,
  disabled = false,
  layout = "grid",
  allowCustomInput = true,
}: QuickReplyButtonsProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustomInput]);

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onSelect(customValue.trim());
      setCustomValue("");
      setShowCustomInput(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleCustomSubmit();
    } else if (e.key === "Escape") {
      setShowCustomInput(false);
      setCustomValue("");
    }
  };
  // Group replies by category if groups exist
  const groupedReplies = replies.reduce<Record<string, QuickReply[]>>(
    (acc, reply) => {
      const group = reply.group ?? "default";
      if (!acc[group]) acc[group] = [];
      acc[group].push(reply);
      return acc;
    },
    {}
  );

  const hasGroups = Object.keys(groupedReplies).length > 1;

  const layoutClasses = {
    horizontal: "flex flex-wrap gap-2",
    vertical: "flex flex-col gap-2",
    grid: "grid grid-cols-2 gap-2",
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary text-lg">
          touch_app
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {disabled ? "選択済み" : "選択してください"}
        </span>
      </div>

      {hasGroups ? (
        <div className="space-y-4">
          {Object.entries(groupedReplies).map(([group, groupReplies]) => (
            <div key={group}>
              {group !== "default" && (
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  {group}
                </p>
              )}
              <div className={layoutClasses[layout]}>
                {groupReplies.map((reply) => (
                  <QuickReplyButton
                    key={reply.id}
                    reply={reply}
                    onSelect={onSelect}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={layoutClasses[layout]}>
          {replies.map((reply) => (
            <QuickReplyButton
              key={reply.id}
              reply={reply}
              onSelect={onSelect}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* その他（自由入力）オプション */}
      {allowCustomInput && !disabled && (
        <div className="mt-3">
          {showCustomInput ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="自由に入力してください..."
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg border border-border bg-card text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                )}
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customValue.trim()}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                  customValue.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomValue("");
                }}
                className="px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomInput(true)}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm",
                "border-dashed border-border hover:border-primary/50 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              <span>その他（自由入力）</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface QuickReplyButtonProps {
  reply: QuickReply;
  onSelect: (value: string) => void;
  disabled: boolean;
}

function QuickReplyButton({ reply, onSelect, disabled }: QuickReplyButtonProps) {
  const variantStyles = {
    default: "border-border bg-card hover:bg-muted/50 hover:border-primary/50",
    primary: "border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary",
    secondary: "border-secondary/50 bg-secondary/10 hover:bg-secondary/20",
    outline: "border-border bg-transparent hover:bg-muted/30 hover:border-primary/50",
  };

  const variant = reply.variant ?? "default";

  return (
    <button
      onClick={() => onSelect(reply.value)}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : variantStyles[variant]
      )}
    >
      {reply.icon && (
        <span className="material-symbols-outlined text-lg">
          {reply.icon}
        </span>
      )}
      <span>{reply.label}</span>
    </button>
  );
}

// Preset quick replies for common scenarios
export const COMMON_QUICK_REPLIES = {
  understanding: [
    { id: "understand", label: "理解できた", value: "理解できました", variant: "primary" as const },
    { id: "partial", label: "少し分からない", value: "少し分からない部分があります", variant: "outline" as const },
    { id: "confused", label: "よく分からない", value: "よく分かりません、もう少し詳しく教えてください", variant: "outline" as const },
  ],

  nextAction: [
    { id: "continue", label: "続ける", value: "続けてください", icon: "arrow_forward", variant: "primary" as const },
    { id: "example", label: "例を見せて", value: "具体的な例を見せてください", icon: "code", variant: "outline" as const },
    { id: "skip", label: "スキップ", value: "この部分はスキップします", icon: "skip_next", variant: "outline" as const },
  ],

  confirmation: [
    { id: "yes", label: "はい", value: "はい", variant: "primary" as const },
    { id: "no", label: "いいえ", value: "いいえ", variant: "outline" as const },
    { id: "maybe", label: "分からない", value: "分かりません", variant: "outline" as const },
  ],

  reflection: [
    { id: "good", label: "よく理解できた", value: "good", icon: "sentiment_satisfied", variant: "primary" as const },
    { id: "okay", label: "まあまあ", value: "okay", icon: "sentiment_neutral", variant: "outline" as const },
    { id: "difficult", label: "難しかった", value: "difficult", icon: "sentiment_dissatisfied", variant: "outline" as const },
  ],
} as const;
