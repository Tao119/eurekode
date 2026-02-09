"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

/**
 * 解説モードのコードパネル状態
 */
export interface ExplanationCodeState {
  /** 表示中のソースコード */
  sourceCode: string | null;
  /** プログラミング言語 */
  language: string;
  /** ファイル名（オプション） */
  filename?: string;
  /** 現在ハイライト中の行番号 */
  highlightedLines: number[];
  /** 前回ハイライトした行（フェード効果用） */
  previousHighlightedLines: number[];
  /** ブックマークした行 */
  bookmarks: number[];
  /** 解説済みの範囲 */
  explainedRanges: Array<{ start: number; end: number }>;
  /** コードの取得元 */
  codeOrigin: "user-paste" | "file-upload" | "ai-response" | null;
  /** スクロール先の行番号 */
  scrollToLine: number | null;
}

export interface ExplanationModeOptions {
  /** 会話ID（永続化用） */
  conversationId?: string;
  /** 初期状態 */
  initialState?: Partial<ExplanationCodeState>;
}

export interface UseExplanationModeReturn {
  /** 現在の状態 */
  state: ExplanationCodeState;
  /** ソースコードを設定 */
  setSourceCode: (code: string, language: string, origin: ExplanationCodeState["codeOrigin"], filename?: string) => void;
  /** ソースコードをクリア */
  clearSourceCode: () => void;
  /** ハイライト行を設定 */
  setHighlightedLines: (lines: number[]) => void;
  /** ハイライトをクリア */
  clearHighlightedLines: () => void;
  /** ブックマークを追加 */
  addBookmark: (line: number) => void;
  /** ブックマークを削除 */
  removeBookmark: (line: number) => void;
  /** ブックマークを切り替え */
  toggleBookmark: (line: number) => void;
  /** セクションを解説済みとしてマーク */
  markSectionExplained: (start: number, end: number) => void;
  /** 解説進捗（パーセント） */
  getExplanationProgress: () => number;
  /** 行について質問するプロンプトを生成 */
  generateLineQuestion: (line: number) => string;
  /** 範囲について質問するプロンプトを生成 */
  generateRangeQuestion: (startLine: number, endLine: number) => string;
  /** スクロール先をリセット */
  resetScrollTarget: () => void;
  /** コードがあるかどうか */
  hasCode: boolean;
  /** コードの総行数 */
  totalLines: number;
}

const DEFAULT_STATE: ExplanationCodeState = {
  sourceCode: null,
  language: "text",
  filename: undefined,
  highlightedLines: [],
  previousHighlightedLines: [],
  bookmarks: [],
  explainedRanges: [],
  codeOrigin: null,
  scrollToLine: null,
};

/**
 * 解説モード用の状態管理フック
 */
export function useExplanationMode(options: ExplanationModeOptions = {}): UseExplanationModeReturn {
  const { conversationId, initialState } = options;

  // 状態の初期化
  const [state, setState] = useState<ExplanationCodeState>(() => ({
    ...DEFAULT_STATE,
    ...initialState,
  }));

  // 永続化からの復元
  useEffect(() => {
    if (!conversationId) return;

    const storageKey = `explanation-mode-${conversationId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<ExplanationCodeState>;
        setState((prev) => ({
          ...prev,
          ...parsed,
          // 一時的な状態はリセット
          scrollToLine: null,
          previousHighlightedLines: [],
        }));
      } catch {
        // パースエラーは無視
      }
    }
  }, [conversationId]);

  // 状態の永続化
  useEffect(() => {
    if (!conversationId) return;

    const storageKey = `explanation-mode-${conversationId}`;
    const toSave: Partial<ExplanationCodeState> = {
      sourceCode: state.sourceCode,
      language: state.language,
      filename: state.filename,
      bookmarks: state.bookmarks,
      explainedRanges: state.explainedRanges,
      codeOrigin: state.codeOrigin,
    };

    localStorage.setItem(storageKey, JSON.stringify(toSave));
  }, [conversationId, state.sourceCode, state.language, state.filename, state.bookmarks, state.explainedRanges, state.codeOrigin]);

  // ソースコードを設定
  const setSourceCode = useCallback((
    code: string,
    language: string,
    origin: ExplanationCodeState["codeOrigin"],
    filename?: string
  ) => {
    setState((prev) => ({
      ...prev,
      sourceCode: code,
      language,
      filename,
      codeOrigin: origin,
      // 新しいコードが設定されたらハイライトとブックマークをリセット
      highlightedLines: [],
      previousHighlightedLines: [],
      bookmarks: [],
      explainedRanges: [],
      scrollToLine: null,
    }));
  }, []);

  // ソースコードをクリア
  const clearSourceCode = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  // ハイライト行を設定
  const setHighlightedLines = useCallback((lines: number[]) => {
    setState((prev) => ({
      ...prev,
      previousHighlightedLines: prev.highlightedLines,
      highlightedLines: lines,
      scrollToLine: lines.length > 0 ? lines[0] : null,
    }));
  }, []);

  // ハイライトをクリア
  const clearHighlightedLines = useCallback(() => {
    setState((prev) => ({
      ...prev,
      previousHighlightedLines: prev.highlightedLines,
      highlightedLines: [],
      scrollToLine: null,
    }));
  }, []);

  // ブックマークを追加
  const addBookmark = useCallback((line: number) => {
    setState((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.includes(line)
        ? prev.bookmarks
        : [...prev.bookmarks, line].sort((a, b) => a - b),
    }));
  }, []);

  // ブックマークを削除
  const removeBookmark = useCallback((line: number) => {
    setState((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.filter((l) => l !== line),
    }));
  }, []);

  // ブックマークを切り替え
  const toggleBookmark = useCallback((line: number) => {
    setState((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.includes(line)
        ? prev.bookmarks.filter((l) => l !== line)
        : [...prev.bookmarks, line].sort((a, b) => a - b),
    }));
  }, []);

  // セクションを解説済みとしてマーク
  const markSectionExplained = useCallback((start: number, end: number) => {
    setState((prev) => {
      // 重複する範囲をマージ
      const newRange = { start: Math.min(start, end), end: Math.max(start, end) };
      const ranges = [...prev.explainedRanges];

      // 既存の範囲と重複がないか確認
      const overlapping = ranges.filter(
        (r) => r.start <= newRange.end && r.end >= newRange.start
      );

      if (overlapping.length === 0) {
        return {
          ...prev,
          explainedRanges: [...ranges, newRange].sort((a, b) => a.start - b.start),
        };
      }

      // 重複する範囲をマージ
      const merged = {
        start: Math.min(newRange.start, ...overlapping.map((r) => r.start)),
        end: Math.max(newRange.end, ...overlapping.map((r) => r.end)),
      };

      const filtered = ranges.filter(
        (r) => !(r.start <= newRange.end && r.end >= newRange.start)
      );

      return {
        ...prev,
        explainedRanges: [...filtered, merged].sort((a, b) => a.start - b.start),
      };
    });
  }, []);

  // 総行数
  const totalLines = useMemo(() => {
    return state.sourceCode ? state.sourceCode.split("\n").length : 0;
  }, [state.sourceCode]);

  // 解説進捗を計算
  const getExplanationProgress = useCallback(() => {
    if (totalLines === 0) return 0;

    // 解説済み行をカウント
    const explainedLines = new Set<number>();
    for (const range of state.explainedRanges) {
      for (let i = range.start; i <= range.end; i++) {
        explainedLines.add(i);
      }
    }

    return Math.round((explainedLines.size / totalLines) * 100);
  }, [state.explainedRanges, totalLines]);

  // 行について質問するプロンプトを生成
  const generateLineQuestion = useCallback((line: number) => {
    return `このコードの${line}行目について詳しく教えてください。この行は何をしていますか？`;
  }, []);

  // 範囲について質問するプロンプトを生成
  const generateRangeQuestion = useCallback((startLine: number, endLine: number) => {
    return `このコードの${startLine}行目から${endLine}行目について詳しく教えてください。この部分は何をしていますか？`;
  }, []);

  // スクロール先をリセット
  const resetScrollTarget = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scrollToLine: null,
    }));
  }, []);

  return {
    state,
    setSourceCode,
    clearSourceCode,
    setHighlightedLines,
    clearHighlightedLines,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    markSectionExplained,
    getExplanationProgress,
    generateLineQuestion,
    generateRangeQuestion,
    resetScrollTarget,
    hasCode: state.sourceCode !== null,
    totalLines,
  };
}
