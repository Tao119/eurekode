"use client";

import { useState, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatModeSelector } from "./ChatModeSelector";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { MODE_CONFIG, MODE_ICON_SIZES } from "@/config/modes";
import type { Message, ChatMode, ConversationBranch, FileAttachment } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatContainerProps {
  mode: ChatMode;
  messages: Message[];
  isLoading: boolean;
  /** 会話履歴のロード中かどうか */
  isLoadingHistory?: boolean;
  onSendMessage: (message: string, attachments?: FileAttachment[]) => void;
  welcomeMessage?: string;
  inputPlaceholder?: string;
  // Stop & Fork functionality
  onStopGeneration?: () => void;
  onForkFromMessage?: (messageIndex: number) => void;
  branches?: ConversationBranch[];
  currentBranchId?: string;
  onSwitchBranch?: (branchId: string) => void;
  // Regenerate functionality
  onRegenerate?: () => void;
  canRegenerate?: boolean;
  // Project selector
  headerExtra?: React.ReactNode;
  // Conversation ID for saving learnings
  conversationId?: string;
}

export function ChatContainer({
  mode,
  messages,
  isLoading,
  isLoadingHistory = false,
  onSendMessage,
  welcomeMessage,
  inputPlaceholder,
  onStopGeneration,
  onForkFromMessage,
  branches = [],
  currentBranchId,
  onSwitchBranch,
  onRegenerate,
  canRegenerate = false,
  headerExtra,
  conversationId,
}: ChatContainerProps) {
  const { containerRef, endRef } = useAutoScroll(messages);
  const [showBranchSelector, setShowBranchSelector] = useState(false);

  // Scroll to target message from learning detail page
  useEffect(() => {
    if (messages.length === 0) return;
    const target = sessionStorage.getItem("learning-scroll-target");
    if (!target) return;
    sessionStorage.removeItem("learning-scroll-target");

    // Find the message matching the sourceMessage content
    const msgIndex = messages.findIndex(
      (m) => m.role === "assistant" && m.content === target
    );
    if (msgIndex === -1) return;

    // Wait for DOM to render, then scroll
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${msgIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary/50", "rounded-lg");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary/50", "rounded-lg");
        }, 3000);
      }
    });
  }, [messages]);

  const hasBranches = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Header */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-4xl px-2 sm:px-4 py-2 sm:py-3">
          {/* Single row layout */}
          <div className="flex items-center justify-between gap-2">
            {/* Mode Selector (dropdown with new chat option) */}
            <ChatModeSelector currentMode={mode} conversationId={conversationId} />

            {/* Right: Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Header Extra (Project Selector etc.) */}
              {headerExtra}

              {/* Branch Selector - Hidden on mobile */}
              {hasBranches && (
                <div className="relative shrink-0 hidden sm:block">
                  <button
                    onClick={() => setShowBranchSelector(!showBranchSelector)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-sm whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-base">fork_right</span>
                    <span>{currentBranch?.name || "メイン"}</span>
                    <span className="material-symbols-outlined text-base">
                      {showBranchSelector ? "expand_less" : "expand_more"}
                    </span>
                  </button>

                  {showBranchSelector && (
                    <BranchSelector
                      branches={branches}
                      currentBranchId={currentBranchId}
                      onSelect={(branchId) => {
                        onSwitchBranch?.(branchId);
                        setShowBranchSelector(false);
                      }}
                      onClose={() => setShowBranchSelector(false)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0">
        {isLoadingHistory ? (
          <ChatLoadingSkeleton />
        ) : messages.length === 0 ? (
          <WelcomeScreen
            mode={mode}
            welcomeMessage={welcomeMessage}
            onSuggestionClick={onSendMessage}
          />
        ) : (
          <div className="mx-auto max-w-4xl pb-4">
            {messages.map((message, index) => {
              // Find if this is the last assistant message
              const isLastAssistantMessage =
                message.role === "assistant" &&
                !messages.slice(index + 1).some((m) => m.role === "assistant");

              const isStreamingMessage =
                isLoading && index === messages.length - 1 && message.role === "assistant";

              return (
                <div key={message.id || index} id={`msg-${index}`}>
                  <ChatMessage
                    message={message}
                    isStreaming={isStreamingMessage}
                    onOptionSelect={!isLoading && isLastAssistantMessage ? onSendMessage : undefined}
                    onFork={onForkFromMessage ? () => onForkFromMessage(index) : undefined}
                    showForkButton={!isLoading && index < messages.length - 1}
                    onRegenerate={onRegenerate}
                    showRegenerateButton={!isLoading && isLastAssistantMessage && canRegenerate}
                    mode={mode}
                    conversationId={conversationId}
                  />
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <ChatInput
          onSend={onSendMessage}
          onStop={onStopGeneration}
          isLoading={isLoading}
          placeholder={inputPlaceholder}
        />
      </div>
    </div>
  );
}

// Branch Selector Dropdown
function BranchSelector({
  branches,
  currentBranchId,
  onSelect,
  onClose,
}: {
  branches: ConversationBranch[];
  currentBranchId?: string;
  onSelect: (branchId: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-10" onClick={onClose} />

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="material-symbols-outlined text-base">history</span>
            <span>会話の分岐</span>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {branches.map((branch) => {
            const isActive = branch.id === currentBranchId;
            const isMain = !branch.parentBranchId;

            return (
              <button
                key={branch.id}
                onClick={() => onSelect(branch.id)}
                className={cn(
                  "w-full text-left px-3 py-2 flex items-center gap-3 transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/50"
                )}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-lg",
                    isMain ? "text-blue-400" : "text-orange-400"
                  )}
                >
                  {isMain ? "timeline" : "fork_right"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{branch.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {isMain
                      ? "オリジナル"
                      : `メッセージ ${branch.forkPointIndex + 1} から分岐`}
                  </div>
                </div>
                {isActive && (
                  <span className="material-symbols-outlined text-primary text-lg">check</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            メッセージをホバーして「分岐」ボタンをクリックすると、その時点から新しい会話を始められます
          </p>
        </div>
      </div>
    </>
  );
}

// Module-level constant to avoid recreating on every render
const WELCOME_SUGGESTIONS: Record<ChatMode, ReadonlyArray<{ text: string; icon: string }>> = {
  explanation: [
    { text: "コードを貼り付けて解説を聞く", icon: "code" },
    { text: "エラーメッセージを貼り付けて原因を探る", icon: "bug_report" },
    { text: "async/await の使い方を理解したい", icon: "sync" },
    { text: "配列メソッドの違いを教えて", icon: "format_list_numbered" },
  ],
  generation: [
    { text: "React でログインフォームを作りたい", icon: "login" },
    { text: "Python で CSV ファイルを処理したい", icon: "description" },
    { text: "REST API のエンドポイントを実装したい", icon: "api" },
    { text: "データベースに接続するコードが欲しい", icon: "storage" },
  ],
  brainstorm: [
    { text: "新しいアプリのアイデアを整理したい", icon: "lightbulb" },
    { text: "技術スタックの選定を相談したい", icon: "build" },
    { text: "プロジェクトの設計を一緒に考えたい", icon: "architecture" },
    { text: "機能の優先順位を決めたい", icon: "checklist" },
  ],
} as const;

function WelcomeScreen({
  mode,
  welcomeMessage,
  onSuggestionClick,
}: {
  mode: ChatMode;
  welcomeMessage?: string;
  onSuggestionClick?: (message: string) => void;
}) {
  const config = MODE_CONFIG[mode];
  const suggestions = WELCOME_SUGGESTIONS[mode];

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8">
      <div
        className={cn(
          "rounded-2xl flex items-center justify-center mb-4 sm:mb-6",
          "size-16 sm:size-20",
          config.bgColor,
          config.color
        )}
      >
        <span className="material-symbols-outlined text-3xl sm:text-4xl">{config.icon}</span>
      </div>

      <h2 className="text-xl sm:text-2xl font-bold mb-2">{config.title}</h2>

      {welcomeMessage && (
        <p className="text-muted-foreground text-center max-w-md mb-6 sm:mb-8 text-sm sm:text-base">
          {welcomeMessage}
        </p>
      )}

      <div className="w-full max-w-lg px-2">
        <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
          クリックして始める:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick?.(suggestion.text)}
              className={cn(
                "flex items-center gap-3 text-left p-3 sm:p-4 rounded-lg border border-border bg-card transition-all text-xs sm:text-sm",
                config.hoverBgColor,
                "hover:border-primary/50 hover:shadow-sm active:scale-[0.98]"
              )}
            >
              <span className={cn("material-symbols-outlined text-lg", config.color)}>
                {suggestion.icon}
              </span>
              <span className="flex-1">{suggestion.text}</span>
            </button>
          ))}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-border/50">
          <p className="text-[10px] sm:text-xs text-muted-foreground text-center mb-2">
            💡 ヒント
          </p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">⌘/Ctrl + Enter</kbd>
              <span>送信</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">Shift + Enter</kbd>
              <span>改行</span>
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
            コードを貼り付けると自動で解析されます
          </p>
        </div>
      </div>
    </div>
  );
}

// Skeleton component for loading state
function ChatLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-4xl pb-4 animate-pulse">
      {/* User message skeleton */}
      <div className="flex gap-4 px-4 py-6">
        <div className="size-8 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
        </div>
      </div>
      {/* Assistant message skeleton */}
      <div className="flex gap-4 px-4 py-6 bg-muted/30">
        <div className="size-8 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-5/6 bg-muted rounded" />
          <div className="h-4 w-2/3 bg-muted rounded" />
        </div>
      </div>
      {/* User message skeleton */}
      <div className="flex gap-4 px-4 py-6">
        <div className="size-8 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
        </div>
      </div>
      {/* Assistant message skeleton */}
      <div className="flex gap-4 px-4 py-6 bg-muted/30">
        <div className="size-8 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-4/5 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
