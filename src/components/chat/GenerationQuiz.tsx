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

    // 正解の場合は少し待ってから次へ
    if (label === quiz.correctLabel) {
      setTimeout(() => {
        onAnswer(label);
      }, 1500);
    }
  };

  const handleRetry = () => {
    setSelectedOption(null);
    setShowResult(false);
    setIsCorrect(false);
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
                  <>
                    <p className="font-medium text-green-400 mb-1">正解です</p>
                    <p className="text-sm text-foreground/80">
                      次のレベルにアンロックします...
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-red-400 mb-1">もう一度考えてみましょう</p>
                    <p className="text-sm text-foreground/80">
                      ヒントを参考に、正解を見つけてください。
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ヒント */}
        {hintVisible && quiz.hint && !isCorrect && (
          <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-400 text-xl">lightbulb</span>
              <div>
                <p className="font-medium text-blue-400 mb-1">ヒント</p>
                <p className="text-sm text-foreground/80">{quiz.hint}</p>
              </div>
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="mt-4 flex items-center gap-3">
          {showResult && !isCorrect && (
            <Button
              onClick={handleRetry}
              variant="outline"
              className="flex-1"
            >
              <span className="material-symbols-outlined text-lg mr-2">refresh</span>
              もう一度挑戦
            </Button>
          )}

          {canSkip && (
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

// クイズの質問テンプレート（レベルごと）
export const QUIZ_TEMPLATES: Record<UnlockLevel, { questions: string[] }> = {
  1: {
    questions: [
      "このコードの主な目的は何ですか？",
      "このコードは何を達成しようとしていますか？",
      "この実装の目標は何ですか？",
    ],
  },
  2: {
    questions: [
      "このコードで使われているデザインパターンは何ですか？",
      "この実装で採用されているアプローチは何ですか？",
      "このコードの構造はどのパターンに基づいていますか？",
    ],
  },
  3: {
    questions: [
      "なぜこの書き方が選ばれたのでしょうか？",
      "別のアプローチではなく、この方法を選んだ理由は何ですか？",
      "この実装の利点は何ですか？",
    ],
  },
  4: {
    questions: [], // レベル4はクイズ不要
  },
};
