"use client";

import { useState, useCallback, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UnlockLevel } from "@/hooks/useGenerationMode";
import { LEVEL_LABELS } from "@/hooks/useGenerationMode";

interface BlurredCodeProps {
  code: string;
  language: string;
  filename?: string;
  unlockLevel: UnlockLevel;
  progressPercentage: number;
  canCopy?: boolean;
}

// 行の重要度を分類
type LineImportance = "signature" | "structure" | "logic" | "detail";

interface AnalyzedLine {
  index: number;
  content: string;
  importance: LineImportance;
  visible: boolean;
}

// コードを解析して重要度を判定
function analyzeCode(code: string): AnalyzedLine[] {
  const lines = code.split("\n");

  return lines.map((content, index) => {
    const trimmed = content.trim();

    // シグネチャ（最重要）: 関数/クラス宣言、export、import
    const isSignature =
      /^(export|import|function|class|const\s+\w+\s*=|let\s+\w+\s*=|interface|type\s+\w+\s*=)/.test(trimmed) ||
      /^(async\s+function|export\s+(default\s+)?(function|class|const|async))/.test(trimmed) ||
      /^\}?\s*$/.test(trimmed) && index === lines.length - 1; // 最終行の閉じ括弧

    // 構造（重要）: 条件分岐、ループ、return、try-catch
    const isStructure =
      /^(if|else|for|while|switch|case|try|catch|finally|return|throw|break|continue)[\s({]/.test(trimmed) ||
      /^(}\s*(else|catch|finally))/.test(trimmed) ||
      /^\}/.test(trimmed); // 閉じ括弧

    // ロジック（中程度）: 関数呼び出し、代入
    const isLogic =
      /^(const|let|var)\s+\w+\s*=/.test(trimmed) ||
      /\w+\s*\(.*\)/.test(trimmed) ||
      /await\s+/.test(trimmed);

    // それ以外は詳細
    let importance: LineImportance = "detail";
    if (isSignature) importance = "signature";
    else if (isStructure) importance = "structure";
    else if (isLogic) importance = "logic";

    return {
      index,
      content,
      importance,
      visible: false,
    };
  });
}

// レベルに応じて表示する行を決定
function getVisibleLines(analyzedLines: AnalyzedLine[], level: UnlockLevel): number[] {
  const visibleIndices: number[] = [];

  analyzedLines.forEach((line, index) => {
    let shouldShow = false;

    switch (level) {
      case 1:
        // シグネチャのみ + 空行
        shouldShow = line.importance === "signature" || line.content.trim() === "";
        break;
      case 2:
        // + 構造
        shouldShow = ["signature", "structure"].includes(line.importance) || line.content.trim() === "";
        break;
      case 3:
        // + ロジック
        shouldShow = ["signature", "structure", "logic"].includes(line.importance) || line.content.trim() === "";
        break;
      case 4:
        // 全て表示
        shouldShow = true;
        break;
    }

    if (shouldShow) {
      visibleIndices.push(index);
    }
  });

  return visibleIndices;
}

// レベルごとの説明
const LEVEL_DESCRIPTIONS: Record<UnlockLevel, string> = {
  1: "関数の構造を把握",
  2: "制御フローを理解",
  3: "処理の流れを追う",
  4: "完全に理解",
};

export function BlurredCode({
  code,
  language,
  filename,
  unlockLevel,
  progressPercentage,
  canCopy = false,
}: BlurredCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!canCopy) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code, canCopy]);

  // コードを解析
  const analyzedLines = useMemo(() => analyzeCode(code), [code]);
  const totalLines = analyzedLines.length;

  // 表示する行のインデックス
  const visibleIndices = useMemo(
    () => getVisibleLines(analyzedLines, unlockLevel),
    [analyzedLines, unlockLevel]
  );

  const isLocked = unlockLevel < 4;
  const levelInfo = LEVEL_LABELS[unlockLevel];
  const visibleLineCount = visibleIndices.length;
  const hiddenLineCount = totalLines - visibleLineCount;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-[#1e1e1e]">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-yellow-400">code</span>
          <span className="text-sm font-medium text-foreground/90">
            {filename || language}
          </span>
          <span className="text-xs text-muted-foreground">
            {totalLines} 行
          </span>
          {isLocked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
              <span className="material-symbols-outlined text-sm">visibility</span>
              {LEVEL_DESCRIPTIONS[unlockLevel]}
            </span>
          )}
        </div>

        {/* コピーボタン */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={!canCopy}
          className={cn(
            "h-8 px-3 text-xs",
            canCopy
              ? "text-foreground/70 hover:text-foreground"
              : "text-muted-foreground/50 cursor-not-allowed"
          )}
        >
          <span className="material-symbols-outlined text-sm mr-1">
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "コピーしました" : canCopy ? "コピー" : "アンロック後"}
        </Button>
      </div>

      {/* 進捗バー */}
      <div className="px-4 py-2 bg-[#252526] border-b border-border">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground/80">
              {levelInfo.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {visibleLineCount}/{totalLines} 行表示中
            </span>
          </div>
          <span className="text-xs font-medium text-yellow-400">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* レベルインジケーター */}
        <div className="flex justify-between mt-2">
          {([1, 2, 3, 4] as UnlockLevel[]).map((level) => (
            <div
              key={level}
              className={cn(
                "flex flex-col items-center text-xs",
                level <= unlockLevel ? "text-yellow-400" : "text-muted-foreground/50"
              )}
            >
              <span className="material-symbols-outlined text-sm">
                {level <= unlockLevel ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span className="text-[10px] mt-0.5 hidden sm:block">
                {level === 1 && "構造"}
                {level === 2 && "フロー"}
                {level === 3 && "ロジック"}
                {level === 4 && "全て"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* コード表示エリア */}
      <div className="relative font-mono text-sm">
        <div className="p-4 space-y-0">
          {analyzedLines.map((line, index) => {
            const isVisible = visibleIndices.includes(index);
            const lineNumber = index + 1;

            return (
              <div
                key={index}
                className={cn(
                  "flex transition-all duration-300",
                  !isVisible && "relative"
                )}
              >
                {/* 行番号 */}
                <span
                  className={cn(
                    "w-10 flex-shrink-0 pr-4 text-right select-none",
                    isVisible ? "text-muted-foreground/60" : "text-muted-foreground/30"
                  )}
                >
                  {lineNumber}
                </span>

                {/* コード内容 */}
                {isVisible ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={language}
                    PreTag="span"
                    customStyle={{
                      display: "inline",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: "inherit",
                      },
                    }}
                  >
                    {line.content || " "}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex-1 relative">
                    {/* プレースホルダー（ぼかし） */}
                    <span
                      className="blur-[6px] select-none pointer-events-none text-muted-foreground/40"
                      style={{ userSelect: "none" }}
                    >
                      {line.content.replace(/\S/g, "█") || " "}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* フッター（アンロック完了時） */}
      {canCopy && (
        <div className="px-4 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-t border-border">
          <div className="flex items-center gap-2 text-green-400">
            <span className="material-symbols-outlined">verified</span>
            <span className="text-sm font-medium">
              コードを完全に理解しました
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
