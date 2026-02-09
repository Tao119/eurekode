/**
 * Line Reference Parser
 * AI応答から行番号参照を抽出し、コードパネルとの同期に使用
 */

export interface LineReference {
  /** 参照された行番号の配列 */
  lines: number[];
  /** 元のテキスト（マッチした文字列） */
  originalText: string;
  /** 参照の種類 */
  type: "single" | "range";
}

export interface ParsedLineReferences {
  /** すべての参照された行番号（重複なし、ソート済み） */
  allLines: number[];
  /** 個別の参照情報 */
  references: LineReference[];
  /** 最初に参照された行（スクロール先として使用） */
  scrollToLine: number | null;
}

// 行参照のパターン
const LINE_PATTERNS = [
  // 「行5」「行10」「行5-10」「行5〜10」
  /行\s*(\d+)(?:\s*[-〜~ー]\s*(\d+))?/g,
  // 「5行目」「5行目から10行目まで」「5〜10行目」
  /(\d+)\s*(?:[-〜~ー]\s*(\d+)\s*)?行目/g,
  // 「lines 5-10」「line 5」「line 5 to 10」
  /lines?\s+(\d+)(?:\s*[-–—to]\s*(\d+))?/gi,
  // 「L5」「L5-10」（ショートフォーム）
  /L\s*(\d+)(?:\s*[-〜~ー]\s*(\d+))?/gi,
  // 「5行」（コンテキストによっては行番号を示す）
  /(?:^|[、。\s])(\d+)\s*行(?:目|から|を|の|で|は|が)/g,
];

/**
 * テキストから行番号参照を抽出
 */
export function parseLineReferences(content: string): ParsedLineReferences {
  const allLines = new Set<number>();
  const references: LineReference[] = [];

  for (const pattern of LINE_PATTERNS) {
    // パターンをリセット（グローバルフラグ使用時の状態をクリア）
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : start;

      // 妥当性チェック（行番号は1-10000の範囲）
      if (start < 1 || start > 10000 || end < 1 || end > 10000) {
        continue;
      }

      // 範囲が逆の場合は入れ替え
      const actualStart = Math.min(start, end);
      const actualEnd = Math.max(start, end);

      // 範囲が大きすぎる場合はスキップ（誤検出の可能性）
      if (actualEnd - actualStart > 100) {
        continue;
      }

      const lines: number[] = [];
      for (let i = actualStart; i <= actualEnd; i++) {
        lines.push(i);
        allLines.add(i);
      }

      references.push({
        lines,
        originalText: match[0],
        type: actualStart === actualEnd ? "single" : "range",
      });
    }
  }

  const sortedLines = Array.from(allLines).sort((a, b) => a - b);

  return {
    allLines: sortedLines,
    references,
    scrollToLine: sortedLines.length > 0 ? sortedLines[0] : null,
  };
}

/**
 * 新しいメッセージから最新の行参照を抽出
 * 最後の段落やセクションを優先
 */
export function extractLatestLineReferences(content: string): ParsedLineReferences {
  // 段落で分割し、最後から検索
  const paragraphs = content.split(/\n\n+/);

  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const result = parseLineReferences(paragraphs[i]);
    if (result.allLines.length > 0) {
      return result;
    }
  }

  // 段落単位で見つからない場合は全体から抽出
  return parseLineReferences(content);
}

/**
 * コードブロックから言語を検出
 */
export function detectLanguageFromCodeBlock(content: string): string | null {
  // ```language形式を検出
  const match = content.match(/```(\w+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * メッセージからコードブロックを抽出
 */
export interface ExtractedCodeBlock {
  code: string;
  language: string;
  startIndex: number;
  endIndex: number;
}

export function extractCodeBlocks(content: string): ExtractedCodeBlock[] {
  const codeBlocks: ExtractedCodeBlock[] = [];
  const pattern = /```(\w*)\n?([\s\S]*?)```/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || "text",
      code: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return codeBlocks;
}

/**
 * 最初のコードブロックを抽出（コードパネル用）
 */
export function extractFirstCodeBlock(content: string): ExtractedCodeBlock | null {
  const blocks = extractCodeBlocks(content);
  return blocks.length > 0 ? blocks[0] : null;
}

/**
 * 複数のメッセージから最初のコードブロックを検索
 */
export function findFirstCodeBlockInMessages(
  messages: Array<{ role: string; content: string }>
): ExtractedCodeBlock | null {
  for (const message of messages) {
    // ユーザーメッセージからコードを検索（貼り付けられたコード）
    if (message.role === "user") {
      const block = extractFirstCodeBlock(message.content);
      if (block && block.code.length > 50) { // 短すぎるコードは除外
        return block;
      }
    }
  }
  return null;
}

/**
 * 行番号を含む質問プロンプトを生成
 */
export function generateLineQuestionPrompt(lineNumber: number): string {
  return `このコードの${lineNumber}行目について詳しく教えてください。この行は何をしていますか？`;
}

/**
 * 複数行を含む質問プロンプトを生成
 */
export function generateRangeQuestionPrompt(startLine: number, endLine: number): string {
  return `このコードの${startLine}行目から${endLine}行目について詳しく教えてください。この部分は何をしていますか？`;
}
