"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatModeSelector } from "./ChatModeSelector";
import { ExplanationCodePanel, MobileExplanationCodeSheet } from "./ExplanationCodePanel";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useExplanationMode } from "@/hooks/useExplanationMode";
import { parseLineReferences, findFirstCodeBlockInMessages } from "@/lib/line-reference-parser";
import { MODE_CONFIG } from "@/config/modes";
import type { Message, ConversationBranch, FileAttachment } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ExplanationChatContainerProps {
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
  // Header extras (project selector etc.)
  headerExtra?: React.ReactNode;
  // Conversation ID for persistence
  conversationId?: string;
}

export function ExplanationChatContainer({
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
}: ExplanationChatContainerProps) {
  const { containerRef, endRef } = useAutoScroll(messages);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [isCodePanelCollapsed, setIsCodePanelCollapsed] = useState(false);
  const [isMobileCodeSheetOpen, setIsMobileCodeSheetOpen] = useState(false);
  const hasBranches = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);

  // 解説モードの状態管理
  const {
    state: codeState,
    setSourceCode,
    setHighlightedLines,
    clearHighlightedLines,
    toggleBookmark,
    markSectionExplained,
    generateLineQuestion,
    resetScrollTarget,
    hasCode,
  } = useExplanationMode({ conversationId });

  // 前回処理したメッセージ数を追跡
  const prevMessagesLengthRef = useRef(0);
  const lastProcessedContentRef = useRef<string>("");

  // メッセージからコードを抽出（ユーザーが貼り付けたコード）
  useEffect(() => {
    if (messages.length === 0) return;
    if (hasCode) return; // すでにコードがある場合はスキップ

    // ユーザーメッセージから最初のコードブロックを検索
    const codeBlock = findFirstCodeBlockInMessages(messages);
    if (codeBlock) {
      setSourceCode(codeBlock.code, codeBlock.language, "user-paste");
    }
  }, [messages, hasCode, setSourceCode]);

  // AI応答から行参照を抽出してハイライト
  useEffect(() => {
    if (isLoading) return; // ストリーミング中はスキップ
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return;

    // 同じコンテンツは処理しない
    if (lastProcessedContentRef.current === lastMessage.content) return;
    lastProcessedContentRef.current = lastMessage.content;

    // 行参照を抽出
    const refs = parseLineReferences(lastMessage.content);
    if (refs.allLines.length > 0) {
      setHighlightedLines(refs.allLines);

      // ハイライトした範囲を解説済みとしてマーク
      if (refs.allLines.length > 0) {
        const min = Math.min(...refs.allLines);
        const max = Math.max(...refs.allLines);
        markSectionExplained(min, max);
      }
    } else {
      clearHighlightedLines();
    }
  }, [messages, isLoading, setHighlightedLines, clearHighlightedLines, markSectionExplained]);

  // Scroll to target message from learning detail page
  useEffect(() => {
    if (messages.length === 0) return;
    const target = sessionStorage.getItem("learning-scroll-target");
    if (!target) return;
    sessionStorage.removeItem("learning-scroll-target");

    const msgIndex = messages.findIndex(
      (m) => m.role === "assistant" && m.content === target
    );
    if (msgIndex === -1) return;

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

  // 行クリック時の処理
  const handleLineClick = useCallback(
    (lineNumber: number) => {
      const prompt = generateLineQuestion(lineNumber);
      onSendMessage(prompt);
    },
    [generateLineQuestion, onSendMessage]
  );

  // ブックマーク切り替え
  const handleBookmarkToggle = useCallback(
    (lineNumber: number) => {
      toggleBookmark(lineNumber);
    },
    [toggleBookmark]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Header */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Mode Selector */}
            <ChatModeSelector currentMode="explanation" conversationId={conversationId} />

            {/* Right: Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Header Extra (Project Selector etc.) - Hidden on mobile */}
              <div className="hidden sm:flex items-center gap-2">
                {headerExtra}
              </div>

              {/* Code Panel Toggle - Desktop only */}
              {hasCode && (
                <button
                  onClick={() => setIsCodePanelCollapsed(!isCodePanelCollapsed)}
                  className={cn(
                    "hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-sm",
                    isCodePanelCollapsed
                      ? "border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <span className="material-symbols-outlined text-base">
                    {isCodePanelCollapsed ? "dock_to_left" : "dock_to_right"}
                  </span>
                  <span>{isCodePanelCollapsed ? "コードを表示" : "コードを非表示"}</span>
                </button>
              )}

              {/* Branch Selector - Desktop only */}
              {hasBranches && (
                <div className="relative hidden md:block shrink-0">
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

      {/* Main Content - Split View */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Panel - Chat */}
        <div
          className={cn(
            "flex flex-col min-h-0 transition-all duration-300 w-full",
            hasCode && !isCodePanelCollapsed && "md:w-1/2"
          )}
        >
          {/* Messages */}
          <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0">
            {messages.length === 0 ? (
              <WelcomeScreen
                welcomeMessage={welcomeMessage}
                onSuggestionClick={onSendMessage}
              />
            ) : (
              <div className="mx-auto max-w-3xl pb-4">
                {messages.map((message, index) => {
                  const isLastAssistantMessage =
                    message.role === "assistant" &&
                    !messages.slice(index + 1).some((m) => m.role === "assistant");

                  return (
                    <div key={message.id || index} id={`msg-${index}`}>
                      <ChatMessage
                        message={message}
                        isStreaming={isLoading && index === messages.length - 1 && message.role === "assistant"}
                        onOptionSelect={!isLoading && isLastAssistantMessage ? onSendMessage : undefined}
                        onFork={onForkFromMessage ? () => onForkFromMessage(index) : undefined}
                        showForkButton={!isLoading && index < messages.length - 1}
                        onRegenerate={onRegenerate}
                        showRegenerateButton={!isLoading && isLastAssistantMessage && canRegenerate}
                        mode="explanation"
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
              placeholder={inputPlaceholder || "コードを貼り付けるか、質問を入力してください..."}
            />
          </div>
        </div>

        {/* Mobile FAB - Show Code Sheet */}
        {hasCode && (
          <button
            onClick={() => setIsMobileCodeSheetOpen(true)}
            className={cn(
              "md:hidden fixed bottom-24 right-4 z-30",
              "flex items-center justify-center",
              "size-14 rounded-full shadow-lg",
              "bg-blue-500 text-white",
              "hover:bg-blue-400 active:scale-95",
              "transition-all duration-200"
            )}
          >
            <span className="material-symbols-outlined text-2xl">code</span>
          </button>
        )}

        {/* Mobile Code Bottom Sheet */}
        {hasCode && codeState.sourceCode && (
          <MobileExplanationCodeSheet
            isOpen={isMobileCodeSheetOpen}
            onClose={() => setIsMobileCodeSheetOpen(false)}
            code={codeState.sourceCode}
            language={codeState.language}
            filename={codeState.filename}
            highlightedLines={codeState.highlightedLines}
            bookmarks={codeState.bookmarks}
            onLineClick={handleLineClick}
            onBookmarkToggle={handleBookmarkToggle}
          />
        )}

        {/* Right Panel - Code - Desktop Only */}
        {hasCode && !isCodePanelCollapsed && codeState.sourceCode && (
          <ExplanationCodePanel
            code={codeState.sourceCode}
            language={codeState.language}
            filename={codeState.filename}
            highlightedLines={codeState.highlightedLines}
            previousHighlightedLines={codeState.previousHighlightedLines}
            bookmarks={codeState.bookmarks}
            explainedRanges={codeState.explainedRanges}
            onLineClick={handleLineClick}
            onBookmarkToggle={handleBookmarkToggle}
            onClose={() => setIsCodePanelCollapsed(true)}
            scrollToLine={codeState.scrollToLine}
            onScrollComplete={resetScrollTarget}
          />
        )}
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
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
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
                    {isMain ? "オリジナル" : `メッセージ ${branch.forkPointIndex + 1} から分岐`}
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

// ウェルカムスクリーン
function WelcomeScreen({
  welcomeMessage,
  onSuggestionClick,
}: {
  welcomeMessage?: string;
  onSuggestionClick?: (message: string) => void;
}) {
  const config = MODE_CONFIG.explanation;

  const suggestions = [
    "このコードを理解したい",
    "このエラーの原因を知りたい",
    "この関数の動作を説明して",
    "リファクタリングの提案をして",
  ];

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
        <p className="text-muted-foreground text-center max-w-md mb-4 text-sm sm:text-base">
          {welcomeMessage}
        </p>
      )}

      {/* 学習のポイント */}
      <div className="w-full max-w-md mb-6 sm:mb-8 p-3 sm:p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn("material-symbols-outlined text-lg sm:text-xl", config.color)}>info</span>
          <span className={cn("font-medium text-sm sm:text-base", config.color)}>使い方</span>
        </div>
        <ul className="text-xs sm:text-sm text-foreground/80 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-xs sm:text-sm mt-0.5", config.color)}>check</span>
            <span>コードを貼り付けると右パネルに表示されます</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-xs sm:text-sm mt-0.5", config.color)}>check</span>
            <span>AIが解説している行が自動でハイライトされます</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-xs sm:text-sm mt-0.5", config.color)}>check</span>
            <span>行をクリックすると、その行について質問できます</span>
          </li>
        </ul>
      </div>

      <div className="w-full max-w-lg px-2">
        <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
          こんな質問から始めてみましょう:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {suggestions.map((suggestion, index) => (
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
