"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { BrainstormPhaseIndicator, PhaseTransitionCard } from "./BrainstormPhaseIndicator";
import { PlanStepList, SuggestedPlan } from "./PlanStepList";
import { ProjectSaveModal } from "@/components/projects/ProjectSaveModal";
import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import {
  useBrainstormMode,
  BRAINSTORM_PHASES,
  PHASE_INFO,
} from "@/hooks/useBrainstormMode";
import { MODE_CONFIG, MODE_ICON_SIZES } from "@/config/modes";
import type { Message, ConversationBranch, PlanStep, BrainstormPhase, BrainstormModeState, ConversationMetadata } from "@/types/chat";
import { cn } from "@/lib/utils";

interface BrainstormChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
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
}

// AIレスポンスからフェーズ移行を検出
function detectPhaseTransition(content: string): BrainstormPhase | null {
  const phaseKeywords: Record<BrainstormPhase, string[]> = {
    verbalization: ["一言で", "エレベーターピッチ", "要約すると"],
    persona: ["ターゲット", "ペルソナ", "誰のため", "ユーザー像"],
    market: ["競合", "類似サービス", "市場", "差別化"],
    technology: ["技術スタック", "実装方法", "フレームワーク", "言語"],
    impact: ["インパクト", "価値", "社会的", "変える"],
    mvp: ["MVP", "最小限", "検証", "スコープ"],
    "task-breakdown": ["タスク", "ステップ", "分解", "実装順序"],
  };

  for (const [phase, keywords] of Object.entries(phaseKeywords)) {
    if (keywords.some((keyword) => content.includes(keyword))) {
      return phase as BrainstormPhase;
    }
  }

  return null;
}

// AIレスポンスから計画ステップを抽出
function extractPlanSteps(content: string): PlanStep[] {
  const stepPattern = /^[\s\-\•\*]*(\d+)[.）)]\s*(.+)$/gm;
  const matches = [...content.matchAll(stepPattern)];

  if (matches.length === 0) return [];

  return matches.map((match, index) => ({
    id: `step-${index + 1}`,
    title: match[2].trim(),
    completed: false,
    order: parseInt(match[1], 10),
  }));
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
}: BrainstormChatContainerProps) {
  const { containerRef, endRef } = useAutoScroll(messages);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const hasBranches = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  const {
    state,
    currentPhaseInfo,
    progressPercentage,
    hasNextPhase,
    hasPrevPhase,
    advancePhase,
    goBackPhase,
    goToPhase,
    setPlanSteps,
    restoreState,
  } = useBrainstormMode();

  // Restore brainstorm state from loaded conversation metadata
  useEffect(() => {
    if (restoredMetadata?.brainstormState && !hasRestoredState) {
      restoreState(restoredMetadata.brainstormState as BrainstormModeState);
      setHasRestoredState(true);
    }
  }, [restoredMetadata, hasRestoredState, restoreState]);

  // Notify parent when brainstorm state changes (for saving)
  useEffect(() => {
    if (onMetadataChange && hasRestoredState) {
      onMetadataChange({ brainstormState: state });
    }
  }, [state, onMetadataChange, hasRestoredState]);

  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [suggestedSteps, setSuggestedSteps] = useState<PlanStep[]>([]);

  // Show save button when we have plan steps or are in task-breakdown phase
  const canSaveProject = state.planSteps.length > 0 || state.currentPhase === "task-breakdown";
  const prevMessagesLengthRef = useRef(messages.length);

  // メッセージが追加されたときの処理
  useEffect(() => {
    if (messages.length <= prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    prevMessagesLengthRef.current = messages.length;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return;

    const content = lastMessage.content;

    // フェーズ移行を検出
    const detectedPhase = detectPhaseTransition(content);
    if (detectedPhase && detectedPhase !== state.currentPhase) {
      const currentIndex = BRAINSTORM_PHASES.indexOf(state.currentPhase);
      const detectedIndex = BRAINSTORM_PHASES.indexOf(detectedPhase);

      // 次のフェーズへの移行を提案
      if (detectedIndex === currentIndex + 1) {
        setShowPhaseTransition(true);
      }
    }

    // タスク分解フェーズで計画ステップを抽出
    if (state.currentPhase === "task-breakdown") {
      const steps = extractPlanSteps(content);
      if (steps.length > 0) {
        setSuggestedSteps(steps);
      }
    }
  }, [messages, state.currentPhase]);

  // フェーズ移行を承認
  const handlePhaseTransitionAccept = useCallback(() => {
    advancePhase();
    setShowPhaseTransition(false);
  }, [advancePhase]);

  // フェーズ移行をスキップ
  const handlePhaseTransitionSkip = useCallback(() => {
    setShowPhaseTransition(false);
  }, []);

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

  const modeConfig = MODE_CONFIG.brainstorm;
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Header - Mobile Optimized */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-4xl px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Icon + Title (collapsible on mobile) */}
            <div className={cn(
              "rounded-lg flex items-center justify-center shrink-0",
              "size-8 sm:size-10",
              modeConfig.bgColor,
              modeConfig.color
            )}>
              <span className="material-symbols-outlined text-lg sm:text-xl">{modeConfig.icon}</span>
            </div>
            <div className="flex-1 min-w-0 hidden sm:block">
              <h1 className="font-bold text-base sm:text-lg">{modeConfig.title}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {modeConfig.shortDescription}
              </p>
            </div>

            {/* Mobile: Phase Button (opens dropdown) */}
            <button
              onClick={() => setShowPhaseMenu(!showPhaseMenu)}
              className="sm:hidden flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20"
            >
              <span className="material-symbols-outlined text-purple-400 text-base">
                {currentPhaseInfo.icon}
              </span>
              <span className="text-xs font-medium text-purple-400">
                {BRAINSTORM_PHASES.indexOf(state.currentPhase) + 1}/{BRAINSTORM_PHASES.length}
              </span>
              <span className="material-symbols-outlined text-purple-400 text-sm">
                {showPhaseMenu ? "expand_less" : "expand_more"}
              </span>
            </button>

            {/* Desktop: Phase Indicator (Compact) */}
            <div className="hidden sm:block">
              <BrainstormPhaseIndicator
                currentPhase={state.currentPhase}
                completedPhases={state.completedPhases}
                compact
                onPhaseClick={goToPhase}
              />
            </div>

            {/* Save Project Button - Icon only on mobile */}
            {canSaveProject && (
              <Button
                size="sm"
                onClick={() => setShowSaveModal(true)}
                className="gap-1 px-2 sm:px-3"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span className="hidden sm:inline">保存</span>
              </Button>
            )}

            {/* Branch Selector - Hidden on mobile */}
            {hasBranches && (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setShowBranchSelector(!showBranchSelector)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 transition-colors text-sm font-medium"
                >
                  <span className="material-symbols-outlined text-base text-orange-400">fork_right</span>
                  <span className="text-orange-100">{currentBranch?.name || "メイン"}</span>
                  <span className="material-symbols-outlined text-base text-orange-400">
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

          {/* Mobile Phase Dropdown */}
          {showPhaseMenu && (
            <MobilePhaseMenu
              currentPhase={state.currentPhase}
              completedPhases={state.completedPhases}
              onPhaseClick={(phase) => {
                goToPhase(phase);
                setShowPhaseMenu(false);
              }}
              onClose={() => setShowPhaseMenu(false)}
            />
          )}

          {/* Progress Bar - Always visible but compact on mobile */}
          <div className="mt-2 sm:mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground/80 truncate">
                <span className="sm:hidden">{currentPhaseInfo.title}</span>
                <span className="hidden sm:inline">{currentPhaseInfo.title}: {currentPhaseInfo.description}</span>
              </span>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="h-1 sm:h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <WelcomeScreen
            welcomeMessage={welcomeMessage}
            currentPhaseInfo={currentPhaseInfo}
            onQuickReply={handleQuickReply}
          />
        ) : (
          <div className="mx-auto max-w-4xl pb-4">
            {messages.map((message, index) => {
              // Find if this is the last assistant message
              const isLastAssistantMessage =
                message.role === "assistant" &&
                !messages.slice(index + 1).some((m) => m.role === "assistant");

              return (
              <div key={message.id || index}>
                <ChatMessage
                  message={message}
                  isStreaming={isLoading && index === messages.length - 1 && message.role === "assistant"}
                  onOptionSelect={!isLoading && isLastAssistantMessage ? onSendMessage : undefined}
                  onFork={onForkFromMessage ? () => onForkFromMessage(index) : undefined}
                  showForkButton={!isLoading && index < messages.length - 1}
                  onRegenerate={onRegenerate}
                  showRegenerateButton={!isLoading && isLastAssistantMessage && canRegenerate}
                />
              </div>
              );
            })}

            {/* Phase Transition Card */}
            {showPhaseTransition && hasNextPhase && (
              <div className="px-4 py-4">
                <PhaseTransitionCard
                  fromPhase={state.currentPhase}
                  toPhase={BRAINSTORM_PHASES[BRAINSTORM_PHASES.indexOf(state.currentPhase) + 1]}
                  onContinue={handlePhaseTransitionAccept}
                  onBack={handlePhaseTransitionSkip}
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

      {/* Project Save Modal */}
      <ProjectSaveModal
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
        brainstormState={state}
        conversationId={conversationId}
      />
    </div>
  );
}

// Mobile Phase Menu
function MobilePhaseMenu({
  currentPhase,
  completedPhases,
  onPhaseClick,
  onClose,
}: {
  currentPhase: BrainstormPhase;
  completedPhases: BrainstormPhase[];
  onPhaseClick: (phase: BrainstormPhase) => void;
  onClose: () => void;
}) {
  const currentIndex = BRAINSTORM_PHASES.indexOf(currentPhase);

  return (
    <div className="mt-2 p-2 rounded-lg border border-border bg-card shadow-lg">
      <div className="grid grid-cols-4 gap-1">
        {BRAINSTORM_PHASES.map((phase, index) => {
          const phaseInfo = PHASE_INFO[phase];
          const isCompleted = completedPhases.includes(phase);
          const isCurrent = phase === currentPhase;
          const isClickable = isCompleted || index <= currentIndex;

          return (
            <button
              key={phase}
              onClick={() => isClickable && onPhaseClick(phase)}
              disabled={!isClickable}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                isCurrent
                  ? "bg-purple-500/20 text-purple-400"
                  : isCompleted
                  ? "bg-green-500/10 text-green-400"
                  : "bg-muted/30 text-muted-foreground opacity-50"
              )}
            >
              <span className="material-symbols-outlined text-lg">
                {isCompleted && !isCurrent ? "check" : phaseInfo.icon}
              </span>
              <span className="text-[10px] font-medium truncate w-full text-center">
                {phaseInfo.title}
              </span>
            </button>
          );
        })}
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
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Dropdown menu */}
      <div
        className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border-2 border-orange-500/30 bg-card shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-orange-500/20 bg-orange-500/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-100">
            <span className="material-symbols-outlined text-base text-orange-400">fork_right</span>
            <span>会話の分岐</span>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto bg-card">
          {branches.map((branch) => {
            const isActive = branch.id === currentBranchId;
            const isMain = !branch.parentBranchId;
            return (
              <button
                key={branch.id}
                onClick={() => onSelect(branch.id)}
                className={cn(
                  "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-border/50 last:border-b-0",
                  isActive
                    ? "bg-orange-500/20 text-orange-100"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-xl",
                    isMain ? "text-blue-400" : "text-orange-400"
                  )}
                >
                  {isMain ? "timeline" : "fork_right"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{branch.name}</div>
                  <div className="text-xs text-foreground/60">
                    {isMain ? "オリジナル" : `メッセージ ${branch.forkPointIndex + 1} から分岐`}
                  </div>
                </div>
                {isActive && (
                  <span className="material-symbols-outlined text-orange-400 text-lg">check</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Welcome Screen - Mobile optimized
function WelcomeScreen({
  welcomeMessage,
  currentPhaseInfo,
  onQuickReply,
}: {
  welcomeMessage?: string;
  currentPhaseInfo: (typeof PHASE_INFO)[BrainstormPhase];
  onQuickReply: (value: string) => void;
}) {
  const config = MODE_CONFIG.brainstorm;

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

      {/* フェーズガイド */}
      <div className="w-full max-w-md mb-6 sm:mb-8 p-3 sm:p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn("material-symbols-outlined text-lg sm:text-xl", config.color)}>
            {currentPhaseInfo.icon}
          </span>
          <span className={cn("font-medium text-sm sm:text-base", config.color)}>
            {currentPhaseInfo.title}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-foreground/80 mb-2 sm:mb-3">
          {currentPhaseInfo.description}
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground italic">
          {currentPhaseInfo.questions[0]}
        </p>
      </div>

      {/* Quick Replies - 2 columns on mobile, responsive */}
      <div className="w-full max-w-lg px-2">
        <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 text-center">
          選択するか、自由に入力:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {currentPhaseInfo.quickReplies.map((qr, index) => (
            <button
              key={index}
              onClick={() => onQuickReply(qr.value)}
              className={cn(
                "text-left p-2.5 sm:p-3 rounded-lg border border-border bg-card transition-all text-xs sm:text-sm",
                config.hoverBgColor,
                "hover:border-primary/50 active:scale-[0.98]"
              )}
            >
              {qr.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
