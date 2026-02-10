"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatModeSelector } from "./ChatModeSelector";
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
import type { Message, ConversationBranch, Artifact, FileAttachment } from "@/types/chat";
import type { ActiveArtifactContext } from "@/hooks/useChat";
import { cn } from "@/lib/utils";
import { parseArtifacts } from "@/lib/artifacts";
import {
  parseStructuredQuiz,
  extractQuizFromText,
  generateFallbackQuiz,
  structuredQuizToUnlockQuiz,
  removeQuizMarkerFromContent,
  removeIncompleteStreamingTags,
  hasFallbackBeenUsed,
  markFallbackAsUsed,
  hasAutoQuizRequestBeenSent,
  markAutoQuizRequestSent,
} from "@/lib/quiz-generator";

interface GenerationChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string, attachments?: FileAttachment[], activeArtifact?: ActiveArtifactContext) => void;
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
  const router = useRouter();
  const { containerRef, endRef } = useAutoScroll(messages);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [isCodePanelCollapsed, setIsCodePanelCollapsed] = useState(false);
  const [isMobileCodeSheetOpen, setIsMobileCodeSheetOpen] = useState(false);
  const hasBranches = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);

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

  // Get user settings from context (may be null if not in provider)
  const userSettingsContext = useUserSettingsOptional();

  // Convert user settings to generation options
  const initialOptions = useMemo<UseGenerationModeOptions>(() => {
    const baseOptions: UseGenerationModeOptions = {
      conversationId,
      initialState: initialGenerationState,
      skipAllowed: canSkip, // canSkip が有効な場合は最初から完全アンロック
    };

    if (!userSettingsContext) return baseOptions;

    const { settings } = userSettingsContext;
    return {
      ...baseOptions,
      unlockMethod: settings.unlockMethod,
      hintSpeed: settings.hintSpeed,
    };
  }, [userSettingsContext, conversationId, initialGenerationState, canSkip]);

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

  const prevMessagesLengthRef = useRef(0);
  const initializedRef = useRef(false);

  // Artifacts list from state
  const artifactsList = useMemo(() => Object.values(state.artifacts), [state.artifacts]);

  // Per-artifact progress values (use artifact-specific progress if available)
  const activeArtifactProgress = useMemo(() => {
    const progress = state.activeArtifactId ? state.artifactProgress[state.activeArtifactId] : null;
    const total = progress?.totalQuestions ?? state.totalQuestions;
    const level = progress?.unlockLevel ?? state.unlockLevel;
    const isUnlocked = total === 0 || level >= total;
    const quizHistory = progress?.quizHistory ?? state.quizHistory ?? [];
    return {
      unlockLevel: level,
      totalQuestions: total,
      progressPercentage: total === 0 ? 100 : (level / total) * 100,
      canCopy: isUnlocked,
      isUnlocked,
      quizHistory,
    };
  }, [state.activeArtifactId, state.artifactProgress, state.totalQuestions, state.unlockLevel, state.quizHistory]);

  // Check if the last message has a truncated artifact
  const hasTruncatedArtifact = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return false;
    const { hasTruncatedArtifact } = parseArtifacts(lastMessage.content);
    return hasTruncatedArtifact;
  }, [messages]);

  // Wrapped sendMessage that includes active artifact context
  const sendMessageWithArtifact = useCallback(
    (message: string, attachments?: FileAttachment[]) => {
      const artifactContext: ActiveArtifactContext | undefined = activeArtifact
        ? {
            id: activeArtifact.id,
            title: activeArtifact.title,
            language: activeArtifact.language,
          }
        : undefined;
      onSendMessage(message, attachments, artifactContext);
    },
    [onSendMessage, activeArtifact]
  );

  // 初期読み込み時にすべてのメッセージからアーティファクトを抽出
  useEffect(() => {
    if (initializedRef.current || messages.length === 0) return;
    initializedRef.current = true;
    prevMessagesLengthRef.current = messages.length;

    // すでにunlocked状態（保存状態から復元）ならスキップ
    // totalQuestions=0 または unlockLevel >= totalQuestions の場合はアンロック済み
    const isFullyUnlocked = state.totalQuestions === 0 || state.unlockLevel >= state.totalQuestions;
    if (state.phase === "unlocked" && isFullyUnlocked) {
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
      if (!isFullyUnlocked) {
        const quiz = extractQuizFromResponse(lastAssistantContent, state.unlockLevel);
        if (quiz) {
          setCurrentQuiz(quiz);
        }
      }
    }
  }, [messages, addOrUpdateArtifact, setPhase, setCurrentQuiz, state.unlockLevel, state.totalQuestions, state.phase]);

  // ストリーミング中のアーティファクト検出（即座にパネルを開く）
  const streamingArtifactRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // ストリーミング中でない場合、または初期化前はスキップ
    if (!isLoading || !initializedRef.current || messages.length === 0) {
      // ストリーミング終了時にセットをリセット
      if (!isLoading) {
        streamingArtifactRef.current.clear();
      }
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return;

    // ストリーミング中のコンテンツからアーティファクトを抽出
    const { artifacts } = parseArtifacts(lastMessage.content);
    if (artifacts.length > 0) {
      for (const artifact of artifacts) {
        // 既に追加済みのアーティファクトはスキップ（重複防止）
        if (!streamingArtifactRef.current.has(artifact.id)) {
          streamingArtifactRef.current.add(artifact.id);
          addOrUpdateArtifact(artifact);
        }
      }
      // アーティファクトが見つかったらcodingフェーズに移行
      if (state.phase === "initial" || state.phase === "planning") {
        setPhase("coding");
      }
    }
  }, [isLoading, messages, addOrUpdateArtifact, state.phase, setPhase]);

  // メッセージが追加されたとき、またはストリーミング完了時の処理
  const lastProcessedContentRef = useRef<string>("");

  useEffect(() => {
    if (!initializedRef.current) return;
    if (messages.length === 0) return;

    // 最新のアシスタントメッセージを取得
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return;

    const content = lastMessage.content;

    // ストリーミング中は部分的な処理のみ
    // ストリーミング完了時（isLoading=false）に完全な処理を行う
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    const isStreamingComplete = !isLoading && lastProcessedContentRef.current !== content;

    if (!isNewMessage && !isStreamingComplete) {
      return;
    }

    prevMessagesLengthRef.current = messages.length;
    lastProcessedContentRef.current = content;

    // アーティファクト形式のコードのみを抽出（通常のコードブロックは対象外）
    const { artifacts } = parseArtifacts(content);
    if (artifacts.length > 0) {
      for (const artifact of artifacts) {
        addOrUpdateArtifact(artifact);
      }
      // アーティファクトが見つかったらcodingフェーズに移行
      if (state.phase === "initial" || state.phase === "planning") {
        setPhase("coding");
      }
    }

    // クイズを抽出（ストリーミング完了後のみ、部分的なタグを避けるため）
    // ただし、totalQuestions=0 (制限解除モード) の場合はスキップ
    if (!isLoading) {
      const isFullyUnlocked = state.totalQuestions === 0 || state.unlockLevel >= state.totalQuestions;
      if (!isFullyUnlocked && (artifacts.length > 0 || state.phase === "coding" || state.phase === "unlocking")) {
        const quiz = extractQuizFromResponse(content, state.unlockLevel);
        if (quiz) {
          setCurrentQuiz(quiz);
        }
      }
    }
  }, [messages, isLoading, state.phase, state.unlockLevel, state.totalQuestions, setPhase, setCurrentQuiz, addOrUpdateArtifact]);

  // クイズが必要な場合に自動生成（フォールバック）
  // 注意: フォールバックは1アーティファクトにつき1回のみ自動実行
  useEffect(() => {
    // unlocking フェーズで currentQuiz がなく、まだ完全アンロックではない場合
    const needsQuiz = state.totalQuestions > 0 && state.unlockLevel < state.totalQuestions;
    const artifactId = state.activeArtifactId;

    if (
      state.phase === "unlocking" &&
      !state.currentQuiz &&
      needsQuiz &&
      artifactsList.length > 0 &&
      artifactId &&
      !hasFallbackBeenUsed(artifactId)
    ) {
      // フォールバック使用をマークしてからクイズを生成
      markFallbackAsUsed(artifactId);
      const fallbackQuiz = generateFallbackQuiz(state.unlockLevel, activeArtifact);
      setCurrentQuiz(fallbackQuiz);
    }
  }, [state.phase, state.currentQuiz, state.unlockLevel, state.activeArtifactId, activeArtifact, artifactsList.length, setCurrentQuiz, state.totalQuestions]);

  // クイズが抽出できなかった場合にAIに自動リクエスト
  // 注意: フォールバック使用後、AIレスポンスにクイズがなかった場合のみ1回だけ自動実行
  useEffect(() => {
    // ストリーミング中は処理しない（完了を待つ）
    if (isLoading) return;

    // 初期化前はスキップ
    if (!initializedRef.current) return;

    // クイズがある場合はスキップ
    if (state.currentQuiz) return;

    // アクティブなアーティファクトがない場合はスキップ
    const artifactId = state.activeArtifactId;
    if (!artifactId || !activeArtifact) return;

    // 完全アンロック済みの場合はスキップ
    const needsQuiz = state.totalQuestions > 0 && state.unlockLevel < state.totalQuestions;
    if (!needsQuiz) return;

    // unlocking/coding フェーズでない場合はスキップ
    if (state.phase !== "unlocking" && state.phase !== "coding") return;

    // フォールバックがまだ使用されていない場合はスキップ（まずフォールバックを試す）
    if (!hasFallbackBeenUsed(artifactId)) return;

    // 自動リクエスト済みの場合はスキップ
    if (hasAutoQuizRequestBeenSent(artifactId)) return;

    // 自動リクエスト送信済みをマーク
    markAutoQuizRequestSent(artifactId);

    // AIにクイズ生成をリクエスト
    sendMessageWithArtifact(
      "生成されたコードについて、理解度確認のクイズを出題してください。「なぜ〜していますか？」形式の質問でお願いします。"
    );
  }, [isLoading, state.currentQuiz, state.activeArtifactId, activeArtifact, state.totalQuestions, state.unlockLevel, state.phase, sendMessageWithArtifact]);

  // クイズに回答（メッセージは送信せず、ローカルで処理）
  // メッセージ数を渡してインライン表示位置を記録
  const handleQuizAnswer = useCallback(
    (answer: string) => {
      answerQuiz(answer, messages.length);
    },
    [answerQuiz, messages.length]
  );

  // スキップ
  const handleSkip = useCallback(() => {
    skipToUnlock();
    sendMessageWithArtifact("アンロックをスキップしました。");
  }, [skipToUnlock, sendMessageWithArtifact]);

  // 解説モードでコードを解説
  const handleExplainCode = useCallback(() => {
    if (!activeArtifact) return;

    // セッションストレージに解説リクエストを保存
    const explainRequest = {
      code: activeArtifact.content,
      language: activeArtifact.language || "text",
      title: activeArtifact.title,
    };
    sessionStorage.setItem("explain-code-request", JSON.stringify(explainRequest));

    // 解説モードに遷移
    router.push("/chat/explanation");
  }, [activeArtifact, router]);

  // チャットメッセージを処理（アーティファクトのみ置換、通常コードブロックはそのまま）
  // ストリーミング中は不完全なタグを隠す
  const getProcessedContent = useCallback((content: string, isStreaming: boolean = false) => {
    let processed = content;

    // ストリーミング中: 不完全なタグ（<!--QUIZ:... や <!--ARTIFACT:...）を隠す
    // これにより、タグが閉じるまでJSON等が表示されない
    if (isStreaming) {
      processed = removeIncompleteStreamingTags(processed);
    }

    // Remove completed quiz markers from display
    processed = removeQuizMarkerFromContent(processed);

    // アーティファクト形式のコードのみをプレースホルダーに置換
    // 通常のコードブロックはそのまま表示
    const { contentWithoutArtifacts } = parseArtifacts(processed);
    processed = contentWithoutArtifacts;

    return processed;
  }, []);

  const hasCodeToShow = artifactsList.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Header - z-30 to ensure dropdowns appear above main content */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80 relative z-30">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 py-2 sm:py-3">
          {/* Single row layout */}
          <div className="flex items-center justify-between gap-2">
            {/* Mode Selector (dropdown with new chat option) */}
            <ChatModeSelector currentMode="generation" conversationId={conversationId} />

            {/* Right: Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Header Extra (Project Selector etc.) - Hidden on mobile */}
              <div className="hidden sm:flex items-center gap-2">
                {headerExtra}
              </div>

              {/* 設定ポップオーバー */}
              <GenerationOptionsPopover
                options={options}
                onOptionsChange={updateOptions}
                disabled={isLoading || state.phase !== "initial"}
                canSkip={canSkip}
              />

              {/* 進捗インジケーター（コード生成後のみ表示）*/}
              {state.generatedCode && (
                <div className="flex items-center gap-1.5">
                  <div className="w-12 sm:w-20 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="text-[10px] sm:text-xs font-medium text-yellow-400">
                    {Math.round(progressPercentage)}%
                  </div>
                </div>
              )}

              {/* Code Panel Toggle - Desktop only */}
              {hasCodeToShow && (
                <button
                  onClick={() => setIsCodePanelCollapsed(!isCodePanelCollapsed)}
                  className={cn(
                    "hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-sm",
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
        <div className={cn(
          "flex flex-col min-h-0 transition-all duration-300 w-full",
          hasCodeToShow && !isCodePanelCollapsed && "md:w-1/2"
        )}>
          {/* Messages */}
          <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0">
            {messages.length === 0 ? (
              <WelcomeScreen
                welcomeMessage={welcomeMessage}
                onSuggestionClick={sendMessageWithArtifact}
              />
            ) : (
              <div className="mx-auto max-w-3xl pb-4">
                {messages.map((message, index) => {
                  // Find if this is the last assistant message
                  const isLastAssistantMessage =
                    message.role === "assistant" &&
                    !messages.slice(index + 1).some((m) => m.role === "assistant");

                  // Determine if this message is currently streaming
                  const isMessageStreaming = isLoading && index === messages.length - 1 && message.role === "assistant";

                  // Process message content (remove quiz markers and artifact placeholders)
                  // Pass streaming state to hide incomplete tags during streaming
                  const processedMessage = message.role === "assistant"
                    ? { ...message, content: getProcessedContent(message.content, isMessageStreaming) }
                    : message;

                  // このメッセージの後に回答された完了済みクイズを検索
                  // answeredAtMessageCount は回答時点でのメッセージ数なので、index + 1 と比較
                  const completedQuizzesAfterThis = activeArtifactProgress.quizHistory.filter(
                    (item) => item.answeredAtMessageCount === index + 1 && item.isCorrect && item.completedQuiz
                  );

                  return (
                    <div key={message.id || index} id={`msg-${index}`}>
                      <ChatMessage
                        message={processedMessage}
                        isStreaming={isLoading && index === messages.length - 1 && message.role === "assistant"}
                        onOptionSelect={!isLoading && isLastAssistantMessage ? sendMessageWithArtifact : undefined}
                        onFork={onForkFromMessage ? () => onForkFromMessage(index) : undefined}
                        showForkButton={!isLoading && index < messages.length - 1}
                        onRegenerate={onRegenerate}
                        showRegenerateButton={!isLoading && isLastAssistantMessage && canRegenerate}
                        mode="generation"
                        conversationId={conversationId}
                      />

                      {/* 完了済みクイズをインライン表示（このメッセージの後に回答されたもの） */}
                      {/* 正解時は展開表示でフルビュー（問題、選択肢、解説）を表示 */}
                      {completedQuizzesAfterThis.map((quizItem, quizIndex) => (
                        <div key={`completed-quiz-${index}-${quizIndex}`} className="px-4 py-4">
                          <GenerationQuiz
                            quiz={quizItem.completedQuiz!}
                            onAnswer={() => {}}
                            hintVisible={false}
                            completedAnswer={quizItem.userAnswer}
                            defaultCollapsed={false}
                            isCollapsible={true}
                          />
                        </div>
                      ))}

                    </div>
                  );
                })}

                {/* 続きを生成ボタン（truncatedアーティファクト検出時） */}
                {hasTruncatedArtifact && !isLoading && (
                  <div className="px-4 py-4">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-amber-400">warning</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground/90">
                            コードが途中で切れています
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            トークン上限に達したため、生成が中断されました
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendMessageWithArtifact("続きを生成してください。前回の途中から続けてください。")}
                          className="shrink-0 gap-1.5"
                        >
                          <span className="material-symbols-outlined text-base">play_arrow</span>
                          続きを生成
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* クイズ（チャット内に表示、折りたたみ可能） */}
                {state.currentQuiz ? (
                  <div className="px-4 py-4">
                    <GenerationQuiz
                      quiz={state.currentQuiz}
                      onAnswer={handleQuizAnswer}
                      hintVisible={state.hintVisible}
                      onSkip={canSkip ? handleSkip : undefined}
                      canSkip={canSkip}
                      isCollapsible={true}
                      onAskAboutQuestion={(question, options) => {
                        const optionsList = options.join("\n");
                        sendMessageWithArtifact(
                          `このクイズについて教えてください：\n\n質問: ${question}\n\n選択肢:\n${optionsList}\n\n正解を教えずに、この問題を解くためのヒントや考え方を教えてください。`
                        );
                      }}
                    />
                  </div>
                ) : (
                  /* クイズが表示されない場合の再生成ボタン */
                  activeArtifact && !activeArtifactProgress.isUnlocked && !isLoading && (
                    <div className="px-4 py-4">
                      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-yellow-400">quiz</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground/90">
                              {hasAutoQuizRequestBeenSent(activeArtifact.id)
                                ? "クイズが生成されませんでした"
                                : "クイズが表示されていません"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {hasAutoQuizRequestBeenSent(activeArtifact.id)
                                ? "もう一度リクエストするか、コードを確認してください"
                                : hasFallbackBeenUsed(activeArtifact.id)
                                  ? "AIにクイズを自動リクエスト中..."
                                  : "クイズに回答してコードをアンロックしましょう"}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (hasFallbackBeenUsed(activeArtifact.id)) {
                                // フォールバック使用済み: AIにクイズ再生成をリクエスト
                                sendMessageWithArtifact(
                                  "生成されたコードについて、理解度確認のクイズを出題してください。「なぜ〜していますか？」形式の質問でお願いします。"
                                );
                              } else {
                                // フォールバック未使用: 自己評価型クイズを表示
                                markFallbackAsUsed(activeArtifact.id);
                                const fallbackQuiz = generateFallbackQuiz(
                                  activeArtifactProgress.unlockLevel as UnlockLevel,
                                  activeArtifact
                                );
                                setCurrentQuiz(fallbackQuiz);
                              }
                            }}
                            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                          >
                            <span className="material-symbols-outlined text-base mr-1.5">
                              {hasFallbackBeenUsed(activeArtifact.id) ? "refresh" : "quiz"}
                            </span>
                            {hasAutoQuizRequestBeenSent(activeArtifact.id)
                              ? "再リクエスト"
                              : hasFallbackBeenUsed(activeArtifact.id)
                                ? "AIに質問を依頼"
                                : "クイズを表示"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* クイズ完了通知と振り返り（全問正解後に表示） */}
                {state.phase === "unlocked" && activeArtifactProgress.quizHistory.length > 0 && (
                  <div className="px-4 py-4 space-y-4">
                    {/* 完了通知ヘッダー */}
                    <div className="rounded-lg border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4">
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-green-400 text-2xl">emoji_events</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-lg text-green-400">
                            クイズ完了！
                          </p>
                          <p className="text-sm text-foreground/80">
                            {activeArtifactProgress.quizHistory.length}問全て正解しました。コードをコピーできます。
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-green-400 bg-green-500/20 px-3 py-1.5 rounded-full">
                          <span className="material-symbols-outlined text-lg">lock_open</span>
                          <span className="text-sm font-medium">アンロック</span>
                        </div>
                      </div>
                    </div>

                    {/* 全問題の振り返り（フルビュー） */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground/70">
                        <span className="material-symbols-outlined text-base">school</span>
                        <span>クイズ振り返り</span>
                      </div>
                      {activeArtifactProgress.quizHistory.map((quizItem, quizIndex) => (
                        quizItem.completedQuiz && (
                          <GenerationQuiz
                            key={`summary-quiz-${quizIndex}`}
                            quiz={quizItem.completedQuiz}
                            onAnswer={() => {}}
                            hintVisible={false}
                            completedAnswer={quizItem.userAnswer}
                            defaultCollapsed={false}
                          />
                        )
                      ))}
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0">
            <ChatInput
              onSend={sendMessageWithArtifact}
              onStop={onStopGeneration}
              isLoading={isLoading}
              placeholder={inputPlaceholder}
            />
          </div>
        </div>

        {/* Mobile FAB - Show Code Sheet */}
        {hasCodeToShow && (
          <button
            onClick={() => setIsMobileCodeSheetOpen(true)}
            className={cn(
              "md:hidden fixed bottom-24 right-4 z-30",
              "flex items-center justify-center",
              "size-14 rounded-full shadow-lg",
              "bg-yellow-500 text-zinc-900",
              "hover:bg-yellow-400 active:scale-95",
              "transition-all duration-200"
            )}
          >
            <span className="material-symbols-outlined text-2xl">code</span>
            {/* Progress indicator badge */}
            <div className="absolute -top-1 -right-1 size-6 rounded-full bg-zinc-900 border-2 border-yellow-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-yellow-400">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </button>
        )}

        {/* Mobile Code Bottom Sheet */}
        {hasCodeToShow && (
          <MobileCodeSheet
            isOpen={isMobileCodeSheetOpen}
            onClose={() => setIsMobileCodeSheetOpen(false)}
            activeArtifact={activeArtifact}
            artifactsList={artifactsList}
            state={state}
            activeArtifactProgress={activeArtifactProgress}
            setActiveArtifact={setActiveArtifact}
            onExplainCode={handleExplainCode}
          />
        )}

        {/* Right Panel - Code (Artifact-style) - Desktop Only */}
        {hasCodeToShow && !isCodePanelCollapsed && (
          <div className="hidden md:flex w-1/2 border-l border-border bg-zinc-950 flex-col min-h-0">
            {/* Code Panel Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-400">code</span>
                  <span className="font-medium">生成されたコード</span>
                </div>

                {/* Artifact dropdown selector */}
                {artifactsList.length > 0 && (
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
                        const unlockLevel = progress?.unlockLevel ?? 0;
                        const totalQ = progress?.totalQuestions ?? state.totalQuestions;
                        const isArtifactUnlocked = totalQ === 0 || unlockLevel >= totalQ;
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
                                {isArtifactUnlocked ? "lock_open" : "lock"}
                              </span>
                              <span className={cn(
                                "truncate",
                                isActive ? "text-yellow-400 font-medium" : "text-zinc-300"
                              )}>
                                {artifact.title || `${artifact.language} #${artifact.version}`}
                              </span>
                            </div>
                            {totalQ > 0 && (
                              <div className="flex items-center gap-1 ml-2">
                                {Array.from({ length: totalQ }, (_, i) => i + 1).map((level) => (
                                  <div
                                    key={level}
                                    className={cn(
                                      "size-1.5 rounded-full",
                                      level <= unlockLevel ? "bg-yellow-500" : "bg-zinc-600"
                                    )}
                                  />
                                ))}
                              </div>
                            )}
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
                  {state.totalQuestions > 0 ? (
                    <>
                      <span className="text-zinc-500">{state.unlockLevel}/{state.totalQuestions} 完了</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: state.totalQuestions }, (_, i) => i + 1).map((level) => (
                          <div
                            key={level}
                            className={cn(
                              "size-1.5 rounded-full",
                              level <= state.unlockLevel ? "bg-yellow-500" : "bg-zinc-700"
                            )}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <span className="text-zinc-500">アンロック済み</span>
                  )}
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
                  unlockLevel={activeArtifactProgress.unlockLevel}
                  totalQuestions={activeArtifactProgress.totalQuestions}
                  progressPercentage={activeArtifactProgress.progressPercentage}
                  canCopy={activeArtifactProgress.canCopy}
                  showExplainButton={true}
                  onExplainCode={handleExplainCode}
                />
              )}
            </div>

            {/* Code Panel Footer - Quick unlock hint */}
            {!activeArtifactProgress.canCopy && (
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

  const suggestions = [
    "ログイン機能を実装したい",
    "データをソートする関数を作りたい",
    "APIからデータを取得したい",
    "フォームのバリデーションを実装したい",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8">
      <div className={cn(
        "rounded-2xl flex items-center justify-center mb-4 sm:mb-6",
        "size-16 sm:size-20",
        config.bgColor,
        config.color
      )}>
        <span className="material-symbols-outlined text-3xl sm:text-4xl">{config.icon}</span>
      </div>

      <h2 className="text-xl sm:text-2xl font-bold mb-2">{config.title}</h2>

      {welcomeMessage && (
        <p className="text-muted-foreground text-center max-w-md mb-4 text-sm sm:text-base">
          {welcomeMessage}
        </p>
      )}

      {/* 学習のポイント */}
      <div className="w-full max-w-md mb-6 sm:mb-8 p-3 sm:p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn("material-symbols-outlined text-lg sm:text-xl", config.color)}>info</span>
          <span className={cn("font-medium text-sm sm:text-base", config.color)}>学習のポイント</span>
        </div>
        <ul className="text-xs sm:text-sm text-foreground/80 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-xs sm:text-sm mt-0.5", config.color)}>check</span>
            <span>まず実装の計画を自分で考えます</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-xs sm:text-sm mt-0.5", config.color)}>check</span>
            <span className="hidden sm:inline">生成されたコードは右パネルに表示されます</span>
            <span className="sm:hidden">コードは下のボタンで確認</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={cn("material-symbols-outlined text-xs sm:text-sm mt-0.5", config.color)}>check</span>
            <span>理解度クイズに答えてアンロック</span>
          </li>
        </ul>
      </div>

      <div className="w-full max-w-lg px-2">
        <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
          こんな要求から始めてみましょう:
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

// Mobile Code Bottom Sheet
function MobileCodeSheet({
  isOpen,
  onClose,
  activeArtifact,
  artifactsList,
  state,
  activeArtifactProgress,
  setActiveArtifact,
  onExplainCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeArtifact: Artifact | null | undefined;
  artifactsList: Artifact[];
  state: {
    activeArtifactId: string | null;
    artifactProgress: Record<string, { unlockLevel: number; totalQuestions: number }>;
    totalQuestions: number;
    unlockLevel: number;
  };
  activeArtifactProgress: {
    unlockLevel: number;
    totalQuestions: number;
    progressPercentage: number;
    canCopy: boolean;
    isUnlocked: boolean;
  };
  setActiveArtifact: (id: string) => void;
  onExplainCode: () => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "md:hidden fixed inset-x-0 bottom-0 z-50",
          "bg-zinc-950 rounded-t-2xl border-t border-zinc-800",
          "max-h-[85vh] flex flex-col",
          "animate-in slide-in-from-bottom duration-300"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-yellow-400">code</span>
            <span className="font-medium">生成されたコード</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress */}
            <div className="flex items-center gap-2 text-xs">
              {state.totalQuestions > 0 ? (
                <>
                  <span className="text-zinc-500">{state.unlockLevel}/{state.totalQuestions}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: state.totalQuestions }, (_, i) => i + 1).map((level) => (
                      <div
                        key={level}
                        className={cn(
                          "size-1.5 rounded-full",
                          level <= state.unlockLevel ? "bg-yellow-500" : "bg-zinc-700"
                        )}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <span className="text-zinc-500">アンロック済み</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <span className="material-symbols-outlined text-zinc-400">close</span>
            </button>
          </div>
        </div>

        {/* Artifact Tabs */}
        {artifactsList.length > 1 && (
          <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-zinc-800 scrollbar-hide">
            {artifactsList.map((artifact) => {
              const isActive = state.activeArtifactId === artifact.id;
              const progress = state.artifactProgress[artifact.id];
              const unlockLevel = progress?.unlockLevel ?? 0;
              const totalQ = progress?.totalQuestions ?? state.totalQuestions;
              const isArtifactUnlocked = totalQ === 0 || unlockLevel >= totalQ;

              return (
                <button
                  key={artifact.id}
                  onClick={() => setActiveArtifact(artifact.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0",
                    isActive
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isArtifactUnlocked ? "lock_open" : "lock"}
                  </span>
                  <span className="truncate max-w-[120px]">
                    {artifact.title || `${artifact.language} #${artifact.version}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Code Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeArtifact && (
            <BlurredCode
              code={activeArtifact.content}
              language={activeArtifact.language || "text"}
              filename={activeArtifact.title}
              unlockLevel={activeArtifactProgress.unlockLevel}
              totalQuestions={activeArtifactProgress.totalQuestions}
              progressPercentage={activeArtifactProgress.progressPercentage}
              canCopy={activeArtifactProgress.canCopy}
              showExplainButton={true}
              onExplainCode={onExplainCode}
            />
          )}
        </div>

        {/* Footer hint */}
        {!activeArtifactProgress.canCopy && (
          <div className="shrink-0 px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="material-symbols-outlined text-sm">lightbulb</span>
              <span>クイズに答えてコードをアンロック</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
