"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { BrainstormPhaseIndicator } from "./BrainstormPhaseIndicator";
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
import type { Message, ConversationBranch, PlanStep, BrainstormPhase, BrainstormSubMode, BrainstormModeState, ConversationMetadata } from "@/types/chat";
import { BRAINSTORM_SUB_MODES } from "@/types/chat";
import { BRAINSTORM_INITIAL_MESSAGES } from "@/lib/prompts";
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
  // SubMode control (for API calls)
  subMode?: BrainstormSubMode;
  onSubModeChange?: (subMode: BrainstormSubMode) => void;
  // Project selector
  headerExtra?: React.ReactNode;
}

// AIレスポンスから適切なフェーズを検出（会話内容から判断）
function detectAppropriatePhase(content: string): BrainstormPhase | null {
  // 各フェーズを示すキーワード（優先度順：後のフェーズほど優先）
  const phaseIndicators: { phase: BrainstormPhase; keywords: string[] }[] = [
    { phase: "task-breakdown", keywords: ["タスク分解", "実装ステップ", "タスクリスト", "実装順序", "開発ステップ"] },
    { phase: "mvp", keywords: ["MVP", "最小限の機能", "最初に作る", "検証に必要な機能"] },
    { phase: "impact", keywords: ["インパクト", "社会的価値", "成功したら", "世の中が変わる"] },
    { phase: "technology", keywords: ["技術スタック", "プラットフォーム", "フレームワーク", "実装方法", "技術選定"] },
    { phase: "market", keywords: ["競合", "類似サービス", "差別化", "市場"] },
    { phase: "persona", keywords: ["ペルソナ", "ターゲット", "誰のため", "ユーザー像", "課題を解決"] },
    { phase: "verbalization", keywords: ["一言で", "アイデア", "サービス概要"] },
  ];

  // 後のフェーズから順にチェック（より進んだフェーズを優先）
  for (const { phase, keywords } of phaseIndicators) {
    if (keywords.some((keyword) => content.includes(keyword))) {
      return phase;
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
  subMode: externalSubMode,
  onSubModeChange,
  headerExtra,
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
    goToPhase,
    skipToPhase,
    setPlanSteps,
    setSubMode: setInternalSubMode,
    restoreState,
  } = useBrainstormMode();

  // Handle subMode change - update both internal state and notify parent
  const handleSubModeChange = useCallback((newSubMode: BrainstormSubMode) => {
    setInternalSubMode(newSubMode);
    onSubModeChange?.(newSubMode);
  }, [setInternalSubMode, onSubModeChange]);

  // Notify parent of initial/restored subMode
  useEffect(() => {
    if (onSubModeChange) {
      onSubModeChange(state.subMode);
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
  // フェーズ変更通知用の状態
  const [phaseChangeNotification, setPhaseChangeNotification] = useState<{
    fromPhase: BrainstormPhase;
    toPhase: BrainstormPhase;
  } | null>(null);

  // Show save button when we have plan steps or are in task-breakdown phase
  const canSaveProject = state.planSteps.length > 0 || state.currentPhase === "task-breakdown";
  const prevIsLoadingRef = useRef(isLoading);

  // フェーズ変更時に即座に状態を保存（checkPhaseTransitionAndStepsより前に定義）
  const saveStateImmediately = useCallback((newPhase: BrainstormPhase) => {
    if (onMetadataChange) {
      // デバウンスをスキップして即座に保存
      if (metadataTimeoutRef.current) {
        clearTimeout(metadataTimeoutRef.current);
      }
      const targetIndex = BRAINSTORM_PHASES.indexOf(newPhase);

      // 完了フェーズを計算
      const phasesToComplete = BRAINSTORM_PHASES.slice(0, targetIndex);
      const updatedState: BrainstormModeState = {
        ...state,
        currentPhase: newPhase,
        completedPhases: phasesToComplete,
      };
      onMetadataChange({ brainstormState: updatedState });
    }
  }, [onMetadataChange, state]);

  // AIレスポンスから適切なフェーズを検出し、自動で遷移（企画書モードのみ）
  const checkPhaseTransitionAndSteps = useCallback((content: string) => {
    // カジュアルモードではフェーズ検出を行わない
    if (state.subMode === "casual") return;

    // 会話内容から適切なフェーズを検出
    const detectedPhase = detectAppropriatePhase(content);

    // 「完了ですね」を検出した場合、または検出されたフェーズが現在と異なる場合
    const phaseCompletionMatch = content.match(/([言語化|ペルソナ|市場検証|技術検証|インパクト|MVP定義|タスク分解]+)(?:フェーズ)?(?:は|が)?完了/);
    const hasCompletionKeyword = phaseCompletionMatch !== null;

    // 検出されたフェーズが現在と異なる場合は自動で変更
    if (detectedPhase && detectedPhase !== state.currentPhase) {
      const currentIndex = BRAINSTORM_PHASES.indexOf(state.currentPhase);
      const targetIndex = BRAINSTORM_PHASES.indexOf(detectedPhase);

      // フェーズ変更通知を設定
      setPhaseChangeNotification({
        fromPhase: state.currentPhase,
        toPhase: detectedPhase,
      });

      // 前進（スキップ含む）または後退のどちらも許可
      if (targetIndex > currentIndex) {
        // 前進: skipToPhase を使用
        skipToPhase(detectedPhase);
      } else {
        // 後退: goToPhase を使用
        goToPhase(detectedPhase);
      }
      saveStateImmediately(detectedPhase);

      // 5秒後に通知を自動で消す
      setTimeout(() => setPhaseChangeNotification(null), 5000);
    }
    // フェーズは変わらないが完了キーワードがある場合、次のフェーズへの移行を提案
    else if (hasCompletionKeyword) {
      const currentIndex = BRAINSTORM_PHASES.indexOf(state.currentPhase);
      const nextPhase = BRAINSTORM_PHASES[currentIndex + 1];
      if (nextPhase) {
        setPhaseChangeNotification({
          fromPhase: state.currentPhase,
          toPhase: nextPhase,
        });
        // この場合は自動で消さない（ユーザーの操作を待つ）
      }
    }

    // タスク分解フェーズで計画ステップを抽出
    if (state.currentPhase === "task-breakdown" || detectedPhase === "task-breakdown") {
      const steps = extractPlanSteps(content);
      if (steps.length > 0) {
        setSuggestedSteps(steps);
      }
    }
  }, [state.subMode, state.currentPhase, skipToPhase, goToPhase, saveStateImmediately]);

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
    saveStateImmediately(targetPhase);
    sendPhaseGuidanceMessage(targetPhase);
  }, [skipToPhase, saveStateImmediately, sendPhaseGuidanceMessage]);

  // 通知から次のフェーズへ進む
  const handleAcceptPhaseFromNotification = useCallback(() => {
    if (phaseChangeNotification) {
      const { toPhase } = phaseChangeNotification;
      // まだ遷移していない場合のみ（完了キーワード検出時）
      if (state.currentPhase !== toPhase) {
        skipToPhase(toPhase);
        saveStateImmediately(toPhase);
        sendPhaseGuidanceMessage(toPhase);
      }
      setPhaseChangeNotification(null);
    }
  }, [phaseChangeNotification, state.currentPhase, skipToPhase, saveStateImmediately, sendPhaseGuidanceMessage]);

  // 通知を閉じる
  const handleDismissNotification = useCallback(() => {
    setPhaseChangeNotification(null);
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
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80 relative z-20">
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

            {/* Header Extra (Project Selector etc.) */}
            {headerExtra}

            {/* Mode Toggle */}
            <SubModeToggle
              currentMode={state.subMode}
              onModeChange={handleSubModeChange}
              disabled={isLoading || messages.length > 0}
            />

            {/* Mobile: Phase Button (opens dropdown) - Planning mode only */}
            {state.subMode === "planning" && (
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
            )}

            {/* Desktop: Phase Indicator (Compact) - Planning mode only */}
            {state.subMode === "planning" && (
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
            )}

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

          {/* Progress Bar - Planning mode only */}
          {state.subMode === "planning" && (
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
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <WelcomeScreen
            welcomeMessage={welcomeMessage || BRAINSTORM_INITIAL_MESSAGES[state.subMode]}
            currentPhaseInfo={currentPhaseInfo}
            onQuickReply={handleQuickReply}
            subMode={state.subMode}
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
                  conversationId={conversationId}
                />
              </div>
              );
            })}

            {/* Phase Change Notification */}
            {phaseChangeNotification && (
              <div className="px-4 py-3">
                <PhaseChangeNotification
                  fromPhase={phaseChangeNotification.fromPhase}
                  toPhase={phaseChangeNotification.toPhase}
                  isAlreadyChanged={state.currentPhase === phaseChangeNotification.toPhase}
                  onAccept={handleAcceptPhaseFromNotification}
                  onDismiss={handleDismissNotification}
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
  onPhaseSkip,
  onClose,
}: {
  currentPhase: BrainstormPhase;
  completedPhases: BrainstormPhase[];
  onPhaseClick: (phase: BrainstormPhase) => void;
  onPhaseSkip?: (phase: BrainstormPhase) => void;
  onClose: () => void;
}) {
  const currentIndex = BRAINSTORM_PHASES.indexOf(currentPhase);

  return (
    <>
      {/* Backdrop - click to close */}
      <div
        className="fixed inset-0 z-[45] bg-black/20"
        onClick={onClose}
      />
      <div className="relative z-[50] mt-2 p-2 rounded-lg border border-border bg-card shadow-lg">
        <div className="text-xs text-muted-foreground mb-2 px-1">
          タップでフェーズ移動（前進はスキップ）
        </div>
        <div className="grid grid-cols-4 gap-1">
        {BRAINSTORM_PHASES.map((phase, index) => {
          const phaseInfo = PHASE_INFO[phase];
          const isCompleted = completedPhases.includes(phase);
          const isCurrent = phase === currentPhase;
          const isFuture = index > currentIndex;

          const handleClick = () => {
            if (isCurrent) return;
            if (isFuture && onPhaseSkip) {
              onPhaseSkip(phase);
            } else {
              onPhaseClick(phase);
            }
          };

          return (
            <button
              key={phase}
              onClick={handleClick}
              disabled={isCurrent}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                isCurrent
                  ? "bg-purple-500/20 text-purple-400 cursor-default"
                  : isCompleted
                  ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : isFuture
                  ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-dashed border-orange-500/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <span className="material-symbols-outlined text-lg">
                {isCompleted && !isCurrent ? "check" : isFuture ? "skip_next" : phaseInfo.icon}
              </span>
              <span className="text-[10px] font-medium truncate w-full text-center">
                {phaseInfo.title}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </>
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
        className="fixed inset-0 z-40 bg-black/20"
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
  subMode,
}: {
  welcomeMessage?: string;
  currentPhaseInfo: (typeof PHASE_INFO)[BrainstormPhase];
  onQuickReply: (value: string) => void;
  subMode: BrainstormSubMode;
}) {
  const config = MODE_CONFIG.brainstorm;
  const subModeConfig = BRAINSTORM_SUB_MODES.find((m) => m.mode === subMode);

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8">
      <div className={cn(
        "rounded-2xl flex items-center justify-center mb-4 sm:mb-6",
        "size-16 sm:size-20",
        config.bgColor,
        config.color
      )}>
        <span className="material-symbols-outlined text-3xl sm:text-4xl">
          {subModeConfig?.icon || config.icon}
        </span>
      </div>

      <h2 className="text-xl sm:text-2xl font-bold mb-2">
        {subModeConfig?.title || config.title}
      </h2>

      {welcomeMessage && (
        <p className="text-muted-foreground text-center max-w-md mb-4 text-sm sm:text-base whitespace-pre-line">
          {welcomeMessage}
        </p>
      )}

      {/* フェーズガイド - Planning mode only */}
      {subMode === "planning" && (
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
      )}

      {/* Quick Replies - Planning mode only */}
      {subMode === "planning" && (
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
      )}
    </div>
  );
}

// Sub Mode Toggle
function SubModeToggle({
  currentMode,
  onModeChange,
  disabled,
}: {
  currentMode: BrainstormSubMode;
  onModeChange: (mode: BrainstormSubMode) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/50 border border-border">
      {BRAINSTORM_SUB_MODES.map((mode) => (
        <button
          key={mode.mode}
          onClick={() => onModeChange(mode.mode)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all",
            currentMode === mode.mode
              ? "bg-purple-500/20 text-purple-400 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            disabled && "cursor-not-allowed opacity-50"
          )}
          title={mode.description}
        >
          <span className="material-symbols-outlined text-sm">{mode.icon}</span>
          <span className="hidden sm:inline">{mode.title}</span>
        </button>
      ))}
    </div>
  );
}

// Phase Change Notification
function PhaseChangeNotification({
  fromPhase,
  toPhase,
  isAlreadyChanged,
  onAccept,
  onDismiss,
}: {
  fromPhase: BrainstormPhase;
  toPhase: BrainstormPhase;
  isAlreadyChanged: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const fromInfo = PHASE_INFO[fromPhase];
  const toInfo = PHASE_INFO[toPhase];

  return (
    <div className="animate-in slide-in-from-bottom-2 duration-300 p-3 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="material-symbols-outlined text-green-400 text-lg">check_circle</span>
          <span className="material-symbols-outlined text-purple-400 text-sm">arrow_forward</span>
          <div className="size-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-purple-400 text-base">{toInfo.icon}</span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {isAlreadyChanged ? (
            <p className="text-sm">
              <span className="font-medium text-green-400">{fromInfo.title}</span>
              <span className="text-muted-foreground"> → </span>
              <span className="font-medium text-purple-400">{toInfo.title}</span>
              <span className="text-muted-foreground"> に移動しました</span>
            </p>
          ) : (
            <p className="text-sm">
              <span className="font-medium text-green-400">{fromInfo.title}</span>
              <span className="text-muted-foreground"> 完了。</span>
              <span className="font-medium text-purple-400">{toInfo.title}</span>
              <span className="text-muted-foreground"> に進みますか？</span>
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {!isAlreadyChanged && (
            <button
              onClick={onAccept}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
            >
              進む
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
