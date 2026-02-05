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
        {messages.length === 0 ? (
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

  const suggestions: Record<ChatMode, string[]> = {
    explanation: [
      "このコードの動作を説明して",
      "この関数は何をしている？",
      "この構文の意味を教えて",
      "このパターンを理解したい",
    ],
    generation: [
      "ログイン機能を実装したい",
      "データをソートする関数を作りたい",
      "APIからデータを取得したい",
      "フォームのバリデーションを実装したい",
    ],
    brainstorm: [
      "データベース設計を相談したい",
      "アーキテクチャの選択肢を知りたい",
      "このエラーの原因を一緒に考えたい",
      "コードレビューをお願いしたい",
    ],
  };

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
          こんな質問から始めてみましょう:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {suggestions[mode].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick?.(suggestion)}
              className={cn(
                "text-left p-2.5 sm:p-3 rounded-lg border border-border bg-card transition-all text-xs sm:text-sm",
                config.hoverBgColor,
                "hover:border-primary/50 active:scale-[0.98]"
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
