"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { QuizData, QuizOption } from "@/types/chat";

interface QuizCardProps {
  quiz: QuizData;
  onAnswer: (answerId: number, isCorrect: boolean) => void;
  disabled?: boolean;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
}

export function QuizCard({
  quiz,
  onAnswer,
  disabled = false,
  autoAdvance = true,
  autoAdvanceDelay = 1500,
}: QuizCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(
    quiz.userAnswer ?? null
  );
  const [showResult, setShowResult] = useState(quiz.userAnswer !== undefined);
  const [showHint, setShowHint] = useState(false);

  const isAnswered = selectedAnswer !== null;
  const isCorrect = selectedAnswer === quiz.correctAnswer;

  // Handle answer selection
  const handleSelect = useCallback(
    (optionId: number) => {
      if (disabled || isAnswered) return;

      setSelectedAnswer(optionId);
      setShowResult(true);

      const correct = optionId === quiz.correctAnswer;
      onAnswer(optionId, correct);

      // Show hint if wrong and configured
      if (!correct && quiz.showHintOnWrong) {
        const delay = quiz.hintDelay ?? 1000;
        setTimeout(() => setShowHint(true), delay);
      }
    },
    [disabled, isAnswered, quiz.correctAnswer, quiz.showHintOnWrong, quiz.hintDelay, onAnswer]
  );

  // Auto-advance after correct answer
  useEffect(() => {
    if (autoAdvance && showResult && isCorrect) {
      const timer = setTimeout(() => {
        // Auto-advance logic would be handled by parent
      }, autoAdvanceDelay);
      return () => clearTimeout(timer);
    }
  }, [autoAdvance, showResult, isCorrect, autoAdvanceDelay]);

  return (
    <div className="mt-4 p-4 rounded-xl border border-border bg-card/50 backdrop-blur">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center size-8 rounded-lg bg-blue-500/20">
          <span className="material-symbols-outlined text-blue-400 text-lg">
            quiz
          </span>
        </div>
        <span className="font-semibold text-blue-400">理解度チェック</span>
        {showResult && (
          <span
            className={cn(
              "ml-auto px-2 py-0.5 rounded-full text-xs font-bold",
              isCorrect
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            )}
          >
            {isCorrect ? "正解" : "不正解"}
          </span>
        )}
      </div>

      {/* Question */}
      <p className="font-medium text-foreground mb-4 leading-relaxed">
        {quiz.question}
      </p>

      {/* Options */}
      <div className="space-y-2">
        {quiz.options.map((option) => (
          <QuizOptionButton
            key={option.id}
            option={option}
            isSelected={selectedAnswer === option.id}
            isCorrect={option.id === quiz.correctAnswer}
            showResult={showResult}
            disabled={disabled || isAnswered}
            onClick={() => handleSelect(option.id)}
          />
        ))}
      </div>

      {/* Explanation / Hint */}
      {showResult && (
        <div
          className={cn(
            "mt-4 p-3 rounded-lg text-sm",
            isCorrect
              ? "bg-green-500/10 border border-green-500/20"
              : "bg-amber-500/10 border border-amber-500/20"
          )}
        >
          {isCorrect ? (
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-green-400 text-lg flex-shrink-0">
                check_circle
              </span>
              <div>
                <p className="font-medium text-green-400 mb-1">
                  その通りです！
                </p>
                {quiz.explanation && (
                  <p className="text-muted-foreground">{quiz.explanation}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-400 text-lg flex-shrink-0">
                lightbulb
              </span>
              <div>
                <p className="font-medium text-amber-400 mb-1">
                  {showHint ? "ヒント" : "惜しい！"}
                </p>
                {showHint && quiz.explanation ? (
                  <p className="text-muted-foreground">{quiz.explanation}</p>
                ) : (
                  <p className="text-muted-foreground">
                    もう一度考えてみましょう。正解は選択肢の中にあります。
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface QuizOptionButtonProps {
  option: QuizOption;
  isSelected: boolean;
  isCorrect: boolean;
  showResult: boolean;
  disabled: boolean;
  onClick: () => void;
}

function QuizOptionButton({
  option,
  isSelected,
  isCorrect,
  showResult,
  disabled,
  onClick,
}: QuizOptionButtonProps) {
  // Determine styles based on state
  const getStyles = () => {
    if (!showResult) {
      // Before answering
      if (disabled) {
        return "border-border/50 bg-muted/30 cursor-not-allowed opacity-60";
      }
      return "border-border bg-card hover:bg-primary/5 hover:border-primary/50 cursor-pointer";
    }

    // After answering
    if (isSelected && isCorrect) {
      return "border-green-500/50 bg-green-500/10 ring-2 ring-green-500/30";
    }
    if (isSelected && !isCorrect) {
      return "border-red-500/50 bg-red-500/10 ring-2 ring-red-500/30";
    }
    if (isCorrect) {
      return "border-green-500/30 bg-green-500/5";
    }
    return "border-border/50 bg-muted/20 opacity-60";
  };

  const getIconStyles = () => {
    if (!showResult) {
      if (disabled) {
        return "bg-muted text-muted-foreground";
      }
      return "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground";
    }

    if (isSelected && isCorrect) {
      return "bg-green-500 text-white";
    }
    if (isSelected && !isCorrect) {
      return "bg-red-500 text-white";
    }
    if (isCorrect) {
      return "bg-green-500/20 text-green-400";
    }
    return "bg-muted text-muted-foreground";
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || showResult}
      className={cn(
        "group w-full text-left p-3 rounded-lg border transition-all duration-200",
        getStyles()
      )}
    >
      <span className="inline-flex items-center gap-3">
        <span
          className={cn(
            "flex-shrink-0 size-7 rounded-full font-bold flex items-center justify-center text-sm transition-colors",
            getIconStyles()
          )}
        >
          {showResult && isSelected ? (
            isCorrect ? (
              <span className="material-symbols-outlined text-sm">check</span>
            ) : (
              <span className="material-symbols-outlined text-sm">close</span>
            )
          ) : showResult && isCorrect ? (
            <span className="material-symbols-outlined text-sm">check</span>
          ) : (
            String.fromCharCode(65 + option.id) // A, B, C, D
          )}
        </span>
        <span
          className={cn(
            "transition-colors",
            showResult && !isSelected && !isCorrect
              ? "text-muted-foreground"
              : "text-foreground/90"
          )}
        >
          {option.text}
        </span>
        {option.description && (
          <span className="text-xs text-muted-foreground ml-auto">
            {option.description}
          </span>
        )}
      </span>
    </button>
  );
}
