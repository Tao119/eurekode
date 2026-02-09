"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { cn } from "@/lib/utils";

interface ExplanationCodePanelProps {
  /** 表示するコード */
  code: string;
  /** プログラミング言語 */
  language: string;
  /** ファイル名 */
  filename?: string;
  /** ハイライト中の行番号 */
  highlightedLines: number[];
  /** 前回ハイライトした行（フェード効果用） */
  previousHighlightedLines?: number[];
  /** ブックマークした行 */
  bookmarks: number[];
  /** 解説済みの範囲 */
  explainedRanges?: Array<{ start: number; end: number }>;
  /** 行クリック時のコールバック */
  onLineClick: (lineNumber: number) => void;
  /** ブックマーク切り替え */
  onBookmarkToggle: (lineNumber: number) => void;
  /** パネルを閉じる */
  onClose?: () => void;
  /** スクロール先の行 */
  scrollToLine?: number | null;
  /** スクロール完了時のコールバック */
  onScrollComplete?: () => void;
}

// 言語表示名のマッピング
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  bash: "Bash",
  shell: "Shell",
  sql: "SQL",
  tsx: "TSX",
  jsx: "JSX",
  go: "Go",
  rust: "Rust",
  cpp: "C++",
  c: "C",
  csharp: "C#",
  php: "PHP",
  ruby: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  text: "Text",
};

export function ExplanationCodePanel({
  code,
  language,
  filename,
  highlightedLines,
  previousHighlightedLines = [],
  bookmarks,
  explainedRanges = [],
  onLineClick,
  onBookmarkToggle,
  onClose,
  scrollToLine,
  onScrollComplete,
}: ExplanationCodePanelProps) {
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // 総行数
  const totalLines = useMemo(() => code.split("\n").length, [code]);

  // 解説済みの行をセットに変換
  const explainedLinesSet = useMemo(() => {
    const lines = new Set<number>();
    for (const range of explainedRanges) {
      for (let i = range.start; i <= Math.min(range.end, totalLines); i++) {
        lines.add(i);
      }
    }
    return lines;
  }, [explainedRanges, totalLines]);

  // 解説進捗を計算
  const explanationProgress = useMemo(() => {
    if (totalLines === 0) return 0;
    return Math.round((explainedLinesSet.size / totalLines) * 100);
  }, [explainedLinesSet.size, totalLines]);

  // 言語表示名
  const displayLanguage = LANGUAGE_DISPLAY_NAMES[language.toLowerCase()] || language;

  // スクロール処理
  useEffect(() => {
    if (scrollToLine && codeContainerRef.current) {
      const lineElement = codeContainerRef.current.querySelector(
        `[data-line-number="${scrollToLine}"]`
      );
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
        onScrollComplete?.();
      }
    }
  }, [scrollToLine, onScrollComplete]);

  // コピー機能
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // フォールバック
      const textArea = document.createElement("textarea");
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  // 行のスタイルを決定
  const getLineStyle = useCallback((lineNumber: number) => {
    const isHighlighted = highlightedLines.includes(lineNumber);
    const wasPreviouslyHighlighted = previousHighlightedLines.includes(lineNumber);
    const isBookmarked = bookmarks.includes(lineNumber);
    const isExplained = explainedLinesSet.has(lineNumber);
    const isHovered = hoveredLine === lineNumber;

    return {
      isHighlighted,
      wasPreviouslyHighlighted,
      isBookmarked,
      isExplained,
      isHovered,
    };
  }, [highlightedLines, previousHighlightedLines, bookmarks, explainedLinesSet, hoveredLine]);

  // ミニマップのセグメントを生成
  const minimapSegments = useMemo(() => {
    if (totalLines === 0) return [];

    const segmentSize = Math.max(1, Math.ceil(totalLines / 50)); // 最大50セグメント
    const segments: Array<{
      startLine: number;
      endLine: number;
      hasHighlight: boolean;
      hasBookmark: boolean;
      explained: boolean;
    }> = [];

    for (let i = 0; i < totalLines; i += segmentSize) {
      const startLine = i + 1;
      const endLine = Math.min(i + segmentSize, totalLines);

      let hasHighlight = false;
      let hasBookmark = false;
      let explained = true;

      for (let j = startLine; j <= endLine; j++) {
        if (highlightedLines.includes(j)) hasHighlight = true;
        if (bookmarks.includes(j)) hasBookmark = true;
        if (!explainedLinesSet.has(j)) explained = false;
      }

      segments.push({ startLine, endLine, hasHighlight, hasBookmark, explained });
    }

    return segments;
  }, [totalLines, highlightedLines, bookmarks, explainedLinesSet]);

  // コード行をレンダリング
  const lines = code.split("\n");

  return (
    <div className="hidden md:flex w-1/2 border-l border-border bg-zinc-950 flex-col min-h-0">
      {/* ヘッダー */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">code</span>
            <span className="font-medium">解説中のコード</span>
          </div>

          {/* ファイル名と言語 */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            {filename && (
              <>
                <span className="text-zinc-300">{filename}</span>
                <span>•</span>
              </>
            )}
            <span>{displayLanguage}</span>
            <span>•</span>
            <span>{totalLines}行</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 進捗表示 */}
          {explanationProgress > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${explanationProgress}%` }}
                />
              </div>
              <span className="text-green-400">{explanationProgress}%</span>
            </div>
          )}

          {/* コピーボタン */}
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all",
              copied
                ? "bg-green-500/20 text-green-400"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            )}
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? "check" : "content_copy"}
            </span>
            <span>{copied ? "コピー済" : "コピー"}</span>
          </button>

          {/* 閉じるボタン */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <span className="material-symbols-outlined text-base text-zinc-400">close</span>
            </button>
          )}
        </div>
      </div>

      {/* メインコンテンツ（コードとミニマップ） */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* コードエリア */}
        <div
          ref={codeContainerRef}
          className="flex-1 overflow-auto"
        >
          <div className="min-w-fit">
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              const styles = getLineStyle(lineNumber);

              return (
                <div
                  key={lineNumber}
                  data-line-number={lineNumber}
                  className={cn(
                    "flex items-stretch font-mono text-sm leading-6 transition-all duration-200",
                    styles.isHighlighted && "bg-yellow-500/20 border-l-2 border-yellow-400",
                    styles.wasPreviouslyHighlighted && !styles.isHighlighted && "bg-yellow-500/5",
                    styles.isBookmarked && !styles.isHighlighted && "bg-amber-500/10",
                    styles.isExplained && !styles.isHighlighted && !styles.isBookmarked && "bg-green-500/5",
                    styles.isHovered && !styles.isHighlighted && "bg-blue-500/10",
                    "hover:bg-blue-500/10 cursor-pointer"
                  )}
                  onMouseEnter={() => setHoveredLine(lineNumber)}
                  onMouseLeave={() => setHoveredLine(null)}
                  onClick={() => onLineClick(lineNumber)}
                >
                  {/* 行番号 */}
                  <div className="w-12 flex-shrink-0 flex items-center justify-end pr-3 select-none">
                    <span
                      className={cn(
                        "text-xs transition-colors",
                        styles.isHighlighted ? "text-yellow-400 font-medium" : "text-zinc-600"
                      )}
                    >
                      {lineNumber}
                    </span>
                  </div>

                  {/* ブックマークインジケーター */}
                  <div className="w-6 flex-shrink-0 flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookmarkToggle(lineNumber);
                      }}
                      className={cn(
                        "p-0.5 rounded transition-all",
                        styles.isBookmarked
                          ? "text-amber-400 opacity-100"
                          : styles.isHovered
                            ? "text-zinc-500 opacity-50 hover:opacity-100"
                            : "opacity-0"
                      )}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {styles.isBookmarked ? "bookmark" : "bookmark_border"}
                      </span>
                    </button>
                  </div>

                  {/* コード行 */}
                  <div className="flex-1 pr-4 overflow-x-auto">
                    <SyntaxHighlighter
                      language={language}
                      style={oneDark}
                      customStyle={{
                        margin: 0,
                        padding: 0,
                        background: "transparent",
                        fontSize: "inherit",
                        lineHeight: "inherit",
                      }}
                      codeTagProps={{
                        style: {
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        },
                      }}
                      PreTag="span"
                    >
                      {line || " "}
                    </SyntaxHighlighter>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ミニマップ */}
        <div className="w-8 flex-shrink-0 border-l border-zinc-800 bg-zinc-900/50 py-2 px-1">
          <div className="h-full flex flex-col gap-px">
            {minimapSegments.map((segment, index) => (
              <button
                key={index}
                onClick={() => {
                  const lineElement = codeContainerRef.current?.querySelector(
                    `[data-line-number="${segment.startLine}"]`
                  );
                  lineElement?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "flex-1 min-h-[2px] rounded-sm transition-colors",
                  segment.hasHighlight
                    ? "bg-yellow-400"
                    : segment.hasBookmark
                      ? "bg-amber-500"
                      : segment.explained
                        ? "bg-green-600/50"
                        : "bg-zinc-700/50",
                  "hover:brightness-125"
                )}
                title={`行 ${segment.startLine}${segment.startLine !== segment.endLine ? `-${segment.endLine}` : ""}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* フッター（ヒント） */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-yellow-400">lightbulb</span>
              <span>行をクリックで質問</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-amber-400">bookmark</span>
              <span>ブックマーク: {bookmarks.length}</span>
            </div>
          </div>

          {/* 凡例 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded bg-yellow-400" />
              <span>解説中</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded bg-green-500/50" />
              <span>解説済</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * モバイル用のコードシート
 */
interface MobileCodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
  filename?: string;
  highlightedLines: number[];
  bookmarks: number[];
  onLineClick: (lineNumber: number) => void;
  onBookmarkToggle: (lineNumber: number) => void;
}

export function MobileExplanationCodeSheet({
  isOpen,
  onClose,
  code,
  language,
  filename,
  highlightedLines,
  bookmarks,
  onLineClick,
  onBookmarkToggle,
}: MobileCodeSheetProps) {
  const [copied, setCopied] = useState(false);

  const displayLanguage = LANGUAGE_DISPLAY_NAMES[language.toLowerCase()] || language;
  const totalLines = code.split("\n").length;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [code]);

  if (!isOpen) return null;

  return (
    <>
      {/* バックドロップ */}
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ボトムシート */}
      <div
        className={cn(
          "md:hidden fixed inset-x-0 bottom-0 z-50",
          "bg-zinc-950 rounded-t-2xl border-t border-zinc-800",
          "max-h-[85vh] flex flex-col",
          "animate-in slide-in-from-bottom duration-300"
        )}
      >
        {/* ハンドル */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-zinc-700" />
        </div>

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">code</span>
            <span className="font-medium">解説中のコード</span>
            <span className="text-xs text-zinc-500">{displayLanguage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={cn(
                "p-2 rounded-lg transition-colors",
                copied ? "bg-green-500/20 text-green-400" : "hover:bg-zinc-800 text-zinc-400"
              )}
            >
              <span className="material-symbols-outlined text-base">
                {copied ? "check" : "content_copy"}
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* コード */}
        <div className="flex-1 overflow-auto p-4">
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            showLineNumbers
            customStyle={{
              margin: 0,
              padding: "1rem",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              lineHeight: "1.5",
            }}
            lineProps={(lineNumber) => ({
              onClick: () => onLineClick(lineNumber),
              className: cn(
                "cursor-pointer hover:bg-blue-500/10 transition-colors",
                highlightedLines.includes(lineNumber) && "bg-yellow-500/20 border-l-2 border-yellow-400",
                bookmarks.includes(lineNumber) && "bg-amber-500/10"
              ),
            })}
            wrapLines
          >
            {code}
          </SyntaxHighlighter>
        </div>

        {/* フッター */}
        <div className="shrink-0 px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{totalLines}行</span>
            <span>行をタップで質問</span>
          </div>
        </div>
      </div>
    </>
  );
}
