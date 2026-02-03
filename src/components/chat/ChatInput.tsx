"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  isLoading = false,
  placeholder = "メッセージを入力...",
  maxLength = 4000,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled && !isLoading) {
      onSend(trimmed);
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME変換中（日本語入力の確定など）はスキップ
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleButtonClick = () => {
    if (isLoading && onStop) {
      onStop();
    } else {
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-4xl p-4">
        <div className="relative flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, maxLength))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-12",
                "text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "min-h-[48px] max-h-[200px]"
              )}
            />
            <div className="absolute right-3 bottom-3 text-xs text-muted-foreground">
              {input.length}/{maxLength}
            </div>
          </div>

          {/* Send/Stop Button */}
          <Button
            onClick={handleButtonClick}
            disabled={!isLoading && (disabled || !input.trim())}
            size="icon"
            variant={isLoading ? "destructive" : "default"}
            className={cn(
              "h-12 w-12 rounded-xl shrink-0 transition-all",
              isLoading && "animate-pulse"
            )}
            title={isLoading ? "生成を停止" : "送信"}
          >
            <span className="material-symbols-outlined">
              {isLoading ? "stop" : "send"}
            </span>
          </Button>
        </div>

        <p className="mt-2 text-xs text-center text-muted-foreground">
          {isLoading ? "生成中... クリックで停止" : "Shift + Enter で改行、Enter で送信"}
        </p>
      </div>
    </div>
  );
}
