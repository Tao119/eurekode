"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { BlurredCode } from "./BlurredCode";
import { GenerationQuiz, QUIZ_TEMPLATES } from "./GenerationQuiz";
import { GenerationOptionsPopover } from "./GenerationOptionsPopover";
import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import {
  useGenerationMode,
  type UnlockLevel,
  type UnlockQuiz,
  type GeneratedCode,
  type GenerationOptions,
} from "@/hooks/useGenerationMode";
import { useUserSettingsOptional } from "@/contexts/UserSettingsContext";
import { MODE_CONFIG, MODE_ICON_SIZES } from "@/config/modes";
import type { Message, ConversationBranch } from "@/types/chat";
import { cn } from "@/lib/utils";

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
}

// AIレスポンスからコードブロックを抽出
function extractCodeBlock(content: string): GeneratedCode | null {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/;
  const match = content.match(codeBlockRegex);

  if (match) {
    return {
      language: match[1] || "text",
      code: match[2].trim(),
    };
  }

  return null;
}

// AIレスポンスからクイズを抽出
function extractQuizFromResponse(content: string, level: UnlockLevel): UnlockQuiz | null {
  // 選択肢パターン: A) text or A. text
  const optionPattern = /^([A-D])[).\:：]\s*(.+)$/gm;
  const matches = [...content.matchAll(optionPattern)];

  if (matches.length >= 2) {
    // 質問を探す（選択肢の前の質問文）
    const questionMatch = content.match(/.*[？?]\s*(?=\n*[A-D][).:])/);
    const question = questionMatch
      ? questionMatch[0].trim()
      : QUIZ_TEMPLATES[level].questions[0];

    const options = matches.map((m) => ({
      label: m[1],
      text: m[2].trim(),
    }));

    // 正解を推測（通常はAが正解として設定されることが多いが、コンテキストから判断）
    // ここでは仮にAを正解とする（実際のAIレスポンスに正解情報を含める必要がある）
    const correctLabel = "A";

    return {
      level,
      question,
      options,
      correctLabel,
      hint: `この問題は${QUIZ_TEMPLATES[level].questions[0]}に関する理解を確認しています。`,
    };
  }

  return null;
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
}: GenerationChatContainerProps) {
  const { containerRef, endRef } = useAutoScroll(messages);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const hasBranches = branches.length > 1;
  const currentBranch = branches.find((b) => b.id === currentBranchId);

  // Get user settings from context (may be null if not in provider)
  const userSettingsContext = useUserSettingsOptional();

  // Convert user settings to generation options
  const initialOptions = useMemo<Partial<GenerationOptions>>(() => {
    if (!userSettingsContext) return {};
    const { settings } = userSettingsContext;
    return {
      unlockMethod: settings.unlockMethod,
      hintSpeed: settings.hintSpeed,
      estimationTraining: settings.estimationTraining,
    };
  }, [userSettingsContext]);

  const {
    state,
    options,
    canCopyCode,
    progressPercentage,
    setPhase,
    setGeneratedCode,
    setCurrentQuiz,
    answerQuiz,
    skipToUnlock,
    updateOptions,
  } = useGenerationMode(initialOptions);

  const [showPlanningHelper, setShowPlanningHelper] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);

  // メッセージが追加されたときの処理
  useEffect(() => {
    if (messages.length <= prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    prevMessagesLengthRef.current = messages.length;

    // 最新のアシスタントメッセージを取得
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return;

    const content = lastMessage.content;

    // フェーズに応じた処理
    if (state.phase === "initial" || state.phase === "planning") {
      // 計画を促すメッセージがあれば計画フェーズへ
      if (content.includes("手順") || content.includes("ステップ") || content.includes("計画")) {
        setPhase("planning");
        setShowPlanningHelper(true);
      }

      // コードブロックがあれば抽出
      const codeBlock = extractCodeBlock(content);
      if (codeBlock) {
        setGeneratedCode(codeBlock);
      }
    }

    if (state.phase === "coding" || state.phase === "unlocking") {
      // クイズを抽出
      const quiz = extractQuizFromResponse(content, state.unlockLevel);
      if (quiz) {
        setCurrentQuiz(quiz);
      }
    }
  }, [messages, state.phase, state.unlockLevel, setPhase, setGeneratedCode, setCurrentQuiz]);

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

  // クイズに回答
  const handleQuizAnswer = useCallback(
    (answer: string) => {
      const isCorrect = answerQuiz(answer);

      // 回答をチャットに送信
      const answerText = isCorrect
        ? `${answer}を選択しました。正解です！`
        : `${answer}を選択しました。`;

      onSendMessage(answerText);
    },
    [answerQuiz, onSendMessage]
  );

  // スキップ
  const handleSkip = useCallback(() => {
    skipToUnlock();
    onSendMessage("アンロックをスキップしました。");
  }, [skipToUnlock, onSendMessage]);

  // アンロック開始
  const handleStartUnlock = useCallback(() => {
    onSendMessage("コードを理解するためのクイズを始めます。");
  }, [onSendMessage]);

  const modeConfig = MODE_CONFIG.generation;
  const iconSize = MODE_ICON_SIZES.header;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Header */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-4xl px-4 py-3">
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

            {/* 生成されたコード（ぼかし表示） */}
            {state.generatedCode && (
              <div className="px-4 py-4">
                <BlurredCode
                  code={state.generatedCode.code}
                  language={state.generatedCode.language}
                  filename={state.generatedCode.filename}
                  unlockLevel={state.unlockLevel}
                  progressPercentage={progressPercentage}
                  canCopy={canCopyCode}
                  onUnlockClick={handleStartUnlock}
                />
              </div>
            )}

            {/* クイズ */}
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
            生成されたコードは最初ぼかされています
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
