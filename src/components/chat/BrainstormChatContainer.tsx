"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatModeSelector } from "./ChatModeSelector";
import { BrainstormPhaseIndicator } from "./BrainstormPhaseIndicator";
import { PlanStepList, SuggestedPlan } from "./PlanStepList";
import { ArtifactCodePanel, MobileArtifactSheet, MobileCodeFAB } from "./ArtifactCodePanel";
import { InlineQuizSection } from "./InlineQuizSection";
import { SharedBranchSelector } from "./SharedBranchSelector";
import {
  MobilePhaseMenu,
  SubModeToggle,
  TransitionSuggestionUI,
  BrainstormCompletionUI,
  BrainstormWelcomeScreen,
} from "./BrainstormSubComponents";
import { ProjectSaveModal } from "@/components/projects/ProjectSaveModal";
import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { BrainstormSummaryModal } from "./BrainstormSummaryModal";
import {
  useBrainstormMode,
  BRAINSTORM_PHASES,
  PHASE_INFO,
} from "@/hooks/useBrainstormMode";
import { useArtifactDetection } from "@/hooks/useArtifactDetection";
import type { PersistedArtifactQuizState } from "@/hooks/useArtifactQuiz";
import {
  extractPhaseInfoFromResponse,
  detectCompletionIntent,
  extractPlanSteps,
} from "@/lib/brainstormUtils";
import type { Message, ConversationBranch, PlanStep, BrainstormPhase, BrainstormSubMode, BrainstormModeState, ConversationMetadata, FileAttachment } from "@/types/chat";
import { BRAINSTORM_INITIAL_MESSAGES } from "@/lib/prompts";
import { cn } from "@/lib/utils";

interface BrainstormChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string, attachments?: FileAttachment[]) => void;
  welcomeMessage?: string;
  inputPlaceholder?: string;
  onStopGeneration?: () => void;
  onForkFromMessage?: (messageIndex: number) => void;
  branches?: ConversationBranch[];
  currentBranchId?: string;
  onSwitchBranch?: (branchId: string) => void;
  // Regenerate functionality
  onRegenerate?: () => void;
  canRegenerate?: boolean;
  // Project save
  conversationId?: string;
  // State restoration
  restoredMetadata?: ConversationMetadata | null;
  onMetadataChange?: (metadata: Partial<ConversationMetadata>) => void;
  // SubMode control (for API calls)
  subMode?: BrainstormSubMode;
  onSubModeChange?: (subMode: BrainstormSubMode) => void;
  // Project selector
  headerExtra?: React.ReactNode;
  // Artifact quiz initial state (from conversation metadata)
  initialArtifactQuizState?: PersistedArtifactQuizState;
}

export function BrainstormChatContainer({
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
  conversationId,
  restoredMetadata,
  onMetadataChange,
  subMode: externalSubMode,
  onSubModeChange,
  headerExtra,
  initialArtifactQuizState,
}: BrainstormChatContainerProps) {
  const { containerRef, endRef } = useAutoScroll(messages);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isCodePanelCollapsed, setIsCodePanelCollapsed] = useState(false);
  const [isMobileArtifactSheetOpen, setIsMobileArtifactSheetOpen] = useState(false);
  const hasBranches = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  // --- Artifact/Quiz system (shared hook) ---
  const {
    artQuiz,
    artifactsList,
    hasArtifacts,
    activeArtifactProgress,
    unlockedAtMessageIndex,
    isActiveArtifactStreaming,
    handleQuizAnswer,
    getProcessedContent,
  } = useArtifactDetection({
    conversationId,
    messages,
    isLoading,
    initialArtifactQuizState,
    logPrefix: "BrainstormChatContainer",
  });

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

  const router = useRouter();

  const {
    state,
    currentPhaseInfo,
    progressPercentage,
    goToPhase,
    skipToPhase,
    setPlanSteps,
    setSubMode: setInternalSubMode,
    restoreState,
    markAsCompleted,
    // 新しいフェーズ進行度管理
    updatePhaseInfoBatch,
    showTransitionSuggestion,
    dismissTransitionSuggestion,
    acceptTransitionSuggestion,
    canTransitionToNext,
  } = useBrainstormMode();

  // Handle subMode change - update both internal state and notify parent
  const subModeChangedByUserRef = useRef(false);
  const handleSubModeChange = useCallback((newSubMode: BrainstormSubMode) => {
    subModeChangedByUserRef.current = true;
    setInternalSubMode(newSubMode);
    onSubModeChange?.(newSubMode);
  }, [setInternalSubMode, onSubModeChange]);

  // Notify parent when subMode changes from state restoration (not user action)
  const prevSubModeRef = useRef(state.subMode);
  useEffect(() => {
    if (prevSubModeRef.current !== state.subMode) {
      prevSubModeRef.current = state.subMode;
      // Skip if change was from user action (already notified in handleSubModeChange)
      if (subModeChangedByUserRef.current) {
        subModeChangedByUserRef.current = false;
        return;
      }
      onSubModeChange?.(state.subMode);
    }
  }, [state.subMode, onSubModeChange]);

  // Restore brainstorm state from loaded conversation metadata
  useEffect(() => {
    if (restoredMetadata?.brainstormState && !hasRestoredState) {
      restoreState(restoredMetadata.brainstormState as BrainstormModeState);
      setHasRestoredState(true);
    }
  }, [restoredMetadata, hasRestoredState, restoreState]);

  // Notify parent when brainstorm state changes (for saving) - debounced to prevent excessive updates
  const metadataTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (onMetadataChange && hasRestoredState) {
      // Clear existing timeout
      if (metadataTimeoutRef.current) {
        clearTimeout(metadataTimeoutRef.current);
      }
      // Debounce metadata updates
      metadataTimeoutRef.current = setTimeout(() => {
        onMetadataChange({ brainstormState: state });
      }, 500);
    }
    return () => {
      if (metadataTimeoutRef.current) {
        clearTimeout(metadataTimeoutRef.current);
      }
    };
  }, [state, onMetadataChange, hasRestoredState]);

  const [suggestedSteps, setSuggestedSteps] = useState<PlanStep[]>([]);

  // Show save button when we have plan steps or are in task-breakdown phase
  const canSaveProject = state.planSteps.length > 0 || state.currentPhase === "task-breakdown";
  const prevIsLoadingRef = useRef(isLoading);

  // AIレスポンスから情報を抽出し、遷移提案を表示（自動遷移はしない）
  const checkPhaseTransitionAndSteps = useCallback((content: string) => {
    // カジュアルモードでは処理しない
    if (state.subMode === "casual") return;

    // 現在のフェーズから情報を抽出
    const extractedInfo = extractPhaseInfoFromResponse(content, state.currentPhase);

    // 抽出した情報があれば、フェーズの進行度を更新
    const nonNullInfo = Object.fromEntries(
      Object.entries(extractedInfo).filter(([, v]) => v !== null)
    );
    if (Object.keys(nonNullInfo).length > 0) {
      updatePhaseInfoBatch(state.currentPhase, extractedInfo);
    }

    // 完了意図を検出した場合、遷移提案を表示
    const hasCompletionIntent = detectCompletionIntent(content);
    const currentIndex = BRAINSTORM_PHASES.indexOf(state.currentPhase);
    const nextPhase = BRAINSTORM_PHASES[currentIndex + 1];

    // 最終フェーズ（task-breakdown）の完了判定
    if (!nextPhase && (hasCompletionIntent || canTransitionToNext())) {
      if (!state.isCompleted) {
        markAsCompleted();
      }
    }

    // 遷移提案の表示条件:
    // 1. 完了意図があり、次のフェーズが存在する場合
    // 2. または、充足度が閾値を超えている場合
    if (nextPhase && (hasCompletionIntent || canTransitionToNext())) {
      const progress = state.phaseProgress[state.currentPhase];

      // すでに遷移提案が表示されていない場合のみ表示
      if (!state.transitionSuggestion.isVisible) {
        const reason = hasCompletionIntent
          ? `${PHASE_INFO[state.currentPhase].title}の内容が整理されました`
          : `${PHASE_INFO[state.currentPhase].title}の充足度が${progress.completionScore}%に達しました`;

        showTransitionSuggestion(nextPhase, reason);
      }
    }

    // タスク分解フェーズで計画ステップを抽出
    if (state.currentPhase === "task-breakdown") {
      const steps = extractPlanSteps(content);
      if (steps.length > 0) {
        setSuggestedSteps(steps);
      }
    }
  }, [
    state.subMode,
    state.currentPhase,
    state.phaseProgress,
    state.transitionSuggestion.isVisible,
    state.isCompleted,
    updatePhaseInfoBatch,
    showTransitionSuggestion,
    markAsCompleted,
    canTransitionToNext,
  ]);

  // ストリーミング終了時にフェーズ移行を検出（メイン検出ロジック）
  useEffect(() => {
    // isLoading が true → false に変わったとき（ストリーミング終了）
    if (prevIsLoadingRef.current && !isLoading) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") {
        checkPhaseTransitionAndSteps(lastMessage.content);
      }
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, messages, checkPhaseTransitionAndSteps]);

  // フェーズ変更時にAI質問を送信
  const sendPhaseGuidanceMessage = useCallback((phase: BrainstormPhase) => {
    const phaseInfo = PHASE_INFO[phase];
    const guidanceMessage = `${phaseInfo.title}フェーズに進みました。${phaseInfo.questions[0]}`;
    onSendMessage(guidanceMessage);
  }, [onSendMessage]);

  // フェーズを直接スキップして移動
  const handlePhaseSkip = useCallback((targetPhase: BrainstormPhase) => {
    skipToPhase(targetPhase);
    sendPhaseGuidanceMessage(targetPhase);
  }, [skipToPhase, sendPhaseGuidanceMessage]);

  // 遷移提案を承認して次のフェーズへ進む
  const handleAcceptTransition = useCallback(() => {
    if (state.transitionSuggestion.targetPhase) {
      const targetPhase = state.transitionSuggestion.targetPhase;
      acceptTransitionSuggestion();
      sendPhaseGuidanceMessage(targetPhase);
    }
  }, [state.transitionSuggestion.targetPhase, acceptTransitionSuggestion, sendPhaseGuidanceMessage]);

  // 遷移提案を閉じる
  const handleDismissTransition = useCallback(() => {
    dismissTransitionSuggestion();
  }, [dismissTransitionSuggestion]);

  // クイズ再生成
  const handleRegenerateQuiz = useCallback(() => {
    if (artQuiz.activeArtifact?.id) {
      artQuiz.generateQuizzesForArtifact(artQuiz.activeArtifact.id).catch(() => {});
    }
  }, [artQuiz]);

  // クイックリプライを選択
  const handleQuickReply = useCallback(
    (value: string) => {
      onSendMessage(value);
    },
    [onSendMessage]
  );

  // 提案された計画を承認
  const handleAcceptPlan = useCallback(() => {
    setPlanSteps(suggestedSteps);
    setSuggestedSteps([]);
    onSendMessage("この計画で進めます。");
  }, [setPlanSteps, suggestedSteps, onSendMessage]);

  // 提案された計画を修正
  const handleModifyPlan = useCallback(() => {
    onSendMessage("計画を修正したいです。");
    setSuggestedSteps([]);
  }, [onSendMessage]);

  // 提案された計画を簡略化
  const handleSimplifyPlan = useCallback(() => {
    onSendMessage("計画をもっとシンプルにしてください。");
    setSuggestedSteps([]);
  }, [onSendMessage]);

  // まとめモーダル表示
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const handleShowSummary = useCallback(() => {
    setShowSummaryModal(true);
  }, []);

  // 新しいブレインストーミングを開始
  const handleStartNewBrainstorm = useCallback(() => {
    router.push("/chat/brainstorm");
  }, [router]);

  const [showPhaseMenu, setShowPhaseMenu] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Header - Mobile Optimized */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80 relative z-20">
        <div className="mx-auto max-w-4xl px-2 sm:px-4 py-2 sm:py-3 space-y-1.5">
          {/* Row 1: Mode selector + header extra controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Mode Selector */}
            <div className="min-w-0">
              <ChatModeSelector currentMode="brainstorm" conversationId={conversationId} />
            </div>

            {/* Right: Header Extra + Save + Branch */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Header Extra (Model & Project Selector) - Hidden on mobile */}
              <div className="hidden sm:flex items-center gap-2">
                {headerExtra}
              </div>

              {/* Artifact progress indicator */}
              {hasArtifacts && (
                <div className="flex items-center gap-1.5">
                  <div className="w-12 sm:w-20 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                      style={{ width: `${artQuiz.progressPercentage}%` }}
                    />
                  </div>
                  <div className="text-[10px] sm:text-xs font-medium text-purple-400">
                    {Math.round(artQuiz.progressPercentage)}%
                  </div>
                </div>
              )}

              {/* Code Panel Toggle - Desktop only */}
              {hasArtifacts && (
                <button
                  onClick={() => setIsCodePanelCollapsed(!isCodePanelCollapsed)}
                  className={cn(
                    "hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-sm",
                    isCodePanelCollapsed
                      ? "border-purple-500/50 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <span className="material-symbols-outlined text-base">
                    {isCodePanelCollapsed ? "dock_to_left" : "dock_to_right"}
                  </span>
                  <span>{isCodePanelCollapsed ? "コードを表示" : "コードを非表示"}</span>
                </button>
              )}

              {/* Summary Button */}
              {messages.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShowSummary}
                  className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0"
                  title="会話をまとめる"
                >
                  <span className="material-symbols-outlined text-base">summarize</span>
                  <span className="hidden sm:inline ml-1">まとめ</span>
                </Button>
              )}

              {/* Save Project Button - Icon only */}
              {canSaveProject && (
                <Button
                  size="sm"
                  onClick={() => setShowSaveModal(true)}
                  className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span className="hidden sm:inline ml-1">保存</span>
                </Button>
              )}

              {/* Branch Selector - Hidden on mobile */}
              {hasBranches && (
                <div className="relative hidden md:block shrink-0">
                  <button
                    onClick={() => setShowBranchSelector(!showBranchSelector)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-base text-orange-400">fork_right</span>
                    <span className="text-orange-100">{currentBranch?.name || "メイン"}</span>
                    <span className="material-symbols-outlined text-base text-orange-400">
                      {showBranchSelector ? "expand_less" : "expand_more"}
                    </span>
                  </button>

                  {showBranchSelector && (
                    <SharedBranchSelector
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

          {/* Row 2: Sub mode toggle + Phase indicator */}
          <div className="flex items-center justify-between gap-2">
            {/* Mode Toggle */}
            <SubModeToggle
              currentMode={state.subMode}
              onModeChange={handleSubModeChange}
              disabled={isLoading || messages.length > 0}
            />

            {/* Phase Button - Planning mode only */}
            {state.subMode === "planning" && (
              <>
                {/* Mobile: Compact phase button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPhaseMenu(!showPhaseMenu);
                  }}
                  className={cn(
                    "sm:hidden flex items-center gap-1 px-2 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 whitespace-nowrap",
                    showPhaseMenu && "relative z-[46]"
                  )}
                >
                  <span className="text-xs font-bold text-purple-400">
                    {BRAINSTORM_PHASES.indexOf(state.currentPhase) + 1}/{BRAINSTORM_PHASES.length}
                  </span>
                  <span className="material-symbols-outlined text-purple-400 text-sm">
                    {showPhaseMenu ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {/* Desktop: Full phase indicator */}
                <div className="hidden sm:block relative z-30">
                  <BrainstormPhaseIndicator
                    currentPhase={state.currentPhase}
                    completedPhases={state.completedPhases}
                    compact
                    onPhaseClick={goToPhase}
                    onPhaseSkip={handlePhaseSkip}
                    disabled={isLoading}
                  />
                </div>
              </>
            )}
          </div>

          {/* Mobile Phase Dropdown - Planning mode only */}
          {state.subMode === "planning" && showPhaseMenu && (
            <MobilePhaseMenu
              currentPhase={state.currentPhase}
              completedPhases={state.completedPhases}
              onPhaseClick={(phase) => {
                goToPhase(phase);
                setShowPhaseMenu(false);
              }}
              onPhaseSkip={(phase) => {
                handlePhaseSkip(phase);
                setShowPhaseMenu(false);
              }}
              onClose={() => setShowPhaseMenu(false)}
            />
          )}

          {/* Progress Bar - Planning mode only (simplified on mobile) */}
          {state.subMode === "planning" && (
            <div className="mt-2">
              <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              {/* Phase title - only on mobile when menu is not shown */}
              <div className="sm:hidden mt-1 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate">
                  {currentPhaseInfo.title}
                </span>
                <span className="text-[10px] text-purple-400">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Split View when artifacts exist */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Panel - Chat */}
        <div className={cn(
          "flex flex-col min-h-0 transition-all duration-300 w-full",
          hasArtifacts && !isCodePanelCollapsed && "md:w-1/2"
        )}>
          {/* Messages */}
          <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0">
            {messages.length === 0 ? (
              <BrainstormWelcomeScreen
                welcomeMessage={welcomeMessage || BRAINSTORM_INITIAL_MESSAGES[state.subMode]}
                currentPhaseInfo={currentPhaseInfo}
                onQuickReply={handleQuickReply}
                subMode={state.subMode}
              />
            ) : (
              <div className="mx-auto max-w-4xl pb-4">
                {messages.map((message, index) => {
                  const isLastAssistantMessage =
                    message.role === "assistant" &&
                    !messages.slice(index + 1).some((m) => m.role === "assistant");

                  const isMessageStreaming = isLoading && index === messages.length - 1 && message.role === "assistant";

                  // Check for artifacts in this message
                  const containsArtifact = message.role === "assistant" &&
                    message.content.includes("<!--ARTIFACT:");
                  const isLastArtifactMessage = containsArtifact &&
                    !messages.slice(index + 1).some((m) =>
                      m.role === "assistant" && m.content.includes("<!--ARTIFACT:")
                    );

                  // Process message (hide artifact tags)
                  const processedMessage = message.role === "assistant"
                    ? { ...message, content: getProcessedContent(message.content, isMessageStreaming) }
                    : message;

                  return (
                    <div key={message.id || index} id={`msg-${index}`}>
                      <ChatMessage
                        message={processedMessage}
                        isStreaming={isMessageStreaming}
                        onOptionSelect={!isLoading && isLastAssistantMessage ? onSendMessage : undefined}
                        onFork={onForkFromMessage ? () => onForkFromMessage(index) : undefined}
                        showForkButton={!isLoading && index < messages.length - 1}
                        onRegenerate={onRegenerate}
                        showRegenerateButton={!isLoading && isLastAssistantMessage && canRegenerate}
                        conversationId={conversationId}
                      />

                      <InlineQuizSection
                        messageIndex={index}
                        quizHistory={activeArtifactProgress.quizHistory}
                        isUnlocked={activeArtifactProgress.isUnlocked}
                        unlockedAtMessageIndex={unlockedAtMessageIndex}
                        isLastArtifactMessage={isLastArtifactMessage}
                        currentQuiz={artQuiz.state.currentQuiz}
                        hintVisible={artQuiz.state.hintVisible}
                        activeArtifact={artQuiz.activeArtifact}
                        isLoading={isLoading}
                        onQuizAnswer={handleQuizAnswer}
                        onSendMessage={onSendMessage}
                        onRegenerateQuiz={handleRegenerateQuiz}
                        themeColor="purple"
                      />
                    </div>
                  );
                })}

                {/* Transition Suggestion UI */}
                {state.transitionSuggestion.isVisible && state.transitionSuggestion.targetPhase && (
                  <div className="px-4 py-3">
                    <TransitionSuggestionUI
                      currentPhase={state.currentPhase}
                      targetPhase={state.transitionSuggestion.targetPhase}
                      reason={state.transitionSuggestion.reason}
                      completionScore={state.phaseProgress[state.currentPhase].completionScore}
                      onAccept={handleAcceptTransition}
                      onDismiss={handleDismissTransition}
                    />
                  </div>
                )}

                {/* Suggested Plan */}
                {suggestedSteps.length > 0 && (
                  <div className="px-4 py-4">
                    <SuggestedPlan
                      steps={suggestedSteps}
                      onAccept={handleAcceptPlan}
                      onModify={handleModifyPlan}
                      onSimplify={handleSimplifyPlan}
                    />
                  </div>
                )}

                {/* Plan Steps (after accepted) */}
                {state.planSteps.length > 0 && (
                  <div className="px-4 py-4">
                    <PlanStepList
                      steps={state.planSteps}
                      onStepsChange={setPlanSteps}
                      editable
                    />
                  </div>
                )}

                {/* Brainstorm Completion UI */}
                {state.isCompleted && (
                  <BrainstormCompletionUI
                    brainstormState={state}
                    onSaveAsProject={() => setShowSaveModal(true)}
                    onShowSummary={handleShowSummary}
                    onStartNew={handleStartNewBrainstorm}
                  />
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
              placeholder={inputPlaceholder || currentPhaseInfo.questions[0]}
            />
          </div>
        </div>

        {/* Mobile FAB - Artifact Code */}
        {hasArtifacts && (
          <MobileCodeFAB
            onClick={() => setIsMobileArtifactSheetOpen(true)}
            progressPercentage={artQuiz.progressPercentage}
            themeColor="purple"
          />
        )}

        {/* Mobile Artifact Bottom Sheet */}
        {hasArtifacts && (
          <MobileArtifactSheet
            isOpen={isMobileArtifactSheetOpen}
            onClose={() => setIsMobileArtifactSheetOpen(false)}
            activeArtifact={artQuiz.activeArtifact}
            artifacts={artifactsList}
            activeArtifactId={artQuiz.state.activeArtifactId}
            artifactProgress={artQuiz.state.artifactProgress}
            unlockLevel={activeArtifactProgress.unlockLevel}
            totalQuestions={activeArtifactProgress.totalQuestions}
            progressPercentage={activeArtifactProgress.progressPercentage}
            canCopy={activeArtifactProgress.canCopy}
            onSelectArtifact={artQuiz.setActiveArtifact}
            themeColor="purple"
            isStreaming={isActiveArtifactStreaming}
          />
        )}

        {/* Right Panel - Artifact Code (Desktop) */}
        {hasArtifacts && !isCodePanelCollapsed && (
          <ArtifactCodePanel
            artifacts={artifactsList}
            activeArtifact={artQuiz.activeArtifact}
            activeArtifactId={artQuiz.state.activeArtifactId}
            artifactProgress={artQuiz.state.artifactProgress}
            unlockLevel={activeArtifactProgress.unlockLevel}
            totalQuestions={activeArtifactProgress.totalQuestions}
            progressPercentage={activeArtifactProgress.progressPercentage}
            canCopy={activeArtifactProgress.canCopy}
            onSelectArtifact={artQuiz.setActiveArtifact}
            onCollapse={() => setIsCodePanelCollapsed(true)}
            themeColor="purple"
            panelTitle="生成されたコード"
            isStreaming={isActiveArtifactStreaming}
          />
        )}
      </div>

      {/* Project Save Modal */}
      <ProjectSaveModal
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
        brainstormState={state}
        conversationId={conversationId}
      />

      {/* Summary Modal */}
      <BrainstormSummaryModal
        open={showSummaryModal}
        onOpenChange={setShowSummaryModal}
        messages={messages}
        brainstormState={state}
        conversationId={conversationId}
      />
    </div>
  );
}

