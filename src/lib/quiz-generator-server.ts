/**
 * Server-side quiz generation service
 * アーティファクトのコード内容に基づいてクイズを生成
 */

import { createAnthropicClient } from "@/lib/anthropic";
import { estimateQuizCount } from "./quiz-generator";

export interface QuizOption {
  label: string;
  text: string;
  explanation?: string;
}

export interface GeneratedQuiz {
  level: number;
  question: string;
  options: QuizOption[];
  correctLabel: string;
  hint?: string;
  codeSnippet?: string;
  codeLanguage?: string;
}

interface GenerateQuizzesOptions {
  code: string;
  language: string;
  title: string;
  estimatedCount?: number;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Distribute correct answers evenly across A, B, C
 */
function distributeCorrectAnswers(quizzes: GeneratedQuiz[]): GeneratedQuiz[] {
  const labels = ["A", "B", "C"];
  let labelIndex = Math.floor(Math.random() * 3); // Random start

  return quizzes.map((quiz) => {
    // Ensure we don't use the same label twice in a row if possible
    const targetLabel = labels[labelIndex % labels.length];
    labelIndex++;

    // Find the correct option
    const correctOption = quiz.options.find(
      (opt) => opt.label === quiz.correctLabel
    );
    if (!correctOption) return quiz;

    // Shuffle options
    const shuffledOptions = shuffleArray(quiz.options);

    // Reassign labels and find new correct label
    let newCorrectLabel = quiz.correctLabel;
    const relabeledOptions = shuffledOptions.map((opt, idx) => {
      const newLabel = labels[idx];
      if (opt.text === correctOption.text) {
        newCorrectLabel = newLabel;
      }
      return { ...opt, label: newLabel };
    });

    // If the correct answer isn't at target position, swap
    if (newCorrectLabel !== targetLabel) {
      const correctIdx = relabeledOptions.findIndex(
        (opt) => opt.label === newCorrectLabel
      );
      const targetIdx = relabeledOptions.findIndex(
        (opt) => opt.label === targetLabel
      );

      if (correctIdx !== -1 && targetIdx !== -1) {
        // Swap labels
        const temp = relabeledOptions[correctIdx].label;
        relabeledOptions[correctIdx] = {
          ...relabeledOptions[correctIdx],
          label: relabeledOptions[targetIdx].label,
        };
        relabeledOptions[targetIdx] = {
          ...relabeledOptions[targetIdx],
          label: temp,
        };
        newCorrectLabel = targetLabel;
      }
    }

    // Sort by label for consistent display
    relabeledOptions.sort((a, b) => a.label.localeCompare(b.label));

    return {
      ...quiz,
      options: relabeledOptions,
      correctLabel: newCorrectLabel,
    };
  });
}

/**
 * Validate generated quizzes for quality
 */
function validateQuizzes(quizzes: GeneratedQuiz[]): GeneratedQuiz[] {
  const seen = new Set<string>();
  const validated: GeneratedQuiz[] = [];

  for (const quiz of quizzes) {
    // Skip if question is too similar to previous ones
    const questionKey = quiz.question.toLowerCase().slice(0, 50);
    if (seen.has(questionKey)) continue;
    seen.add(questionKey);

    // Ensure we have exactly 3 options
    if (quiz.options.length < 3) continue;

    // Ensure correct label exists in options
    const hasCorrect = quiz.options.some(
      (opt) => opt.label === quiz.correctLabel
    );
    if (!hasCorrect) continue;

    // Ensure question is in "なぜ" format
    if (
      !quiz.question.includes("なぜ") &&
      !quiz.question.includes("どうして")
    ) {
      // Try to rephrase
      quiz.question = `なぜ${quiz.question.replace(/^.*(この|その)/, "")}`;
    }

    validated.push(quiz);
  }

  return validated;
}

/**
 * Generate quizzes for an artifact using Claude API
 */
export async function generateQuizzesForArtifact(
  options: GenerateQuizzesOptions
): Promise<GeneratedQuiz[]> {
  const { code, language, title, estimatedCount } = options;

  // Calculate quiz count based on code complexity
  const quizCount = estimatedCount ?? estimateQuizCount(code);

  // Don't generate if code is too simple
  if (quizCount === 0 || code.trim().length < 10) {
    return [];
  }

  const prompt = `あなたはプログラミング教育の専門家です。以下のコードについて、${quizCount}問の理解度確認クイズを生成してください。

【ファイル名】${title}
【言語】${language || "不明"}

【コード】
\`\`\`${language || ""}
${code}
\`\`\`

【出力形式】
以下のJSON配列形式で出力してください。JSONのみを出力し、他のテキストは含めないでください。

[
  {
    "level": 1,
    "question": "なぜ〜していますか？",
    "codeSnippet": "// 質問が参照するコード部分（5-10行程度）",
    "codeLanguage": "${language || "javascript"}",
    "options": [
      {"label": "A", "text": "選択肢1（20文字以内）", "explanation": "この選択肢の説明"},
      {"label": "B", "text": "選択肢2（20文字以内）", "explanation": "この選択肢の説明"},
      {"label": "C", "text": "選択肢3（20文字以内）", "explanation": "この選択肢の説明"}
    ],
    "correctLabel": "B",
    "hint": "ヒント（30文字以内）"
  }
]

【重要なルール - 必ず守ってください】

1. **質問形式**: 全ての質問は必ず「なぜ〜していますか？」形式にする
   - 良い例: 「なぜuseEffectの依存配列を空にしていますか？」
   - 悪い例: 「このコードの目的は何ですか？」

2. **具体性**: コード内の実際の関数名、変数名、構文を使って質問する
   - codeSnippetには質問が参照するコード部分を必ず含める

3. **被り禁止**: 各質問は異なるコード部分・異なる概念を対象にする
   - 同じ概念を別の言い方で聞かない
   - 「初期値」と「デフォルト値」のように同義語で別の質問を作らない

4. **正解の分散**: 正解をA/B/Cに均等に分散させる（全問Aは禁止）

5. **選択肢の質**:
   - 明らかに間違っている選択肢は避ける
   - 全ての選択肢がもっともらしく見えるようにする
   - 各選択肢にexplanation（説明）を含める

6. **対象レベル**: プログラミング初〜中級者向け（コードが複雑な場合は上級者向けも可）

7. **禁止する質問パターン**:
   - 「あなたはこのコードを理解していますか？」（自己評価系）
   - 「このコードの主な目的は何ですか？」（抽象的）
   - 「どのデザインパターンが使われていますか？」（汎用的）`;

  try {
    const client = createAnthropicClient();
    const response = await client.messages.create({
      model: "us.anthropic.claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.error("No text content in response");
      return [];
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // Log only metadata, not the full response content (security)
      console.error("No JSON array found in response. Content length:", textContent.text.length);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedQuiz[];

    // Validate and clean up quizzes
    const validated = validateQuizzes(parsed);

    // Ensure level numbers are correct (1-based)
    const numbered = validated.map((quiz, idx) => ({
      ...quiz,
      level: idx + 1,
    }));

    // Distribute correct answers evenly
    const distributed = distributeCorrectAnswers(numbered);

    return distributed;
  } catch (error) {
    console.error("Quiz generation error:", error);
    return [];
  }
}

/**
 * Generate fallback quizzes when AI generation fails
 * Based on code pattern analysis
 */
export function generateFallbackQuizzes(
  code: string,
  language: string
): GeneratedQuiz[] {
  const quizzes: GeneratedQuiz[] = [];

  // Pattern: async/await
  if (/async\s+(?:function\s+)?(\w+)/.test(code)) {
    quizzes.push({
      level: quizzes.length + 1,
      question: "なぜこの関数にasyncキーワードを付けていますか？",
      options: [
        {
          label: "A",
          text: "関数の実行速度を上げるため",
          explanation:
            "asyncは速度向上のためではなく、非同期処理を扱うためのキーワードです。",
        },
        {
          label: "B",
          text: "内部でawaitを使用するため",
          explanation:
            "正解です。async関数内でawaitを使うことで、Promiseの解決を待機できます。",
        },
        {
          label: "C",
          text: "エラーハンドリングを自動化するため",
          explanation:
            "asyncだけではエラーハンドリングは自動化されません。try-catchが必要です。",
        },
      ],
      correctLabel: "B",
      hint: "この関数内でawaitが使われているか確認してください",
      codeLanguage: language,
    });
  }

  // Pattern: useEffect
  if (/useEffect\s*\(/.test(code)) {
    const hasEmptyDeps = /useEffect\s*\([^,]*,\s*\[\s*\]/.test(code);
    quizzes.push({
      level: quizzes.length + 1,
      question: hasEmptyDeps
        ? "なぜuseEffectの依存配列を空配列にしていますか？"
        : "なぜuseEffectに依存配列を指定していますか？",
      options: hasEmptyDeps
        ? [
            {
              label: "A",
              text: "毎回レンダリング時に実行するため",
              explanation:
                "空配列は「一度だけ実行」を意味します。毎回実行するなら配列自体を省略します。",
            },
            {
              label: "B",
              text: "マウント時に一度だけ実行するため",
              explanation:
                "正解です。空の依存配列はマウント時の一度だけ実行されることを意味します。",
            },
            {
              label: "C",
              text: "エラーを防ぐため",
              explanation:
                "空配列はエラー防止のためではなく、実行タイミングを制御するためです。",
            },
          ]
        : [
            {
              label: "A",
              text: "パフォーマンス最適化のため",
              explanation:
                "依存配列の主な目的はパフォーマンスではなく、いつ副作用を再実行するか制御することです。",
            },
            {
              label: "B",
              text: "値が変更された時だけ実行するため",
              explanation:
                "正解です。依存配列の値が変更されたときのみ、useEffect内の処理が再実行されます。",
            },
            {
              label: "C",
              text: "Reactのルールで必須だから",
              explanation:
                "依存配列は任意ですが、正しく指定しないとバグの原因になります。",
            },
          ],
      correctLabel: "B",
      hint: "依存配列の中身と副作用の関係を考えてください",
      codeLanguage: language,
    });
  }

  // Pattern: try-catch
  if (/try\s*\{[\s\S]*?\}\s*catch/.test(code)) {
    quizzes.push({
      level: quizzes.length + 1,
      question: "なぜこの処理をtry-catchブロックで囲んでいますか？",
      options: [
        {
          label: "A",
          text: "コードの実行を高速化するため",
          explanation:
            "try-catchは速度向上のためではなく、エラーハンドリングのための構文です。",
        },
        {
          label: "B",
          text: "処理が必ず成功することを保証するため",
          explanation:
            "try-catchは成功を保証するのではなく、失敗時の処理を定義するためのものです。",
        },
        {
          label: "C",
          text: "エラー発生時に適切に対処するため",
          explanation:
            "正解です。try-catchでエラーをキャッチし、ユーザーにフィードバックを返すなど適切な処理ができます。",
        },
      ],
      correctLabel: "C",
      hint: "catchブロック内で何が行われているか確認してください",
      codeLanguage: language,
    });
  }

  // Pattern: useState
  if (/useState\s*[<(]/.test(code)) {
    quizzes.push({
      level: quizzes.length + 1,
      question: "なぜuseStateを使用して状態を管理していますか？",
      options: [
        {
          label: "A",
          text: "状態変更時に再レンダリングを起こすため",
          explanation:
            "正解です。useStateで管理する値が変更されると、Reactは自動的にコンポーネントを再レンダリングします。",
        },
        {
          label: "B",
          text: "変数をグローバルに共有するため",
          explanation:
            "useStateはグローバル共有ではなく、コンポーネント内の状態管理です。",
        },
        {
          label: "C",
          text: "変数の型を固定するため",
          explanation:
            "useStateは型固定のためではなく、状態の追跡と更新のためのものです。",
        },
      ],
      correctLabel: "A",
      hint: "Reactコンポーネントが再描画されるタイミングを考えてください",
      codeLanguage: language,
    });
  }

  // Distribute correct answers
  return distributeCorrectAnswers(quizzes);
}
