"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { BlurredCode } from "./BlurredCode";
import { GenerationQuiz } from "./GenerationQuiz";
import { GenerationOptionsPopover } from "./GenerationOptionsPopover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import {
  useGenerationMode,
  type UnlockLevel,
  type UnlockQuiz,
  type UseGenerationModeOptions,
  type PersistedGenerationState,
} from "@/hooks/useGenerationMode";
import { useUserSettingsOptional } from "@/contexts/UserSettingsContext";
import { MODE_CONFIG, MODE_ICON_SIZES } from "@/config/modes";
import type { Message, ConversationBranch, Artifact } from "@/types/chat";
import { cn } from "@/lib/utils";
import { parseArtifacts } from "@/lib/artifacts";
import {
  parseStructuredQuiz,
  extractQuizFromText,
  generateFallbackQuiz,
  structuredQuizToUnlockQuiz,
  removeQuizMarkerFromContent,
} from "@/lib/quiz-generator";

interface GenerationChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onSendMessageWithContext?: (message: string, context: Record<string, unknown>) => void;
  welcomeMessage?: string;
  inputPlaceholder?: string;
  canSkip?: boolean;
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
  // Persistence
  conversationId?: string; // クイズ進行状況を保存するためのID
  // 初期状態（会話metadataから読み込み）
  initialGenerationState?: PersistedGenerationState;
}

/**
 * Extract quiz from AI response content
 * Priority: 1. Structured quiz format 2. Text-based extraction
 */
function extractQuizFromResponse(content: string, level: UnlockLevel): UnlockQuiz | null {
  // Try structured quiz format first
  const structuredQuiz = parseStructuredQuiz(content);
  if (structuredQuiz) {
    return structuredQuizToUnlockQuiz(structuredQuiz);
  }

  // Fallback to text-based extraction
  return extractQuizFromText(content, level);
}

export function GenerationChatContainer({
  messages,
  isLoading,
  onSendMessage,
  onSendMessageWithContext,
  welcomeMessage,
  inputPlaceholder,
  canSkip = false,
  onStopGeneration,
  onForkFromMessage,
  branches = [],
  currentBranchId,
  onSwitchBranch,
  onRegenerate,
  canRegenerate = false,
  headerExtra,
  conversationId,
  initialGenerationState,
}: GenerationChatContainerProps) {
  const { containerRef, endRef } = useAutoScroll(messages);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [isCodePanelCollapsed, setIsCodePanelCollapsed] = useState(false);
  const hasBranches = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);

  // Get user settings from context (may be null if not in provider)
  const userSettingsContext = useUserSettingsOptional();

  // Convert user settings to generation options
  const initialOptions = useMemo<UseGenerationModeOptions>(() => {
    const baseOptions: UseGenerationModeOptions = {
      conversationId,
      initialState: initialGenerationState,
    };

    if (!userSettingsContext) return baseOptions;

    const { settings } = userSettingsContext;
    return {
      ...baseOptions,
      unlockMethod: settings.unlockMethod,
      hintSpeed: settings.hintSpeed,
    };
  }, [userSettingsContext, conversationId, initialGenerationState]);

  const {
    state,
    options,
    canCopyCode,
    progressPercentage,
    activeArtifact,
    setPhase,
    setGeneratedCode,
    setCurrentQuiz,
    answerQuiz,
    skipToUnlock,
    updateOptions,
    addOrUpdateArtifact,
    setActiveArtifact,
  } = useGenerationMode(initialOptions);

  const [showPlanningHelper, setShowPlanningHelper] = useState(false);
  const prevMessagesLengthRef = useRef(0);
  const initializedRef = useRef(false);

  // Artifacts list from state
  const artifactsList = useMemo(() => Object.values(state.artifacts), [state.artifacts]);

  // 初期読み込み時にすべてのメッセージからアーティファクトを抽出
  useEffect(() => {
    if (initializedRef.current || messages.length === 0) return;
    initializedRef.current = true;
    prevMessagesLengthRef.current = messages.length;

    // すでにunlocked状態（localStorageから復元）ならスキップ
    if (state.phase === "unlocked" && state.unlockLevel === 4) {
      // アーティファクトのみ抽出（フェーズは変更しない）
      for (const message of messages) {
        if (message.role === "assistant") {
          const { artifacts } = parseArtifacts(message.content);
          for (const artifact of artifacts) {
            addOrUpdateArtifact(artifact);
          }
        }
      }
      return;
    }

    // すべてのアシスタントメッセージからアーティファクト形式のみを抽出
    // 通常のコードブロックはアーティファクトとして扱わない
    let hasArtifacts = false;
    let lastAssistantContent = "";

    for (const message of messages) {
      if (message.role === "assistant") {
        lastAssistantContent = message.content;
        const { artifacts } = parseArtifacts(message.content);
        if (artifacts.length > 0) {
          hasArtifacts = true;
          for (const artifact of artifacts) {
            addOrUpdateArtifact(artifact);
          }
        }
      }
    }

    // アーティファクトがあればcodingフェーズに移行（ただしunlockedでない場合のみ）
    if (hasArtifacts && state.phase !== "unlocked") {
      // localStorageから復元された状態を尊重
      if (state.phase === "initial" || state.phase === "planning") {
        setPhase("coding");
      }
      // クイズは完全アンロック前のみ抽出
      if (state.unlockLevel < 4) {
        const quiz = extractQuizFromResponse(lastAssistantContent, state.unlockLevel);
        if (quiz) {
          setCurrentQuiz(quiz);
        }
      }
    }
  }, [messages, addOrUpdateArtifact, setPhase, setCurrentQuiz, state.unlockLevel, state.phase]);

  // メッセージが追加されたときの処理
  useEffect(() => {
    if (!initializedRef.current) return;
    if (messages.length <= prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    prevMessagesLengthRef.current = messages.length;

    // 最新のアシスタントメッセージを取得
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return;

    const content = lastMessage.content;

    // アーティファクト形式のコードのみを抽出（通常のコードブロックは対象外）
    const { artifacts } = parseArtifacts(content);
    if (artifacts.length > 0) {
      for (const artifact of artifacts) {
        addOrUpdateArtifact(artifact);
      }
      // アーティファクトが見つかったらcodingフェーズに移行
      if (state.phase === "initial" || state.phase === "planning") {
        setPhase("coding");
        setShowPlanningHelper(false);
      }
    }

    // フェーズに応じた処理
    if (state.phase === "initial" || state.phase === "planning") {
      // 計画を促すメッセージがあれば計画フェーズへ
      if (content.includes("手順") || content.includes("ステップ") || content.includes("計画")) {
        setPhase("planning");
        setShowPlanningHelper(true);
      }
    }

    // クイズを抽出（アーティファクトがある場合、またはcoding/unlockingフェーズの場合）
    if (artifacts.length > 0 || state.phase === "coding" || state.phase === "unlocking") {
      const quiz = extractQuizFromResponse(content, state.unlockLevel);
      if (quiz) {
        setCurrentQuiz(quiz);
      }
    }
  }, [messages, state.phase, state.unlockLevel, setPhase, setCurrentQuiz, addOrUpdateArtifact]);

  // クイズが必要な場合に自動生成（フォールバック）
  useEffect(() => {
    // unlocking フェーズで currentQuiz がなく、まだ完全アンロックではない場合
    if (
      state.phase === "unlocking" &&
      !state.currentQuiz &&
      state.unlockLevel < 4 &&
      artifactsList.length > 0
    ) {
      // フォールバッククイズを生成
      const fallbackQuiz = generateFallbackQuiz(state.unlockLevel, activeArtifact);
      setCurrentQuiz(fallbackQuiz);
    }
  }, [state.phase, state.currentQuiz, state.unlockLevel, activeArtifact, artifactsList.length, setCurrentQuiz]);

  // 簡易計画を選択して送信
  const handleQuickPlanSelect = useCallback(
    (planType: string) => {
      setShowPlanningHelper(false);
      const planMessages: Record<string, string> = {
        "basic": "基本的な実装で進めます。まずは動くものを作ってください。",
        "detailed": "詳細な設計から始めます。型定義とインターフェースを先に見せてください。",
        "step-by-step": "段階的に進めたいです。まず最小限の実装から始めてください。",
        "skip": "計画はスキップして、すぐにコードを生成してください。",
      };
      onSendMessage(planMessages[planType] || planType);
    },
    [onSendMessage]
  );

  // クイズに回答（メッセージは送信せず、ローカルで処理）
  const handleQuizAnswer = useCallback(
    (answer: string) => {
      answerQuiz(answer);
    },
    [answerQuiz]
  );

  // スキップ
  const handleSkip = useCallback(() => {
    skipToUnlock();
    onSendMessage("アンロックをスキップしました。");
  }, [skipToUnlock, onSendMessage]);

  // チャットメッセージを処理（アーティファクトのみ置換、通常コードブロックはそのまま）
  const getProcessedContent = useCallback((content: string) => {
    let processed = content;

    // Remove quiz markers from display
    processed = removeQuizMarkerFromContent(processed);

    // アーティファクト形式のコードのみをプレースホルダーに置換
    // 通常のコードブロックはそのまま表示
    const { contentWithoutArtifacts } = parseArtifacts(processed);
    processed = contentWithoutArtifacts;

    return processed;
  }, []);

  const modeConfig = MODE_CONFIG.generation;
  const iconSize = MODE_ICON_SIZES.header;

  const hasCodeToShow = artifactsList.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Header */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "rounded-lg flex items-center justify-center",
              iconSize.container,
              modeConfig.bgColor,
              modeConfig.color
            )}>
              <span className={cn("material-symbols-outlined", iconSize.icon)}>{modeConfig.icon}</span>
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-lg">{modeConfig.title}</h1>
              <p className="text-xs text-muted-foreground">
                {modeConfig.shortDescription}
              </p>
            </div>

            {/* Header Extra (Project Selector etc.) */}
            {headerExtra}

            {/* 設定ポップオーバー */}
            <GenerationOptionsPopover
              options={options}
              onOptionsChange={updateOptions}
              disabled={isLoading || state.phase !== "initial"}
              canSkip={canSkip}
            />

            {/* 進捗インジケーター（コード生成後のみ表示） */}
            {state.generatedCode && (
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  アンロック進捗
                </div>
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="text-xs font-medium text-yellow-400">
                  {Math.round(progressPercentage)}%
                </div>
              </div>
            )}

            {/* Code Panel Toggle */}
            {hasCodeToShow && (
              <button
                onClick={() => setIsCodePanelCollapsed(!isCodePanelCollapsed)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-sm",
                  isCodePanelCollapsed
                    ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                <span className="material-symbols-outlined text-base">
                  {isCodePanelCollapsed ? "dock_to_left" : "dock_to_right"}
                </span>
                <span>{isCodePanelCollapsed ? "コードを表示" : "コードを非表示"}</span>
              </button>
            )}

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

      {/* Main Content - Split View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel - Chat */}
        <div className={cn(
          "flex flex-col min-h-0 transition-all duration-300",
          hasCodeToShow && !isCodePanelCollapsed ? "w-1/2" : "w-full"
        )}>
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
                  // Find if this is the last assistant message
                  const isLastAssistantMessage =
                    message.role === "assistant" &&
                    !messages.slice(index + 1).some((m) => m.role === "assistant");

                  // Process message content (remove quiz markers and artifact placeholders)
                  const processedMessage = message.role === "assistant"
                    ? { ...message, content: getProcessedContent(message.content) }
                    : message;

                  return (
                    <div key={message.id || index}>
                      <ChatMessage
                        message={processedMessage}
                        isStreaming={isLoading && index === messages.length - 1 && message.role === "assistant"}
                        onOptionSelect={!isLoading && isLastAssistantMessage ? onSendMessage : undefined}
                        onFork={onForkFromMessage ? () => onForkFromMessage(index) : undefined}
                        showForkButton={!isLoading && index < messages.length - 1}
                        onRegenerate={onRegenerate}
                        showRegenerateButton={!isLoading && isLastAssistantMessage && canRegenerate}
                        mode="generation"
                        conversationId={conversationId}
                      />

                      {/* 簡易計画選択（AIが計画を促した後に表示） */}
                      {message.role === "assistant" &&
                        showPlanningHelper &&
                        index === messages.length - 1 &&
                        !isLoading && (
                          <div className="px-4 py-4">
                            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                              <p className="text-sm text-foreground/80 mb-3">
                                どのように進めますか？
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickPlanSelect("basic")}
                                  className="text-xs"
                                >
                                  基本実装で進める
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickPlanSelect("detailed")}
                                  className="text-xs"
                                >
                                  詳細設計から
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickPlanSelect("step-by-step")}
                                  className="text-xs"
                                >
                                  段階的に進める
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleQuickPlanSelect("skip")}
                                  className="text-xs text-muted-foreground"
                                >
                                  スキップ
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  );
                })}

                {/* クイズ（チャット内に表示） */}
                {state.currentQuiz && (
                  <div className="px-4 py-4">
                    <GenerationQuiz
                      quiz={state.currentQuiz}
                      onAnswer={handleQuizAnswer}
                      hintVisible={state.hintVisible}
                      onSkip={canSkip ? handleSkip : undefined}
                      canSkip={canSkip}
                    />
                  </div>
                )}

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

        {/* Right Panel - Code (Artifact-style) */}
        {hasCodeToShow && !isCodePanelCollapsed && (
          <div className="w-1/2 border-l border-border bg-zinc-950 flex flex-col min-h-0">
            {/* Code Panel Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-400">code</span>
                  <span className="font-medium">生成されたコード</span>
                </div>

                {/* Artifact dropdown selector */}
                {artifactsList.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm ml-4">
                        <span className="text-yellow-400 truncate max-w-[150px]">
                          {activeArtifact?.title || `${activeArtifact?.language} #${activeArtifact?.version}`}
                        </span>
                        <span className="material-symbols-outlined text-base text-zinc-400">expand_more</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 bg-zinc-900 border-zinc-700">
                      {artifactsList.map((artifact) => {
                        const isActive = state.activeArtifactId === artifact.id;
                        const progress = state.artifactProgress[artifact.id];
                        const unlockLevel = progress?.unlockLevel || 1;
                        return (
                          <DropdownMenuItem
                            key={artifact.id}
                            onClick={() => setActiveArtifact(artifact.id)}
                            className={cn(
                              "flex items-center justify-between cursor-pointer",
                              isActive && "bg-yellow-500/10"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn(
                                "material-symbols-outlined text-base",
                                isActive ? "text-yellow-400" : "text-zinc-500"
                              )}>
                                {unlockLevel >= 4 ? "lock_open" : "lock"}
                              </span>
                              <span className={cn(
                                "truncate",
                                isActive ? "text-yellow-400 font-medium" : "text-zinc-300"
                              )}>
                                {artifact.title || `${artifact.language} #${artifact.version}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {[1, 2, 3, 4].map((level) => (
                                <div
                                  key={level}
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    level <= unlockLevel ? "bg-yellow-500" : "bg-zinc-600"
                                  )}
                                />
                              ))}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Unlock progress */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">レベル {state.unlockLevel}/4</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          "size-1.5 rounded-full",
                          level <= state.unlockLevel ? "bg-yellow-500" : "bg-zinc-700"
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Collapse button */}
                <button
                  onClick={() => setIsCodePanelCollapsed(true)}
                  className="p-1 rounded hover:bg-zinc-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-zinc-400">close</span>
                </button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeArtifact && (
                <BlurredCode
                  code={activeArtifact.content}
                  language={activeArtifact.language || "text"}
                  filename={activeArtifact.title}
                  unlockLevel={state.unlockLevel}
                  progressPercentage={progressPercentage}
                  canCopy={canCopyCode}
                />
              )}
            </div>

            {/* Code Panel Footer - Quick unlock hint */}
            {!canCopyCode && (
              <div className="shrink-0 px-4 py-3 border-t border-border bg-zinc-900/50">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="material-symbols-outlined text-sm">lightbulb</span>
                  <span>クイズに答えてコードをアンロックしましょう。重要な部分から段階的に解除されます。</span>
                </div>
              </div>
            )}
          </div>
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

// ウェルカムスクリーン
function WelcomeScreen({
  welcomeMessage,
  onSuggestionClick,
}: {
  welcomeMessage?: string;
  onSuggestionClick?: (message: string) => void;
}) {
  const config = MODE_CONFIG.generation;
  const iconSize = MODE_ICON_SIZES.welcome;

  const suggestions = [
    "ログイン機能を実装したい",
    "データをソートする関数を作りたい",
    "APIからデータを取得したい",
    "フォームのバリデーションを実装したい",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className={cn(
        "rounded-2xl flex items-center justify-center mb-6",
        iconSize.container,
        config.bgColor,
        config.color
      )}>
        <span className={cn("material-symbols-outlined", iconSize.icon)}>{config.icon}</span>
      </div>

      <h2 className="text-2xl font-bold mb-2">{config.title}</h2>

      {welcomeMessage && (
        <p className="text-muted-foreground text-center max-w-md mb-4">
          {welcomeMessage}
        </p>
      )}

      {/* 学習のポイント */}
      <div className="max-w-md mb-8 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn("material-symbols-outlined", config.color)}>info</span>
          <span className={cn("font-medium", config.color)}>学習のポイント</span>
        </div>
        <ul className="text-sm text-foreground/80 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-sm mt-0.5", config.color)}>check</span>
            まず実装の計画を自分で考えます
          </li>
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-sm mt-0.5", config.color)}>check</span>
            生成されたコードは右パネルに表示されます
          </li>
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-sm mt-0.5", config.color)}>check</span>
            理解度クイズに答えてアンロックします
          </li>
        </ul>
      </div>

      <div className="w-full max-w-lg">
        <p className="text-sm text-muted-foreground mb-3">
          こんな要求から始めてみましょう:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestions.map((suggestion, index) => (
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
