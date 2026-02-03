"use client";

import { useState } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { MODE_CONFIG, MODE_ICON_SIZES } from "@/config/modes";
import type { Message, ChatMode, ConversationBranch } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatContainerProps {
  mode: ChatMode;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
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
}: ChatContainerProps) {
  const { containerRef, endRef } = useAutoScroll(messages);
  const config = MODE_CONFIG[mode];
  const iconSize = MODE_ICON_SIZES.header;
  const [showBranchSelector, setShowBranchSelector] = useState(false);

  const hasBranches = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Header */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "rounded-lg flex items-center justify-center",
                  iconSize.container,
                  config.bgColor,
                  config.color
                )}
              >
                <span className={cn("material-symbols-outlined", iconSize.icon)}>
                  {config.icon}
                </span>
              </div>
              <div>
                <h1 className="font-bold text-lg">{config.title}</h1>
                <p className="text-xs text-muted-foreground">
                  {config.shortDescription}
                </p>
              </div>
            </div>

            {/* Branch Selector */}
            {hasBranches && (
              <div className="relative">
                <button
                  onClick={() => setShowBranchSelector(!showBranchSelector)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-sm"
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
                <ChatMessage
                  key={message.id || index}
                  message={message}
                  isStreaming={isStreamingMessage}
                  onOptionSelect={!isLoading && isLastAssistantMessage ? onSendMessage : undefined}
                  onFork={onForkFromMessage ? () => onForkFromMessage(index) : undefined}
                  showForkButton={!isLoading && index < messages.length - 1}
                  onRegenerate={onRegenerate}
                  showRegenerateButton={!isLoading && isLastAssistantMessage && canRegenerate}
                  mode={mode}
                />
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
  const iconSize = MODE_ICON_SIZES.welcome;

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
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div
        className={cn(
          "rounded-2xl flex items-center justify-center mb-6",
          iconSize.container,
          config.bgColor,
          config.color
        )}
      >
        <span className={cn("material-symbols-outlined", iconSize.icon)}>{config.icon}</span>
      </div>

      <h2 className="text-2xl font-bold mb-2">{config.title}</h2>

      {welcomeMessage && (
        <p className="text-muted-foreground text-center max-w-md mb-8">
          {welcomeMessage}
        </p>
      )}

      <div className="w-full max-w-lg">
        <p className="text-sm text-muted-foreground mb-3">
          こんな質問から始めてみましょう:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestions[mode].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick?.(suggestion)}
              className={cn(
                "text-left p-3 rounded-lg border border-border bg-card transition-all text-sm",
                config.hoverBgColor,
                "hover:border-primary/50"
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
