"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UnlockQuiz } from "@/hooks/useGenerationMode";
import { getLevelLabel } from "@/hooks/useGenerationMode";

interface GenerationQuizProps {
  quiz: UnlockQuiz;
  onAnswer: (answer: string) => void;
  hintVisible: boolean;
  onSkip?: () => void;
  canSkip?: boolean;
  /** この問題について質問するコールバック */
  onAskAboutQuestion?: (question: string, options: string[]) => void;
  /** 完了済みクイズとして表示（ユーザーの回答を表示） */
  completedAnswer?: string;
  /** 折りたたみ可能かどうか */
  isCollapsible?: boolean;
  /** 初期状態で折りたたむかどうか */
  defaultCollapsed?: boolean;
}

export function GenerationQuiz({
  quiz,
  onAnswer,
  hintVisible,
  onSkip,
  canSkip = false,
  onAskAboutQuestion,
  completedAnswer,
  isCollapsible = false,
  defaultCollapsed = false,
}: GenerationQuizProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hintCountdown, setHintCountdown] = useState(30);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Reset state when quiz changes (critical fix for auto-answer bug)
  // Without this, state from previous quiz would persist and show incorrect results
  useEffect(() => {
    // Only reset if this is not a completed quiz display
    if (!completedAnswer) {
      setSelectedOption(null);
      setShowResult(false);
      setIsCorrect(false);
      setHintCountdown(30);
    }
  }, [quiz.level, quiz.question, completedAnswer]); // Reset when quiz changes (level + question for uniqueness)

  // 完了済みクイズの場合は初期状態を設定
  const isCompleted = !!completedAnswer;
  const displayAnswer = completedAnswer || selectedOption;
  const displayShowResult = isCompleted || showResult;
  const displayIsCorrect = isCompleted || isCorrect;

  // ヒントカウントダウン（完了済みでない場合のみ）
  useEffect(() => {
    if (isCompleted || hintVisible || hintCountdown <= 0) return;

    const timer = setInterval(() => {
      setHintCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCompleted, hintVisible, hintCountdown]);

  const handleSelect = (label: string) => {
    if (showResult || isCompleted) return;

    setSelectedOption(label);
    setShowResult(true);
    setIsCorrect(label === quiz.correctLabel);
    // 自動で次へ進まず、解説を表示してから「次へ」ボタンで進む
  };

  // 解説を見た後、次へ進む
  const handleNext = () => {
    // 正解の場合のみonAnswerを呼び出す
    if (isCorrect && selectedOption) {
      onAnswer(selectedOption);
    } else {
      // 不正解の場合はリトライ
      setSelectedOption(null);
      setShowResult(false);
      setIsCorrect(false);
    }
  };

  const levelInfo = getLevelLabel(quiz.level, quiz.totalQuestions ?? 3);

  // 折りたたまれた状態のヘッダー
  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="w-full rounded-xl border border-green-500/30 bg-gradient-to-r from-green-500/5 to-emerald-500/5 overflow-hidden hover:bg-green-500/10 transition-colors"
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-400">verified</span>
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-green-400">
                Q{quiz.level + 1}. 正解済み
              </span>
              <p className="text-xs text-muted-foreground line-clamp-1">{quiz.question}</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-muted-foreground">expand_more</span>
        </div>
      </button>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      isCompleted
        ? "border-green-500/30 bg-gradient-to-b from-green-500/5 to-emerald-500/5"
        : "border-yellow-500/30 bg-gradient-to-b from-yellow-500/5 to-orange-500/5"
    )}>
      {/* ヘッダー */}
      <div className={cn(
        "px-4 py-3 border-b",
        isCompleted
          ? "bg-green-500/10 border-green-500/20"
          : "bg-yellow-500/10 border-yellow-500/20"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "size-8 rounded-lg flex items-center justify-center",
              isCompleted ? "bg-green-500/20" : "bg-yellow-500/20"
            )}>
              <span className={cn(
                "material-symbols-outlined",
                isCompleted ? "text-green-400" : "text-yellow-400"
              )}>
                {isCompleted ? "verified" : "quiz"}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-foreground/90">
                {isCompleted ? `Q${quiz.level + 1}. 正解済み` : `アンロッククイズ - ${levelInfo.title}`}
              </span>
              <p className="text-xs text-muted-foreground">
                {isCompleted ? "クリックで詳細を表示" : levelInfo.description}
              </p>
            </div>
          </div>

          {/* 折りたたみボタン（折りたたみ可能な場合のみ） */}
          {(isCollapsible || isCompleted) && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
            >
              <span className="material-symbols-outlined text-muted-foreground">expand_less</span>
            </button>
          )}

          {/* ヒントタイマー（円形プログレス付き）- 完了済みでない場合のみ */}
          {!isCompleted && !hintVisible && quiz.hint && hintCountdown > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative size-10">
                {/* 背景円 */}
                <svg className="size-10 -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    strokeWidth="3"
                    fill="none"
                    className="stroke-muted"
                  />
                  {/* プログレス円 */}
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    strokeWidth="3"
                    fill="none"
                    className="stroke-yellow-500 transition-all duration-1000"
                    strokeDasharray={`${(hintCountdown / 30) * 100.53} 100.53`}
                    strokeLinecap="round"
                  />
                </svg>
                {/* カウント数字 */}
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-yellow-400">
                  {hintCountdown}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="block font-medium text-foreground/80">ヒント</span>
                <span>まであと</span>
              </div>
            </div>
          )}

          {/* ヒント表示済み */}
          {!isCompleted && hintVisible && quiz.hint && (
            <div className="flex items-center gap-1 text-xs text-blue-400">
              <span className="material-symbols-outlined text-sm">lightbulb</span>
              ヒント表示中
            </div>
          )}
        </div>
      </div>

      {/* 質問 */}
      <div className="p-4">
        <p className="text-base font-medium text-foreground mb-4">
          {quiz.question}
        </p>

        {/* コードスニペット（クイズが参照するコード部分を表示） */}
        {quiz.codeSnippet && (
          <div className={cn(
            "mb-4 rounded-lg overflow-hidden border bg-zinc-900",
            isCompleted ? "border-green-500/30" : "border-yellow-500/30"
          )}>
            <div className={cn(
              "px-3 py-1.5 bg-zinc-800 border-b flex items-center gap-2",
              isCompleted ? "border-green-500/20" : "border-yellow-500/20"
            )}>
              <span className={cn(
                "material-symbols-outlined text-sm",
                isCompleted ? "text-green-400" : "text-yellow-400"
              )}>code</span>
              <span className={cn(
                "text-xs font-medium",
                isCompleted ? "text-green-400" : "text-yellow-400"
              )}>
                {isCompleted ? "参照コード" : "このコードについて考えてみましょう"}
              </span>
              {quiz.codeLanguage && (
                <span className="ml-auto text-xs text-zinc-500">{quiz.codeLanguage}</span>
              )}
            </div>
            <pre className="p-3 overflow-x-auto text-sm">
              <code className="text-zinc-100 whitespace-pre-wrap break-words">
                {quiz.codeSnippet}
              </code>
            </pre>
          </div>
        )}

        {/* 選択肢 */}
        <div className="space-y-2">
          {quiz.options.map((option) => {
            const isSelected = displayAnswer === option.label;
            const isCorrectAnswer = option.label === quiz.correctLabel;
            const showCorrect = displayShowResult && isCorrectAnswer;
            const showIncorrect = displayShowResult && isSelected && !displayIsCorrect;

            return (
              <button
                key={option.label}
                onClick={() => handleSelect(option.label)}
                disabled={displayShowResult}
                className={cn(
                  "w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all group",
                  !displayShowResult && "hover:border-yellow-500/50 hover:bg-yellow-500/5",
                  !displayShowResult && !isSelected && "border-border bg-card",
                  showCorrect && "border-green-500 bg-green-500/10",
                  showIncorrect && "border-red-500 bg-red-500/10",
                  displayShowResult && !isSelected && !isCorrectAnswer && "opacity-50"
                )}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  {/* ラベル */}
                  <span
                    className={cn(
                      "flex-shrink-0 size-7 sm:size-8 rounded-full font-bold flex items-center justify-center text-xs sm:text-sm transition-colors mt-0.5",
                      !displayShowResult && "bg-muted text-foreground group-hover:bg-yellow-500 group-hover:text-white",
                      showCorrect && "bg-green-500 text-white",
                      showIncorrect && "bg-red-500 text-white"
                    )}
                  >
                    {showCorrect && (
                      <span className="material-symbols-outlined text-base sm:text-lg">check</span>
                    )}
                    {showIncorrect && (
                      <span className="material-symbols-outlined text-base sm:text-lg">close</span>
                    )}
                    {!displayShowResult && option.label}
                  </span>

                  {/* テキスト */}
                  <span
                    className={cn(
                      "flex-1 min-w-0 break-words text-sm sm:text-base text-foreground/90",
                      showCorrect && "text-green-400 font-medium",
                      showIncorrect && "text-red-400"
                    )}
                  >
                    {option.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 手動入力の案内（回答前のみ表示、完了済みでない場合） */}
        {!isCompleted && !displayShowResult && (
          <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">tips_and_updates</span>
            チャットで自分の考えを入力して回答することもできます
          </p>
        )}

        {/* 結果表示（完了済みの場合は常に正解表示） */}
        {displayShowResult && (
          <div className={cn(
            "mt-4 p-4 rounded-lg",
            displayIsCorrect ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
          )}>
            <div className="flex items-start gap-3">
              <span className={cn(
                "material-symbols-outlined text-2xl",
                displayIsCorrect ? "text-green-400" : "text-red-400"
              )}>
                {displayIsCorrect ? "celebration" : "sentiment_dissatisfied"}
              </span>
              <div className="flex-1">
                {displayIsCorrect ? (
                  <p className="font-medium text-green-400 mb-1">正解です</p>
                ) : (
                  <p className="font-medium text-red-400 mb-1">不正解です</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 解説（正解・不正解どちらでも表示） */}
        {displayShowResult && (
          <div className="mt-4 space-y-3">
            {/* メイン解説 */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-400 text-xl">school</span>
                <div className="flex-1">
                  <p className="font-medium text-blue-400 mb-2">解説</p>

                  {/* 正解の説明 */}
                  {(() => {
                    const correctOption = quiz.options.find(o => o.label === quiz.correctLabel);
                    return (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                          <span className="text-sm font-medium text-green-400">
                            正解: {quiz.correctLabel}) {correctOption?.text}
                          </span>
                        </div>
                        {correctOption?.explanation ? (
                          <p className="text-sm text-foreground/80 ml-6">{correctOption.explanation}</p>
                        ) : quiz.hint ? (
                          <p className="text-sm text-foreground/80 ml-6">{quiz.hint}</p>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* 詳細解説 */}
                  {quiz.detailedExplanation && (
                    <p className="text-sm text-foreground/70 mb-3 p-2 bg-blue-500/5 rounded">
                      {quiz.detailedExplanation}
                    </p>
                  )}

                  {/* 他の選択肢の解説 */}
                  <div className="border-t border-blue-500/20 pt-3 mt-3">
                    <p className="text-xs font-medium text-foreground/60 mb-2">なぜ他の選択肢は不正解なのか:</p>
                    <div className="space-y-2">
                      {quiz.options
                        .filter(option => option.label !== quiz.correctLabel)
                        .map(option => (
                          <div key={option.label} className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-red-400/70 text-sm mt-0.5">close</span>
                            <div className="flex-1">
                              <span className="text-sm text-foreground/70">
                                <span className="font-medium">{option.label})</span> {option.text}
                              </span>
                              {option.explanation && (
                                <p className="text-xs text-foreground/50 mt-0.5">{option.explanation}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* あなたの回答（不正解の場合、完了済みでない場合） */}
            {!displayIsCorrect && displayAnswer && !isCompleted && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-red-400 text-base">info</span>
                  <span className="text-foreground/70">
                    あなたの回答: <span className="font-medium text-red-400">{displayAnswer}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ヒント（回答前のみ表示、完了済みでない場合） */}
        {!isCompleted && !displayShowResult && hintVisible && quiz.hint && (
          <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-yellow-400 text-xl">lightbulb</span>
              <div>
                <p className="font-medium text-yellow-400 mb-1">ヒント</p>
                <p className="text-sm text-foreground/80">{quiz.hint}</p>
              </div>
            </div>
          </div>
        )}

        {/* アクションボタン（完了済みでない場合のみ） */}
        {!isCompleted && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {showResult && (
                <Button
                  onClick={handleNext}
                  className={cn(
                    "flex-1",
                    isCorrect
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-yellow-600 hover:bg-yellow-700 text-white"
                  )}
                >
                  <span className="material-symbols-outlined text-lg mr-2">
                    {isCorrect ? "arrow_forward" : "refresh"}
                  </span>
                  {isCorrect ? "次のレベルへ" : "もう一度挑戦"}
                </Button>
              )}

              {canSkip && !showResult && (
                <Button
                  onClick={onSkip}
                  variant="ghost"
                  className="text-muted-foreground"
                >
                  スキップ
                </Button>
              )}
            </div>

            {/* この問題について質問するボタン（回答前のみ表示） */}
            {!showResult && onAskAboutQuestion && (
              <Button
                onClick={() => {
                  const optionsText = quiz.options.map(o => `${o.label}) ${o.text}`).join("\n");
                  onAskAboutQuestion(quiz.question, quiz.options.map(o => `${o.label}) ${o.text}`));
                }}
                variant="outline"
                className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              >
                <span className="material-symbols-outlined text-lg mr-2">help</span>
                この問題について質問する
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Note: Quiz templates have been removed.
// All quizzes should now be generated by AI using specific "なぜ？" format questions
// based on actual code content, with codeSnippet references.
// Fallback quiz generation is handled in quiz-generator.ts with code-specific questions.
