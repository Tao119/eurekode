"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UnlockLevel, UnlockQuiz } from "@/hooks/useGenerationMode";
import { LEVEL_LABELS } from "@/hooks/useGenerationMode";

interface GenerationQuizProps {
  quiz: UnlockQuiz;
  onAnswer: (answer: string) => void;
  hintVisible: boolean;
  onSkip?: () => void;
  canSkip?: boolean;
}

export function GenerationQuiz({
  quiz,
  onAnswer,
  hintVisible,
  onSkip,
  canSkip = false,
}: GenerationQuizProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hintCountdown, setHintCountdown] = useState(30);

  // ヒントカウントダウン
  useEffect(() => {
    if (hintVisible || hintCountdown <= 0) return;

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
  }, [hintVisible, hintCountdown]);

  const handleSelect = (label: string) => {
    if (showResult) return;

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

  const levelInfo = LEVEL_LABELS[quiz.level];

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-b from-yellow-500/5 to-orange-500/5 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-400">quiz</span>
            </div>
            <div>
              <span className="text-sm font-medium text-foreground/90">
                アンロッククイズ - {levelInfo.title}
              </span>
              <p className="text-xs text-muted-foreground">{levelInfo.description}</p>
            </div>
          </div>

          {/* ヒントタイマー（円形プログレス付き） */}
          {!hintVisible && quiz.hint && hintCountdown > 0 && (
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
          {hintVisible && quiz.hint && (
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
          <div className="mb-4 rounded-lg overflow-hidden border border-yellow-500/30 bg-zinc-900">
            <div className="px-3 py-1.5 bg-zinc-800 border-b border-yellow-500/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-400 text-sm">code</span>
              <span className="text-xs text-yellow-400 font-medium">このコードについて考えてみましょう</span>
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
            const isSelected = selectedOption === option.label;
            const isCorrectAnswer = option.label === quiz.correctLabel;
            const showCorrect = showResult && isCorrectAnswer;
            const showIncorrect = showResult && isSelected && !isCorrect;

            return (
              <button
                key={option.label}
                onClick={() => handleSelect(option.label)}
                disabled={showResult}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-2 transition-all group",
                  !showResult && "hover:border-yellow-500/50 hover:bg-yellow-500/5",
                  !showResult && !isSelected && "border-border bg-card",
                  showCorrect && "border-green-500 bg-green-500/10",
                  showIncorrect && "border-red-500 bg-red-500/10",
                  showResult && !isSelected && !isCorrectAnswer && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* ラベル */}
                  <span
                    className={cn(
                      "flex-shrink-0 size-8 rounded-full font-bold flex items-center justify-center text-sm transition-colors",
                      !showResult && "bg-muted text-foreground group-hover:bg-yellow-500 group-hover:text-white",
                      showCorrect && "bg-green-500 text-white",
                      showIncorrect && "bg-red-500 text-white"
                    )}
                  >
                    {showCorrect && (
                      <span className="material-symbols-outlined text-lg">check</span>
                    )}
                    {showIncorrect && (
                      <span className="material-symbols-outlined text-lg">close</span>
                    )}
                    {!showResult && option.label}
                  </span>

                  {/* テキスト */}
                  <span
                    className={cn(
                      "flex-1 text-foreground/90",
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

        {/* 結果表示 */}
        {showResult && (
          <div className={cn(
            "mt-4 p-4 rounded-lg",
            isCorrect ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
          )}>
            <div className="flex items-start gap-3">
              <span className={cn(
                "material-symbols-outlined text-2xl",
                isCorrect ? "text-green-400" : "text-red-400"
              )}>
                {isCorrect ? "celebration" : "sentiment_dissatisfied"}
              </span>
              <div className="flex-1">
                {isCorrect ? (
                  <p className="font-medium text-green-400 mb-1">正解です</p>
                ) : (
                  <p className="font-medium text-red-400 mb-1">不正解です</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 解説（正解・不正解どちらでも表示） */}
        {showResult && (
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

            {/* あなたの回答（不正解の場合） */}
            {!isCorrect && selectedOption && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-red-400 text-base">info</span>
                  <span className="text-foreground/70">
                    あなたの回答: <span className="font-medium text-red-400">{selectedOption}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ヒント（回答前のみ表示） */}
        {!showResult && hintVisible && quiz.hint && (
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

        {/* アクションボタン */}
        <div className="mt-4 flex items-center gap-3">
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
      </div>
    </div>
  );
}

// Note: Quiz templates have been removed.
// All quizzes should now be generated by AI using specific "なぜ？" format questions
// based on actual code content, with codeSnippet references.
// Fallback quiz generation is handled in quiz-generator.ts with code-specific questions.
