/**
 * クイズ抽出ユーティリティ
 * AIレスポンスからn択クイズを抽出する共通ロジック
 */

import type { StructuredQuiz, UnlockQuizOption } from "@/types/chat";
import { parseStructuredQuiz, removeQuizMarkerFromContent } from "./quiz-generator";

// 再エクスポート（後方互換性のため）
export { parseStructuredQuiz, removeQuizMarkerFromContent };

// クイズの選択肢（互換性のため型エイリアスを提供）
export type QuizOption = Pick<UnlockQuizOption, "label" | "text">;

export interface ExtractedQuiz {
  question: string;
  options: QuizOption[];
  contentWithoutOptions: string;
}

export interface MultipleExtractedQuizzes {
  quizzes: ExtractedQuiz[];
  contentWithoutQuizzes: string;
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
  // 改行や段落区切りでも停止するように修正
  const inlinePattern = new RegExp(
    `(${labelChars})${separators}\\s*(.+?)(?=\\s*${labelChars}${separators}|\\n|$)`,
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
 * AIレスポンスから複数のクイズを抽出
 *
 * 対応パターン:
 * 1. 「質問1:」「質問2:」などの番号付き質問
 * 2. 「【問1】」「【問2】」などの括弧付き番号
 * 3. 「Q1:」「Q2:」などの英字番号
 * 4. 「1.」「2.」などの数字だけの場合（選択肢A-Dが続く場合）
 * 5. 複数の選択肢セット（A-D）が離れて存在する場合
 */
export function extractMultipleQuizzes(content: string): MultipleExtractedQuizzes | null {
  // 質問区切りパターンを検出
  const questionSplitPatterns = [
    /(?=(?:質問|問題|問)\s*[1-9０-９][0-9０-９]*[\s:：.．])/g,
    /(?=【(?:質問|問題|問)\s*[1-9０-９][0-9０-９]*】)/g,
    /(?=Q\s*[1-9][0-9]*[\s:：.．])/gi,
    /(?=\n\s*[1-9][0-9]*[\s.．:：]\s*[^\dA-Da-d].*?(?:\n\s*[A-Da-d][\s)）.:：]))/g,
    // 疑問符で終わる行の後にA)などの選択肢が続くパターン
    /(?=\n[^\n]*[？?]\s*\n\s*[A-Da-dＡ-Ｄ][)）.:：])/g,
  ];

  let sections: string[] = [];

  // 各パターンで分割を試みる
  for (const pattern of questionSplitPatterns) {
    const testSections = content.split(pattern).filter((s) => s.trim());
    if (testSections.length >= 2) {
      sections = testSections;
      break;
    }
  }

  // パターンで分割できなかった場合、選択肢のセットで分割を試みる
  if (sections.length < 2) {
    sections = splitByOptionSets(content);
  }

  // 分割できなかった場合
  if (sections.length < 2) {
    // 単一のクイズとして抽出を試みる
    const singleQuiz = extractQuizOptions(content);
    if (singleQuiz) {
      return {
        quizzes: [singleQuiz],
        contentWithoutQuizzes: singleQuiz.contentWithoutOptions,
      };
    }
    return null;
  }

  // 各セクションからクイズを抽出
  const quizzes: ExtractedQuiz[] = [];
  const nonQuizParts: string[] = [];

  for (const section of sections) {
    const quiz = extractQuizOptions(section);
    if (quiz && quiz.options.length >= 2) {
      quizzes.push(quiz);
    } else {
      // クイズが抽出できなかったセクションは非クイズ部分として保持
      nonQuizParts.push(section.trim());
    }
  }

  if (quizzes.length === 0) {
    return null;
  }

  // 非クイズ部分を結合
  const contentWithoutQuizzes = nonQuizParts.join("\n\n").trim();

  return {
    quizzes,
    contentWithoutQuizzes,
  };
}

/**
 * 選択肢のセット（A-D）で内容を分割
 * 複数の独立したA-Dセットがある場合に対応
 */
function splitByOptionSets(content: string): string[] {
  const lines = content.split("\n");
  const sections: string[] = [];
  let currentSection: string[] = [];
  let lastOptionLabel = "";
  let optionCount = 0;
  let seenLabels = new Set<string>();
  // 最後の選択肢行のインデックス（currentSection内）を追跡
  let lastOptionIndexInSection = -1;

  // 質問文かどうかを判定するヘルパー関数
  const isQuestionLikeLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // 質問マーカーや質問文のパターン
    return /[？?]$/.test(trimmed) || // 疑問符で終わる
           /^(?:質問|問題|問)\s*[0-9０-９]/.test(trimmed) || // 質問番号
           /^Q\s*[0-9]/i.test(trimmed) || // Q1, Q2など
           /^【[^】]+】/.test(trimmed) || // 【】で囲まれた見出し
           /^[0-9０-９]+[.．:：)）]/.test(trimmed); // 番号付きの行
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const optionMatch = line.match(/^\s*[A-Da-dＡ-Ｄ][)）.:：]\s*.+/);

    if (optionMatch) {
      const rawLabel = line.trim()[0];
      const label = rawLabel.toUpperCase().replace(/[Ａ-Ｄ]/g, c =>
        String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
      );

      // 新しいAが見つかり、前のセクションに選択肢があった場合
      // または既に見たラベルが再度出現した場合（重複）
      if ((label === "A" && optionCount >= 2) ||
          (seenLabels.has(label) && optionCount >= 2)) {
        // 新しい質問のテキストが現在のセクションに含まれている可能性を考慮
        // 最後の選択肢以降の行を新しいセクションに移動
        let splitIndex = currentSection.length;

        // 最後の選択肢行の後から、質問文らしい行を探す
        if (lastOptionIndexInSection >= 0 && lastOptionIndexInSection < currentSection.length - 1) {
          for (let j = lastOptionIndexInSection + 1; j < currentSection.length; j++) {
            if (isQuestionLikeLine(currentSection[j]) || currentSection[j].trim().length > 10) {
              // 質問文らしい行、または内容のある行を見つけた
              splitIndex = j;
              break;
            }
          }
        }

        // 前のセクションを保存
        const prevSectionLines = currentSection.slice(0, splitIndex);
        const nextSectionLines = currentSection.slice(splitIndex);

        if (prevSectionLines.length > 0) {
          sections.push(prevSectionLines.join("\n"));
        }

        // 次のセクションに残りの行を移動
        currentSection = nextSectionLines;
        optionCount = 0;
        seenLabels = new Set<string>();
        lastOptionIndexInSection = -1;
      }

      currentSection.push(line);
      lastOptionLabel = label;
      seenLabels.add(label);
      optionCount++;
      lastOptionIndexInSection = currentSection.length - 1;
    } else {
      currentSection.push(line);

      // D/Ｄの後で、次の行が選択肢でない場合、セクション終了の可能性
      if (lastOptionLabel === "D" && optionCount >= 2) {
        // 空行または質問っぽいテキストが続く場合はセクション区切り
        const nextOptionLine = lines.slice(i + 1, i + 5).find((l) =>
          /^\s*[A-Da-dＡ-Ｄ][)）.:：]\s*.+/.test(l)
        );
        if (nextOptionLine && /^\s*[AaＡ][)）.:：]/.test(nextOptionLine)) {
          sections.push(currentSection.join("\n"));
          currentSection = [];
          optionCount = 0;
          lastOptionLabel = "";
          seenLabels = new Set<string>();
          lastOptionIndexInSection = -1;
        }
      }
    }
  }

  // 最後のセクションを追加
  if (currentSection.length > 0) {
    sections.push(currentSection.join("\n"));
  }

  return sections.filter((s) => s.trim());
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

  // Randomly select a correct answer position (fallback when AI doesn't specify)
  // This ensures variety in quiz answers
  const availableLabels = extracted.options.map(opt => opt.label);
  const correctLabel = availableLabels.length > 0
    ? availableLabels[Math.floor(Math.random() * availableLabels.length)]
    : "A";

  return {
    level: currentLevel,
    question,
    options: extracted.options,
    correctLabel,
    hint: `この問題は${levelTemplates[currentLevel]?.questions[0] || "コードの理解"}に関する確認です。`,
  };
}
