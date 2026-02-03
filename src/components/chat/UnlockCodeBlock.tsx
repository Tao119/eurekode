"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { CodeBlockData, UnlockProgress, UnlockChallenge } from "@/types/chat";

interface UnlockCodeBlockProps {
  code: CodeBlockData;
  progress?: UnlockProgress;
  onChallengeAnswer?: (level: number, answer: string | number) => void;
  onCopyCode?: () => void;
}

export function UnlockCodeBlock({
  code,
  progress,
  onChallengeAnswer,
  onCopyCode,
}: UnlockCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const blurLevel = code.blurLevel ?? (progress ? 4 - progress.currentLevel : 0);
  const isFullyUnlocked = progress?.isFullyUnlocked ?? blurLevel === 0;
  const currentChallenge = progress?.challenges.find((c) => !c.completed);

  // Calculate blur amount based on level
  const blurAmount = useMemo(() => {
    const blurMap: Record<number, number> = {
      0: 0,    // 完全表示
      1: 2,    // 軽いぼかし
      2: 4,    // 中程度
      3: 8,    // 強め
      4: 12,   // 最大
    };
    return blurMap[blurLevel] ?? 0;
  }, [blurLevel]);

  const handleCopy = async () => {
    if (!isFullyUnlocked) return;

    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      onCopyCode?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-muted-foreground text-lg">
            code
          </span>
          <span className="text-sm font-mono text-muted-foreground">
            {code.filename || code.language}
          </span>
          {progress && (
            <UnlockProgressBadge progress={progress} />
          )}
        </div>

        <div className="flex items-center gap-2">
          {isFullyUnlocked ? (
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                copied
                  ? "text-green-400 bg-green-500/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="material-symbols-outlined text-sm">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "コピーしました" : "コピー"}
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-400 bg-amber-500/10">
              <span className="material-symbols-outlined text-sm">lock</span>
              ロック中
            </span>
          )}
        </div>
      </div>

      {/* Code Area */}
      <div className="relative">
        {/* Blur Overlay */}
        {blurAmount > 0 && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/50"
            style={{ backdropFilter: `blur(${blurAmount}px)` }}
          >
            <div className="text-center p-6 max-w-md">
              <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-primary text-2xl">
                  lock
                </span>
              </div>
              <h3 className="font-bold text-lg mb-2">コードがロックされています</h3>
              <p className="text-sm text-muted-foreground mb-4">
                質問に答えてコードをアンロックしましょう
              </p>

              {currentChallenge && (
                <ChallengeCard
                  challenge={currentChallenge}
                  onAnswer={(answer) => onChallengeAnswer?.(currentChallenge.level, answer)}
                />
              )}
            </div>
          </div>
        )}

        {/* Code Display */}
        <SyntaxHighlighter
          style={oneDark}
          language={code.language}
          PreTag="div"
          showLineNumbers={code.lineNumbers ?? true}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.875rem",
            lineHeight: "1.6",
            background: "transparent",
          }}
          codeTagProps={{
            style: {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
          }}
          wrapLines={true}
          lineProps={(lineNumber) => {
            const isHighlighted = code.highlightedLines?.includes(lineNumber);
            return {
              style: {
                backgroundColor: isHighlighted ? "rgba(255, 255, 0, 0.1)" : undefined,
                display: "block",
              },
            };
          }}
        >
          {code.code}
        </SyntaxHighlighter>
      </div>

      {/* Unlock Success Message */}
      {isFullyUnlocked && progress && (
        <div className="px-4 py-3 bg-green-500/10 border-t border-green-500/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-green-400">
              check_circle
            </span>
            <span className="text-sm font-medium text-green-400">
              コードがアンロックされました！
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              コピーして使用できます
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function UnlockProgressBadge({ progress }: { progress: UnlockProgress }) {
  const percentage = (progress.currentLevel / progress.maxLevel) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {progress.currentLevel}/{progress.maxLevel}
      </span>
    </div>
  );
}

interface ChallengeCardProps {
  challenge: UnlockChallenge;
  onAnswer: (answer: string | number) => void;
}

function ChallengeCard({ challenge, onAnswer }: ChallengeCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  if (challenge.type === "quiz" && challenge.quizData) {
    return (
      <div className="text-left">
        <p className="font-medium mb-3">{challenge.question}</p>
        <div className="space-y-2">
          {challenge.quizData.options.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setSelectedOption(option.id);
                onAnswer(option.id);
              }}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all text-sm",
                selectedOption === option.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <span className="flex items-center gap-2">
                <span className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  {String.fromCharCode(65 + option.id)}
                </span>
                {option.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (challenge.type === "explanation" && challenge.explanationPoints) {
    return (
      <div className="text-left">
        <p className="font-medium mb-3">{challenge.question}</p>
        <ul className="space-y-2 mb-4">
          {challenge.explanationPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="material-symbols-outlined text-primary text-sm mt-0.5">
                check_circle
              </span>
              {point}
            </li>
          ))}
        </ul>
        <button
          onClick={() => onAnswer("understood")}
          className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          理解しました
        </button>
      </div>
    );
  }

  if (challenge.type === "acknowledgment") {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          {challenge.acknowledgmentText ?? "続けてコードを確認しますか？"}
        </p>
        <button
          onClick={() => onAnswer("acknowledged")}
          className="py-2 px-6 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          続ける
        </button>
      </div>
    );
  }

  return null;
}
