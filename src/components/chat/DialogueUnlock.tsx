"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLevelLabel } from "@/hooks/useGenerationMode";

interface DialogueQuestion {
  question: string;
  codeSnippet?: string;
  codeLanguage?: string;
}

interface DialogueUnlockProps {
  question: DialogueQuestion;
  unlockLevel: number;
  totalQuestions: number;
  onAnswer: (answer: string) => Promise<{ isCorrect: boolean; feedback: string }>;
  onRequestHint?: () => void;
  disabled?: boolean;
}

export function DialogueUnlock({
  question,
  unlockLevel,
  totalQuestions,
  onAnswer,
  onRequestHint,
  disabled = false,
}: DialogueUnlockProps) {
  const [userAnswer, setUserAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [showHint, setShowHint] = useState(false);

  const levelInfo = getLevelLabel(unlockLevel, totalQuestions);

  const handleSubmit = useCallback(async () => {
    if (!userAnswer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await onAnswer(userAnswer);
      setFeedback({ isCorrect: result.isCorrect, message: result.feedback });
      if (result.isCorrect) {
        // Clear answer after success
        setTimeout(() => {
          setUserAnswer("");
          setFeedback(null);
        }, 2000);
      }
    } catch (error) {
      setFeedback({ isCorrect: false, message: "回答の評価に失敗しました。もう一度お試しください。" });
    } finally {
      setIsSubmitting(false);
    }
  }, [userAnswer, isSubmitting, onAnswer]);

  const handleHint = useCallback(() => {
    setShowHint(true);
    onRequestHint?.();
  }, [onRequestHint]);

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-yellow-400">chat</span>
          </div>
          <div>
            <span className="text-sm font-medium text-foreground/90">
              理解度チェック - {levelInfo.title}
            </span>
            <p className="text-xs text-muted-foreground">
              {levelInfo.description}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleHint}
          disabled={showHint}
          className="text-yellow-400 hover:text-yellow-300"
        >
          <span className="material-symbols-outlined text-sm mr-1">lightbulb</span>
          ヒント
        </Button>
      </div>

      {/* 質問 */}
      <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border">
        <p className="text-sm text-foreground/90">{question.question}</p>
      </div>

      {/* コードスニペット */}
      {question.codeSnippet && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-sm text-muted-foreground">code</span>
            <span className="text-xs text-muted-foreground">このコードについて考えてみましょう</span>
            {question.codeLanguage && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {question.codeLanguage}
              </span>
            )}
          </div>
          <pre className="p-3 rounded-lg bg-[#1e1e1e] text-sm font-mono text-foreground/90 overflow-x-auto">
            <code>{question.codeSnippet}</code>
          </pre>
        </div>
      )}

      {/* ヒント表示 */}
      {showHint && (
        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-sm text-blue-400">lightbulb</span>
            <span className="text-xs font-medium text-blue-400">ヒント</span>
          </div>
          <p className="text-sm text-foreground/80">
            コードの「なぜ」に着目してください。この実装方法を選んだ理由や、
            この処理が必要な背景について考えてみましょう。
          </p>
        </div>
      )}

      {/* 回答入力 */}
      <div className="mb-4">
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="あなたの考えを自由に書いてください..."
          disabled={disabled || isSubmitting}
          className={cn(
            "w-full min-h-[100px] p-3 rounded-lg border bg-background text-sm resize-none",
            "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      </div>

      {/* フィードバック */}
      {feedback && (
        <div className={cn(
          "mb-4 p-3 rounded-lg border",
          feedback.isCorrect
            ? "bg-green-500/10 border-green-500/30"
            : "bg-orange-500/10 border-orange-500/30"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "material-symbols-outlined text-sm",
              feedback.isCorrect ? "text-green-400" : "text-orange-400"
            )}>
              {feedback.isCorrect ? "check_circle" : "info"}
            </span>
            <span className={cn(
              "text-xs font-medium",
              feedback.isCorrect ? "text-green-400" : "text-orange-400"
            )}>
              {feedback.isCorrect ? "理解できています！" : "もう少し考えてみましょう"}
            </span>
          </div>
          <p className="text-sm text-foreground/80">{feedback.message}</p>
        </div>
      )}

      {/* 送信ボタン */}
      <Button
        onClick={handleSubmit}
        disabled={disabled || isSubmitting || !userAnswer.trim()}
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
      >
        {isSubmitting ? (
          <>
            <span className="material-symbols-outlined text-sm mr-2 animate-spin">refresh</span>
            評価中...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-sm mr-2">send</span>
            回答を送信
          </>
        )}
      </Button>
    </div>
  );
}
