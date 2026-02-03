"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface LockedCodeBlockProps {
  code: string;
  language: string;
  onUnlock?: () => void;
}

type UnlockLevel = 0 | 1 | 2 | 3 | 4; // 0 = locked, 4 = fully unlocked

export function LockedCodeBlock({ code, language, onUnlock }: LockedCodeBlockProps) {
  const [unlockLevel, setUnlockLevel] = useState<UnlockLevel>(0);
  const [showQuiz, setShowQuiz] = useState(false);

  const isFullyUnlocked = unlockLevel >= 4;
  const progressPercent = (unlockLevel / 4) * 100;

  const handleStartUnlock = () => {
    setShowQuiz(true);
  };

  const handleQuizComplete = () => {
    const nextLevel = Math.min(unlockLevel + 1, 4) as UnlockLevel;
    setUnlockLevel(nextLevel);
    if (nextLevel >= 4) {
      setShowQuiz(false);
      onUnlock?.();
    }
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base">code</span>
          <span className="text-sm font-mono">{language}</span>
        </div>
        {isFullyUnlocked && (
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigator.clipboard.writeText(code)}
          >
            <span className="material-symbols-outlined text-sm">content_copy</span>
            <span>コピー</span>
          </button>
        )}
      </div>

      {/* Code Area */}
      <div className="relative">
        {isFullyUnlocked ? (
          // Fully unlocked - show code
          <SyntaxHighlighter
            style={oneDark}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: "1rem",
              borderRadius: 0,
              fontSize: "0.875rem",
              lineHeight: "1.5",
            }}
            codeTagProps={{
              style: {
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              },
            }}
          >
            {code}
          </SyntaxHighlighter>
        ) : (
          // Locked state
          <div className="bg-zinc-900 p-4">
            {/* Blurred code preview */}
            <div className="relative">
              <pre
                className={cn(
                  "text-sm font-mono text-zinc-400 overflow-hidden",
                  "blur-sm select-none pointer-events-none",
                  "max-h-[200px]"
                )}
              >
                <code>{code}</code>
              </pre>

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/60 via-zinc-900/80 to-zinc-900 flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                  <span className="material-symbols-outlined text-2xl">lock</span>
                  <span className="text-lg font-medium">理解してアンロック</span>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-zinc-500">レベル{unlockLevel}</span>
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        "size-2 rounded-full",
                        level <= unlockLevel ? "bg-primary" : "bg-zinc-700"
                      )}
                    />
                  ))}
                  <span className="text-sm text-zinc-500">{progressPercent}%</span>
                </div>

                {!showQuiz ? (
                  <button
                    onClick={handleStartUnlock}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <span className="material-symbols-outlined">lock_open</span>
                    <span>アンロックを開始</span>
                  </button>
                ) : (
                  <QuizPanel
                    level={unlockLevel + 1}
                    onComplete={handleQuizComplete}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - unlock progress */}
      {!isFullyUnlocked && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="material-symbols-outlined text-sm">quiz</span>
            <span>コードを理解するための質問に答えてアンロックしましょう</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple quiz panel for unlocking
function QuizPanel({
  level,
  onComplete,
}: {
  level: number;
  onComplete: () => void;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const levelQuestions: Record<number, { question: string; options: string[]; correct: number }> = {
    1: {
      question: "このコードの主な目的は何ですか？",
      options: [
        "データの処理と変換",
        "UIの表示とインタラクション",
        "ネットワーク通信",
        "ファイル操作",
      ],
      correct: 0,
    },
    2: {
      question: "このコードで使われているパターンは？",
      options: [
        "関数型プログラミング",
        "オブジェクト指向",
        "イベント駆動",
        "手続き型",
      ],
      correct: 0,
    },
    3: {
      question: "このコードの改善点として適切なのは？",
      options: [
        "エラーハンドリングの追加",
        "変数名の変更",
        "コメントの追加",
        "改善不要",
      ],
      correct: 0,
    },
    4: {
      question: "このコードを理解できましたか？",
      options: [
        "はい、理解できました",
        "だいたい理解できました",
        "もう少し説明が必要です",
      ],
      correct: 0,
    },
  };

  const currentQuestion = levelQuestions[level] || levelQuestions[1];

  const handleSelect = (index: number) => {
    setSelectedOption(currentQuestion.options[index]);
    // For simplicity, accept any answer for now
    setIsCorrect(true);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div className="w-full max-w-md p-4 bg-card/90 rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center size-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
          L{level}
        </span>
        <span className="text-sm font-medium">コードの目的を理解する</span>
      </div>

      <p className="text-sm mb-3">{currentQuestion.question}</p>

      <div className="space-y-2">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index)}
            disabled={selectedOption !== null}
            className={cn(
              "w-full text-left p-2 rounded-md border text-sm transition-all",
              selectedOption === option
                ? isCorrect
                  ? "border-green-500 bg-green-500/20 text-green-400"
                  : "border-red-500 bg-red-500/20 text-red-400"
                : "border-border bg-card hover:border-primary/50"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
