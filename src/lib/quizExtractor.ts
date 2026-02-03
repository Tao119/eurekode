/**
 * クイズ抽出ユーティリティ
 * AIレスポンスからn択クイズを抽出する共通ロジック
 */

import type { StructuredQuiz } from "@/types/chat";

export interface QuizOption {
  label: string;
  text: string;
}

export interface ExtractedQuiz {
  question: string;
  options: QuizOption[];
  contentWithoutOptions: string;
}

/**
 * 構造化クイズ形式をパース
 * Format: <!--QUIZ:{"level":1,"question":"...","options":[...],"correctLabel":"A","hint":"..."}-->
 */
export function parseStructuredQuiz(content: string): StructuredQuiz | null {
  const quizMatch = content.match(/<!--QUIZ:([\s\S]*?)-->/);
  if (!quizMatch) return null;

  try {
    const parsed = JSON.parse(quizMatch[1].trim()) as StructuredQuiz;

    // Validate required fields
    if (!parsed.question || !parsed.options || parsed.options.length < 2) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * コンテンツからクイズマーカーを除去
 */
export function removeQuizMarkerFromContent(content: string): string {
  return content.replace(/<!--QUIZ:[\s\S]*?-->/g, "").trim();
}

/**
 * AIレスポンスからクイズの選択肢を抽出
 *
 * 対応パターン:
 * 1. 各行に1つの選択肢: "A) テキスト\nB) テキスト"
 * 2. 1行に複数の選択肢: "A) テキスト B) テキスト C) テキスト"
 * 3. 【レベルX】形式のヘッダー付き: "【レベル1】質問 A) 選択肢1 B) 選択肢2"
 * 4. 全角括弧: "Ａ）テキスト"
 * 5. コロン区切り: "A: テキスト" or "A：テキスト"
 * 6. ドット区切り: "A. テキスト"
 */
export function extractQuizOptions(content: string): ExtractedQuiz | null {
  // 選択肢のラベルパターン (A-D, 全角含む)
  const labelChars = "[A-DＡ-Ｄ]";
  // 区切り文字パターン
  const separators = "[)）.:：]";

  // パターン1: 1行に複数の選択肢がある場合（次の選択肢ラベルまでキャプチャ）
  // 例: "A) Physics2D... B) Transform... C) Animator..."
  const inlinePattern = new RegExp(
    `(${labelChars})${separators}\\s*(.+?)(?=\\s*${labelChars}${separators}|$)`,
    "g"
  );

  // パターン2: 各行に1つの選択肢がある場合
  // 例: "A) テキスト\nB) テキスト"
  const linePattern = new RegExp(
    `^[\\s\\-\\•\\*]*(${labelChars})${separators}\\s*(.+)$`,
    "gm"
  );

  // パターン3: 括弧で囲まれたラベル
  // 例: "(A) テキスト"
  const parenPattern = new RegExp(
    `^[\\s\\-\\•\\*]*\\((${labelChars})\\)\\s*(.+)$`,
    "gm"
  );

  let options: QuizOption[] = [];
  let matchedPattern: RegExp | null = null;
  let matchedMatches: RegExpMatchArray[] = [];

  // 各パターンを試して、最も多くの選択肢を抽出できるものを使用
  const patterns = [
    { regex: linePattern, name: "line" },
    { regex: inlinePattern, name: "inline" },
    { regex: parenPattern, name: "paren" },
  ];

  for (const { regex, name } of patterns) {
    const matches = [...content.matchAll(regex)];

    // 有効な選択肢が2-4個の場合のみ採用
    if (matches.length >= 2 && matches.length <= 4) {
      // 重複ラベルをチェック
      const labels = matches.map(m => normalizeLabel(m[1]));
      const uniqueLabels = new Set(labels);

      if (uniqueLabels.size === matches.length) {
        // インラインパターンの場合、長すぎるテキストは無効
        if (name === "inline") {
          const texts = matches.map(m => m[2].trim());
          const allValid = texts.every(t => t.length > 0 && t.length < 200);
          if (!allValid) continue;
        }

        matchedPattern = regex;
        matchedMatches = matches;
        break; // 最初に成功したパターンを使用
      }
    }
  }

  if (!matchedMatches.length) {
    return null;
  }

  // 選択肢を構築
  options = matchedMatches.map(m => ({
    label: normalizeLabel(m[1]),
    text: m[2].trim(),
  }));

  // 質問文を抽出
  const question = extractQuestion(content, matchedMatches[0]);

  // 選択肢を除いたコンテンツを取得
  const contentWithoutOptions = removeOptionsFromContent(content, matchedMatches);

  return {
    question,
    options,
    contentWithoutOptions,
  };
}

/**
 * 全角ラベルを半角に正規化
 */
function normalizeLabel(label: string): string {
  return label.replace(/[Ａ-Ｄ]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );
}

/**
 * 質問文を抽出
 */
function extractQuestion(content: string, firstOption: RegExpMatchArray): string {
  const firstOptionIndex = firstOption.index ?? 0;
  const textBeforeOptions = content.substring(0, firstOptionIndex).trim();

  // 【レベルX: ...】形式を探す
  const levelMatch = textBeforeOptions.match(/【[^】]+】\s*([\s\S]+?)$/);
  if (levelMatch) {
    return levelMatch[1].trim();
  }

  // 最後の質問文（？で終わる文）を探す
  const questionMatch = textBeforeOptions.match(/[^。\n]+[？?]$/);
  if (questionMatch) {
    return questionMatch[0].trim();
  }

  // 最後の段落を質問として使用
  const paragraphs = textBeforeOptions.split(/\n\n+/);
  const lastParagraph = paragraphs[paragraphs.length - 1]?.trim();

  if (lastParagraph && lastParagraph.length < 200) {
    return lastParagraph;
  }

  return "以下から選んでください";
}

/**
 * コンテンツから選択肢部分を除去
 */
function removeOptionsFromContent(
  content: string,
  matches: RegExpMatchArray[]
): string {
  if (matches.length === 0) return content;

  // 最初の選択肢の位置を特定
  const firstMatchIndex = matches[0].index ?? 0;

  // 選択肢より前の部分を取得
  let contentBefore = content.substring(0, firstMatchIndex);

  // 選択肢より後の部分を取得（最後の選択肢の終わり以降）
  const lastMatch = matches[matches.length - 1];
  const lastMatchEnd = (lastMatch.index ?? 0) + lastMatch[0].length;
  let contentAfter = content.substring(lastMatchEnd);

  // 末尾の改行をクリーンアップ
  contentBefore = contentBefore.replace(/\n{2,}$/, "\n");
  contentAfter = contentAfter.replace(/^\n+/, "\n");

  const result = (contentBefore + contentAfter).trim();

  // 空行の重複を除去
  return result.replace(/\n{3,}/g, "\n\n");
}

/**
 * 生成モード用: アンロッククイズを抽出
 */
export interface UnlockQuizExtraction {
  level: number;
  question: string;
  options: QuizOption[];
  correctLabel: string;
  hint: string;
}

export function extractUnlockQuiz(
  content: string,
  currentLevel: number,
  levelTemplates: Record<number, { questions: string[] }>
): UnlockQuizExtraction | null {
  // 1. まず構造化クイズ形式を試す
  const structuredQuiz = parseStructuredQuiz(content);
  if (structuredQuiz) {
    return {
      level: structuredQuiz.level,
      question: structuredQuiz.question,
      options: structuredQuiz.options,
      correctLabel: structuredQuiz.correctLabel,
      hint: structuredQuiz.hint || `コードの理解を確認しています。`,
    };
  }

  // 2. 構造化形式がなければ、正規表現でテキストからクイズを抽出
  const extracted = extractQuizOptions(content);

  if (!extracted || extracted.options.length < 2) {
    return null;
  }

  // 質問を取得（抽出できなければテンプレートを使用）
  const question = extracted.question ||
    levelTemplates[currentLevel]?.questions[0] ||
    "このコードについて確認しましょう";

  // 正解は通常A（プロンプトで指示している）
  const correctLabel = "A";

  return {
    level: currentLevel,
    question,
    options: extracted.options,
    correctLabel,
    hint: `この問題は${levelTemplates[currentLevel]?.questions[0] || "コードの理解"}に関する確認です。`,
  };
}
