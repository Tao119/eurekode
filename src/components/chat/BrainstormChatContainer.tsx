"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatModeSelector } from "./ChatModeSelector";
import { BrainstormPhaseIndicator } from "./BrainstormPhaseIndicator";
import { PlanStepList, SuggestedPlan } from "./PlanStepList";
import { ProjectSaveModal } from "@/components/projects/ProjectSaveModal";
import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { exportBrainstormToMarkdown, downloadMarkdownFile } from "@/lib/markdown-exporter";
import {
  useBrainstormMode,
  BRAINSTORM_PHASES,
  PHASE_INFO,
  getPhaseCompletionCriteria,
} from "@/hooks/useBrainstormMode";
import { MODE_CONFIG, MODE_ICON_SIZES } from "@/config/modes";
import type { Message, ConversationBranch, PlanStep, BrainstormPhase, BrainstormSubMode, BrainstormModeState, ConversationMetadata, FileAttachment } from "@/types/chat";
import { BRAINSTORM_SUB_MODES } from "@/types/chat";
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
}

// AIレスポンスから適切なフェーズを検出（会話内容から判断）
// 注意: この関数は参考情報としてのみ使用し、自動遷移には使わない
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

/**
 * AIレスポンスから各フェーズの情報を抽出
 * キーワードマッチングではなく、内容の有無を確認
 */
function extractPhaseInfoFromResponse(
  content: string,
  currentPhase: BrainstormPhase
): Record<string, string | null> {
  const extracted: Record<string, string | null> = {};

  switch (currentPhase) {
    case "verbalization": {
      // アイデアの説明があるかチェック
      const hasIdea = content.length > 50 && (
        content.includes("という") ||
        content.includes("です") ||
        content.includes("サービス") ||
        content.includes("アプリ") ||
        content.includes("システム")
      );
      if (hasIdea) {
        // 最初の文をサマリーとして抽出
        const firstSentence = content.split(/[。！？\n]/)[0];
        extracted.ideaSummary = firstSentence.slice(0, 100);
      }
      break;
    }
    case "persona": {
      // ターゲットユーザーの記述
      const targetPatterns = [
        /ターゲット(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
        /対象(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
        /(.+?)(?:向け|のため)/,
      ];
      for (const pattern of targetPatterns) {
        const match = content.match(pattern);
        if (match) {
          extracted.targetUser = match[1].trim().slice(0, 50);
          break;
        }
      }
      // 課題・ペインポイントの記述
      const painPatterns = [
        /課題(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
        /困っている(?:こと|点)(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
        /解決したい(?:こと|問題)(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
      ];
      for (const pattern of painPatterns) {
        const match = content.match(pattern);
        if (match) {
          extracted.painPoint = match[1].trim().slice(0, 100);
          break;
        }
      }
      break;
    }
    case "market": {
      // 競合サービスの言及
      if (content.includes("競合") || content.includes("類似") || content.includes("既存")) {
        extracted.competitors = "mentioned";
      }
      // 差別化ポイント
      if (content.includes("差別化") || content.includes("違い") || content.includes("独自")) {
        extracted.differentiation = "mentioned";
      }
      break;
    }
    case "technology": {
      // プラットフォームの記述
      const platformPatterns = [
        /(?:Web|ウェブ)(?:アプリ|サイト)/i,
        /モバイル(?:アプリ)?/,
        /(?:iOS|Android|iPhone)/i,
        /デスクトップ/,
      ];
      for (const pattern of platformPatterns) {
        if (pattern.test(content)) {
          extracted.platform = content.match(pattern)?.[0] || "mentioned";
          break;
        }
      }
      // 技術スタックの記述
      const techKeywords = ["React", "Next.js", "Vue", "Python", "Node", "TypeScript", "Firebase", "AWS"];
      const mentionedTech = techKeywords.filter(tech =>
        content.toLowerCase().includes(tech.toLowerCase())
      );
      if (mentionedTech.length > 0) {
        extracted.techStack = mentionedTech.join(", ");
      }
      break;
    }
    case "impact": {
      // 価値提案の記述
      if (
        content.includes("価値") ||
        content.includes("メリット") ||
        content.includes("変わる") ||
        content.includes("できるようになる")
      ) {
        extracted.valueProposition = "mentioned";
      }
      break;
    }
    case "mvp": {
      // コア機能の記述
      if (
        content.includes("最小限") ||
        content.includes("コア機能") ||
        content.includes("必須機能") ||
        content.includes("まず")
      ) {
        extracted.coreFeatures = "mentioned";
      }
      break;
    }
    case "task-breakdown": {
      // タスクの記述
      const taskPattern = /^[\s\-\•\*]*(\d+)[.）)]\s*(.+)$/gm;
      const matches = [...content.matchAll(taskPattern)];
      if (matches.length > 0) {
        extracted.tasks = `${matches.length}件`;
      }
      break;
    }
  }

  return extracted;
}

/**
 * 完了判定のキーワードを検出
 */
function detectCompletionIntent(content: string): boolean {
  const completionPatterns = [
    /整理(?:でき|し)(?:ました|た)/,
    /(?:これで|以上で).*(?:完了|大丈夫|OK)/i,
    /次(?:に|の(?:ステップ|フェーズ))/,
    /進(?:みましょう|めましょう)/,
  ];
  return completionPatterns.some(pattern => pattern.test(content));
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

  // Markdownエクスポート
  const handleExportMarkdown = useCallback(() => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const titleSlug = state.ideaSummary
      ? state.ideaSummary.slice(0, 30).replace(/[/\\:*?"<>|]/g, "").trim()
      : "";
    const filename = `${timestamp}_${titleSlug || "brainstorm"}.md`;

    const markdown = exportBrainstormToMarkdown(messages, state, {
      title: state.ideaSummary || "ブレインストーミング記録",
      includeTimestamps: true,
    });

    downloadMarkdownFile(markdown, filename);
  }, [messages, state]);

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

              {/* Export Button */}
              {messages.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportMarkdown}
                  className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0"
                  title="Markdownでエクスポート"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  <span className="hidden sm:inline ml-1">MD</span>
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
              <div key={message.id || index} id={`msg-${index}`}>
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
                onExportMarkdown={handleExportMarkdown}
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
      {/* Full screen backdrop for closing */}
      <div
        className="fixed inset-0 z-[45]"
        onClick={onClose}
        onTouchStart={onClose}
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
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap",
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

// Transition Suggestion UI - 遷移提案（suggestポリシー）
function TransitionSuggestionUI({
  currentPhase,
  targetPhase,
  reason,
  completionScore,
  onAccept,
  onDismiss,
}: {
  currentPhase: BrainstormPhase;
  targetPhase: BrainstormPhase;
  reason: string | null;
  completionScore: number;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const currentInfo = PHASE_INFO[currentPhase];
  const targetInfo = PHASE_INFO[targetPhase];

  return (
    <div className="animate-in slide-in-from-bottom-2 duration-300 p-4 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">
            {currentInfo.title}の進捗
          </span>
          <span className="text-xs font-medium text-purple-400">
            {completionScore}%
          </span>
        </div>
        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${completionScore}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="size-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-green-400 text-base">check</span>
          </div>
          <span className="material-symbols-outlined text-purple-400 text-sm">arrow_forward</span>
          <div className="size-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-purple-400 text-base">{targetInfo.icon}</span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            <span className="text-purple-400">{targetInfo.title}</span>
            <span className="text-foreground">に進めます</span>
          </p>
          {reason && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {reason}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            まだこのステップで話し合いたい場合は、そのまま会話を続けてください
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onAccept}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors flex items-center gap-1"
          >
            <span>次へ進む</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
          <button
            onClick={onDismiss}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
            title="このまま続ける"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Brainstorm Completion UI - 全フェーズ完了時の表示
function BrainstormCompletionUI({
  brainstormState,
  onSaveAsProject,
  onExportMarkdown,
  onStartNew,
}: {
  brainstormState: BrainstormModeState;
  onSaveAsProject: () => void;
  onExportMarkdown: () => void;
  onStartNew: () => void;
}) {
  const completedAt = brainstormState.completedAt
    ? new Date(brainstormState.completedAt)
    : new Date();

  return (
    <div className="px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="animate-in slide-in-from-bottom-2 duration-300 rounded-2xl border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 p-6 sm:p-8">
          {/* 完了アイコン */}
          <div className="flex justify-center mb-4">
            <div className="size-16 sm:size-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-500 text-4xl sm:text-5xl">
                check_circle
              </span>
            </div>
          </div>

          {/* 完了メッセージ */}
          <h3 className="text-xl sm:text-2xl font-bold text-center mb-2">
            企画書が完成しました
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {completedAt.toLocaleString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {/* サマリー */}
          {brainstormState.ideaSummary && (
            <div className="bg-card/50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-green-500 text-sm">
                  lightbulb
                </span>
                <span className="text-sm font-medium">アイデア</span>
              </div>
              <p className="text-sm pl-6">{brainstormState.ideaSummary}</p>

              {brainstormState.planSteps.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pl-6">
                  <span className="material-symbols-outlined text-green-500 text-xs">
                    checklist
                  </span>
                  <span className="text-xs text-muted-foreground">
                    タスク数: {brainstormState.planSteps.length}件
                  </span>
                </div>
              )}
            </div>
          )}

          {/* アクションボタン */}
          <div className="space-y-3">
            <button
              onClick={onSaveAsProject}
              className="w-full py-3 px-4 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              プロジェクトとして保存
            </button>

            <button
              onClick={onExportMarkdown}
              className="w-full py-3 px-4 rounded-lg border-2 border-border hover:bg-muted/50 font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Markdownでエクスポート
            </button>

            <button
              onClick={onStartNew}
              className="w-full py-2.5 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              新しいブレインストーミングを始める
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
