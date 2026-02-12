import type { StructuredQuiz, Artifact, UnlockQuizOption } from "@/types/chat";
import type { UnlockLevel, UnlockQuiz } from "@/hooks/useGenerationMode";

// ローカル型エイリアス
type QuizOption = UnlockQuizOption;

/**
 * Shuffle quiz options randomly and update correctLabel accordingly
 * クイズの選択肢をランダムにシャッフルし、正解ラベルを更新
 */
function shuffleQuizOptions(
  options: QuizOption[],
  correctLabel: string
): { options: QuizOption[]; correctLabel: string } {
  if (options.length === 0) {
    return { options, correctLabel };
  }

  // Find the correct answer text before shuffling
  const correctOption = options.find((opt) => opt.label === correctLabel);
  if (!correctOption) {
    return { options, correctLabel };
  }
  const correctText = correctOption.text;

  // Fisher-Yates shuffle algorithm
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Reassign labels A, B, C, D... based on new positions
  const labels = ["A", "B", "C", "D", "E", "F"];
  let newCorrectLabel = correctLabel;

  const relabeled = shuffled.map((opt, index) => {
    const newLabel = labels[index] || String.fromCharCode(65 + index);
    // Track where the correct answer ended up
    if (opt.text === correctText) {
      newCorrectLabel = newLabel;
    }
    return { ...opt, label: newLabel };
  });

  return { options: relabeled, correctLabel: newCorrectLabel };
}

// Session-based flag to track if fallback helper has been used
// Key: artifactId, Value: true if helper was used
const fallbackUsedInSession = new Map<string, boolean>();

// Session-based flag to track if auto quiz request has been sent
// Key: artifactId, Value: true if request was sent
const autoQuizRequestSentInSession = new Map<string, boolean>();

const MAX_FALLBACK_ENTRIES = 100;

/**
 * Estimate the appropriate number of quiz questions based on code complexity
 * コードの複雑さに応じて適切な問題数を推定
 *
 * - 1問: 非常にシンプルなコード（<10行、複雑パターンなし）
 * - 2問: シンプルなコード（10-30行、1-2個のパターン）
 * - 3問: 中程度のコード（30-60行、複数のパターン）
 * - 4問: 複雑なコード（60-100行、多くのパターン）
 * - 5問以上: 非常に複雑なコード（>100行、高度なパターン多数）
 *
 * AIは最終的な問題数を判断するが、この値は推奨値として使用される
 */
export function estimateQuizCount(code: string): number {
  if (!code || code.trim().length === 0) {
    return 1;
  }

  const lines = code.split("\n").filter(line => line.trim().length > 0);
  const lineCount = lines.length;

  // Count complexity indicators
  let complexityScore = 0;

  // Line count factor (more granular scoring)
  if (lineCount > 100) {
    complexityScore += 4;
  } else if (lineCount > 60) {
    complexityScore += 3;
  } else if (lineCount > 30) {
    complexityScore += 2;
  } else if (lineCount > 10) {
    complexityScore += 1;
  }

  // Complex patterns (each adds to complexity)
  const complexPatterns = [
    /async\s+\w+|await\s+/,           // async/await
    /useCallback|useMemo|useEffect/,   // React hooks
    /\.reduce\s*\(/,                   // reduce
    /try\s*\{[\s\S]*catch/,            // try-catch
    /Promise\.all|Promise\.race/,      // Promise combinators
    /class\s+\w+/,                     // classes
    /interface\s+\w+|type\s+\w+\s*=/,  // TypeScript types
    /\?\./,                            // optional chaining
    /\?\?/,                            // nullish coalescing
    /\bextends\b.*\bimplements\b/,     // inheritance + interface
    /\bgenerics?\b|<T\s*[,>]/,         // generics
    /\.map\s*\(.*\.filter\s*\(/,       // chained array methods
    /useReducer|useContext/,           // advanced React hooks
    /Observable|pipe\s*\(/,            // RxJS patterns
    /decorator|@\w+\s*\(/,             // decorators
  ];

  for (const pattern of complexPatterns) {
    if (pattern.test(code)) {
      complexityScore += 1;
    }
  }

  // Count unique function/method definitions
  const functionCount = (code.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*{|\bmethod\b)/g) || []).length;
  if (functionCount > 5) {
    complexityScore += 2;
  } else if (functionCount > 2) {
    complexityScore += 1;
  }

  // Determine quiz count based on complexity score
  // より柔軟に問題数を決定（上限なし）
  if (complexityScore >= 10) {
    return Math.min(7, 5 + Math.floor((complexityScore - 10) / 3)); // 5-7問
  } else if (complexityScore >= 7) {
    return 5;
  } else if (complexityScore >= 5) {
    return 4;
  } else if (complexityScore >= 3) {
    return 3;
  } else if (complexityScore >= 1) {
    return 2;
  }
  return 1;
}

/**
 * Check if fallback helper has been used for this artifact in the current session
 */
export function hasFallbackBeenUsed(artifactId: string): boolean {
  return fallbackUsedInSession.get(artifactId) === true;
}

/**
 * Mark fallback helper as used for this artifact
 */
export function markFallbackAsUsed(artifactId: string): void {
  // Prevent unbounded memory growth
  if (fallbackUsedInSession.size >= MAX_FALLBACK_ENTRIES) {
    const firstKey = fallbackUsedInSession.keys().next().value;
    if (firstKey) {
      fallbackUsedInSession.delete(firstKey);
    }
  }
  fallbackUsedInSession.set(artifactId, true);
}

/**
 * Reset fallback usage tracking (call when starting a new session or switching artifacts)
 */
export function resetFallbackUsage(artifactId?: string): void {
  if (artifactId) {
    fallbackUsedInSession.delete(artifactId);
  } else {
    fallbackUsedInSession.clear();
  }
}

/**
 * Check if auto quiz request has been sent for this artifact in the current session
 */
export function hasAutoQuizRequestBeenSent(artifactId: string): boolean {
  return autoQuizRequestSentInSession.get(artifactId) === true;
}

/**
 * Mark auto quiz request as sent for this artifact
 */
export function markAutoQuizRequestSent(artifactId: string): void {
  // Prevent unbounded memory growth
  if (autoQuizRequestSentInSession.size >= MAX_FALLBACK_ENTRIES) {
    const firstKey = autoQuizRequestSentInSession.keys().next().value;
    if (firstKey) {
      autoQuizRequestSentInSession.delete(firstKey);
    }
  }
  autoQuizRequestSentInSession.set(artifactId, true);
}

/**
 * Reset auto quiz request tracking
 */
export function resetAutoQuizRequest(artifactId?: string): void {
  if (artifactId) {
    autoQuizRequestSentInSession.delete(artifactId);
  } else {
    autoQuizRequestSentInSession.clear();
  }
}

/**
 * Parse structured quiz from AI response
 * Format: <!--QUIZ:{"level":1,"question":"...","options":[...],"correctLabel":"A","hint":"..."}-->
 *
 * Handles common formatting issues:
 * - Multi-line JSON
 * - Trailing whitespace
 * - Japanese characters in strings
 * - Malformed closing tags (e.g., >--z instead of -->)
 */
export function parseStructuredQuiz(content: string): StructuredQuiz | null {
  // Match the quiz tag (supports multi-line content)
  // Also handle common malformed closing tags
  const quizMatch = content.match(/<!--QUIZ:([\s\S]*?)(?:-->|>--[a-z]?)/);
  if (!quizMatch) {
    // Check if there's an incomplete quiz tag (streaming in progress)
    if (content.includes("<!--QUIZ:") && !content.includes("-->")) {
      // Tag is incomplete, wait for more content
      return null;
    }
    return null;
  }

  try {
    // Clean up the JSON content
    let jsonContent = quizMatch[1].trim();

    // Remove any leading/trailing whitespace from each line
    jsonContent = jsonContent
      .split("\n")
      .map((line) => line.trim())
      .join("");

    // Try to parse as JSON
    const parsed = JSON.parse(jsonContent) as StructuredQuiz;

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
 * Extract quiz from text using regex patterns (legacy fallback)
 * Supports formats:
 * - A) option text (inline or newline separated)
 * - A. option text
 * - A: option text
 */
export function extractQuizFromText(
  content: string,
  level: UnlockLevel
): UnlockQuiz | null {
  // Pattern 1: Inline format - A) text B) text C) text
  const optionPattern = /([A-D])[).\:：]\s*([^A-D\n]+?)(?=\s*[A-D][).\:：]|\s*$|\n)/g;
  let matches = [...content.matchAll(optionPattern)];

  // Pattern 2: Newline separated format
  if (matches.length < 2) {
    const linePattern = /^([A-D])[).\:：]\s*(.+)$/gm;
    const lineMatches = [...content.matchAll(linePattern)];
    if (lineMatches.length >= 2) {
      matches = lineMatches;
    }
  }

  if (matches.length < 2) {
    return null;
  }

  // Extract question
  let question = "";

  // Try 【レベルX: ...】 pattern
  const levelPattern = /【[^】]+】\s*([^A-D]+?)(?=\s*[A-D][).\:：])/;
  const levelMatch = content.match(levelPattern);
  if (levelMatch) {
    question = levelMatch[1].trim();
  }

  // Try question mark pattern
  if (!question) {
    const questionPattern = /.*[？?]\s*(?=[A-D][).\:：])/;
    const questionMatch = content.match(questionPattern);
    if (questionMatch) {
      question = questionMatch[0].trim();
    }
  }

  // Fallback to code-specific question (not generic template)
  if (!question) {
    question = "このコードについて考えてみてください。";
  }

  const options = matches.map((m) => ({
    label: m[1],
    text: m[2].trim(),
  }));

  // Randomly select a correct answer position (should be specified by AI, this is fallback)
  const randomCorrectLabel = options.length > 0
    ? options[Math.floor(Math.random() * options.length)].label
    : "A";

  return {
    level,
    question,
    options,
    correctLabel: randomCorrectLabel,
    hint: "コードの内容をよく読んで考えてみてください。",
  };
}

/**
 * Analyze code and extract key patterns for quiz generation
 */
function analyzeCodePatterns(code: string): {
  pattern: string;
  snippet: string;
  question: string;
  options: QuizOption[];
  correctLabel: string;
}[] {
  const patterns: ReturnType<typeof analyzeCodePatterns> = [];

  // Pattern: async/await
  const asyncMatch = code.match(/async\s+(?:function\s+)?(\w+).*?{[\s\S]*?await\s+(\w+)/);
  if (asyncMatch) {
    patterns.push({
      pattern: "async-await",
      snippet: asyncMatch[0].slice(0, 100) + "...",
      question: `なぜこの関数に async キーワードを付けていますか？`,
      options: [
        { label: "A", text: "関数の実行速度を上げるため", explanation: "asyncは速度向上のためではなく、非同期処理を扱うためのキーワードです。" },
        { label: "B", text: "内部でawaitを使用して非同期処理を待機するため", explanation: "正解です。async関数内でawaitを使うことで、Promiseの解決を待機できます。" },
        { label: "C", text: "エラーハンドリングを自動化するため", explanation: "asyncだけではエラーハンドリングは自動化されません。try-catchが必要です。" },
      ],
      correctLabel: "B",
    });
  }

  // Pattern: React hooks (useEffect)
  const useEffectMatch = code.match(/useEffect\s*\(\s*\(\)\s*=>\s*{[\s\S]*?}\s*,\s*\[([\s\S]*?)\]/);
  if (useEffectMatch) {
    const deps = useEffectMatch[1].trim();
    patterns.push({
      pattern: "useEffect",
      snippet: useEffectMatch[0].slice(0, 120),
      question: deps ? `なぜ useEffect の依存配列に [${deps.split(",")[0].trim()}...] を指定していますか？` : `なぜ useEffect の依存配列を空配列 [] にしていますか？`,
      options: deps ? [
        { label: "A", text: "パフォーマンス最適化のため", explanation: "依存配列の主な目的はパフォーマンスではなく、いつ副作用を再実行するか制御することです。" },
        { label: "B", text: "指定した値が変更された時だけ副作用を実行するため", explanation: "正解です。依存配列の値が変更されたときのみ、useEffect内の処理が再実行されます。" },
        { label: "C", text: "Reactのルールで必須だから", explanation: "依存配列は任意ですが、正しく指定しないとバグの原因になります。" },
      ] : [
        { label: "A", text: "毎回レンダリング時に実行するため", explanation: "空配列は「一度だけ実行」を意味します。毎回実行するなら配列自体を省略します。" },
        { label: "B", text: "コンポーネントのマウント時に一度だけ実行するため", explanation: "正解です。空の依存配列はマウント時の一度だけ実行されることを意味します。" },
        { label: "C", text: "エラーを防ぐため", explanation: "空配列はエラー防止のためではなく、実行タイミングを制御するためです。" },
      ],
      correctLabel: "B",
    });
  }

  // Pattern: try-catch
  const tryCatchMatch = code.match(/try\s*{[\s\S]*?}\s*catch\s*\((\w+)\)\s*{/);
  if (tryCatchMatch) {
    patterns.push({
      pattern: "try-catch",
      snippet: tryCatchMatch[0].slice(0, 80) + "...",
      question: `なぜこの処理を try-catch ブロックで囲んでいますか？`,
      options: [
        { label: "A", text: "コードの実行を高速化するため", explanation: "try-catchは速度向上のためではなく、エラーハンドリングのための構文です。" },
        { label: "B", text: "処理が必ず成功することを保証するため", explanation: "try-catchは成功を保証するのではなく、失敗時の処理を定義するためのものです。" },
        { label: "C", text: "エラー発生時にアプリがクラッシュせず適切に対処するため", explanation: "正解です。try-catchでエラーをキャッチし、ユーザーにフィードバックを返すなど適切な処理ができます。" },
      ],
      correctLabel: "C",
    });
  }

  // Pattern: map
  const mapMatch = code.match(/\.map\s*\(\s*(?:\(?\s*(\w+)(?:\s*,\s*\w+)?\s*\)?\s*)?=>/);
  if (mapMatch) {
    patterns.push({
      pattern: "map",
      snippet: code.match(/\.map\s*\([^)]*\)\s*(?:=>|{)[^}]*}?/)?.[0]?.slice(0, 100) || "",
      question: `なぜ for ループではなく .map() メソッドを使用していますか？`,
      options: [
        { label: "A", text: "mapの方が実行速度が速いから", explanation: "mapとforの速度差はほぼありません。選択の理由は他にあります。" },
        { label: "B", text: "配列の各要素を変換した新しい配列を作成するため", explanation: "正解です。mapは元の配列を変更せず、変換結果の新しい配列を返します。" },
        { label: "C", text: "配列の要素を削除できるから", explanation: "mapは削除ではなく変換のためのメソッドです。削除にはfilterを使います。" },
      ],
      correctLabel: "B",
    });
  }

  // Pattern: optional chaining
  const optionalMatch = code.match(/(\w+)\?\.\w+/);
  if (optionalMatch) {
    patterns.push({
      pattern: "optional-chaining",
      snippet: code.match(/\w+\?\.\w+(?:\?\.\w+)*/)?.[0] || "",
      question: `なぜ ${optionalMatch[1]}?.property の形式（オプショナルチェイニング）を使用していますか？`,
      options: [
        { label: "A", text: "コードを短くするため", explanation: "確かに短くなりますが、主な目的は安全なアクセスです。" },
        { label: "B", text: "プロパティが存在しない場合にエラーを防ぐため", explanation: "正解です。オブジェクトがnull/undefinedでもエラーにならず、undefinedを返します。" },
        { label: "C", text: "TypeScriptでの型チェックを通すため", explanation: "型チェックのためだけではなく、実行時のエラー防止が主な目的です。" },
      ],
      correctLabel: "B",
    });
  }

  // Pattern: useState
  const useStateMatch = code.match(/const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/);
  if (useStateMatch) {
    patterns.push({
      pattern: "useState",
      snippet: useStateMatch[0],
      question: `なぜ普通の変数ではなく useState を使用して ${useStateMatch[1]} を管理していますか？`,
      options: [
        { label: "A", text: "Reactコンポーネント内で状態変更時に再レンダリングを起こすため", explanation: "正解です。useStateで管理する値が変更されると、Reactは自動的にコンポーネントを再レンダリングします。" },
        { label: "B", text: "変数をグローバルに共有するため", explanation: "useStateはグローバル共有ではなく、コンポーネント内の状態管理です。" },
        { label: "C", text: "変数の型を固定するため", explanation: "useStateは型固定のためではなく、状態の追跡と更新のためのものです。" },
      ],
      correctLabel: "A",
    });
  }

  return patterns;
}

/**
 * Generate a fallback quiz based on actual code patterns
 * AI生成が失敗した場合でも、実際のコードロジックに基づいた質問を生成
 *
 * 重要: 「あなたはこのコードを理解していますか？」のような
 * 自己評価形式の質問は絶対に生成しない
 */
export function generateFallbackQuiz(
  level: UnlockLevel,
  artifact: Artifact | null
): UnlockQuiz {
  const language = artifact?.language || "javascript";
  const code = artifact?.content || "";

  // Analyze code and extract patterns
  const patterns = analyzeCodePatterns(code);

  // If we found patterns, use the first one that matches the level
  const patternIndex = Math.min(level - 1, patterns.length - 1);
  if (patterns.length > 0 && patternIndex >= 0) {
    const pattern = patterns[patternIndex];
    // Shuffle options to randomize correct answer position
    const { options, correctLabel } = shuffleQuizOptions(
      pattern.options,
      pattern.correctLabel
    );
    return {
      level,
      totalQuestions: Math.max(patterns.length, 1),
      question: pattern.question,
      options,
      correctLabel,
      hint: "コードの該当部分をよく見て、その構文の目的を考えてみてください。",
      codeSnippet: pattern.snippet,
      codeLanguage: language,
    };
  }

  // Fallback: 具体的なコード要素に基づいた質問を生成
  // 「理解していますか？」系の質問は絶対に使わない
  const codeLines = code.split("\n").filter(line => line.trim());
  const firstMeaningfulLine = codeLines.find(line =>
    !line.startsWith("//") && !line.startsWith("import") && !line.startsWith("export")
  ) || codeLines[0] || "";

  // Extract function or variable name from first line
  const nameMatch = firstMeaningfulLine.match(/(?:function|const|let|var|class)\s+(\w+)/);
  const name = nameMatch?.[1] || "この処理";

  // Shuffle options for generic fallback quiz too
  const fallbackOptions = [
    {
      label: "A",
      text: "可読性と保守性を重視した設計",
      explanation: "コードの構造を見て、どのような設計思想があるか考えてみましょう。",
    },
    {
      label: "B",
      text: "パフォーマンスを最適化するため",
      explanation: "パフォーマンスも重要ですが、このコードの主な目的は何でしょうか。",
    },
    {
      label: "C",
      text: "特定の機能要件を満たすため",
      explanation: "コードが何を達成しようとしているか、入力と出力を考えてみましょう。",
    },
  ];
  const { options: shuffledFallbackOptions, correctLabel: shuffledFallbackLabel } = shuffleQuizOptions(
    fallbackOptions,
    "A"
  );

  return {
    level,
    totalQuestions: 1,
    question: `なぜ ${name} はこのような実装になっていますか？`,
    options: shuffledFallbackOptions,
    correctLabel: shuffledFallbackLabel,
    hint: "コードの構造と命名を見て、設計意図を読み取ってみてください。",
    codeSnippet: firstMeaningfulLine,
    codeLanguage: language,
  };
}

/**
 * Convert StructuredQuiz to UnlockQuiz format
 * Options are shuffled to randomize correct answer position
 *
 * Note: AI response uses 1-based levels (1, 2, 3...) but internal
 * system uses 0-based levels (0, 1, 2...) for consistency.
 * This function converts 1-based to 0-based.
 */
export function structuredQuizToUnlockQuiz(quiz: StructuredQuiz): UnlockQuiz {
  // Shuffle options to randomize correct answer position
  const { options, correctLabel } = shuffleQuizOptions(
    quiz.options,
    quiz.correctLabel
  );

  return {
    // Convert 1-based level from AI response to 0-based for internal use
    level: (quiz.level - 1) as UnlockLevel,
    totalQuestions: quiz.totalQuestions,
    question: quiz.question,
    options,
    correctLabel,
    hint: quiz.hint,
    codeSnippet: quiz.codeSnippet,
    codeLanguage: quiz.codeLanguage,
  };
}

/**
 * Remove quiz marker from content
 */
export function removeQuizMarkerFromContent(content: string): string {
  return content.replace(/<!--QUIZ:[\s\S]*?-->/g, "").trim();
}

/**
 * Remove incomplete streaming tags from content
 * During streaming, partial tags like "<!--QUIZ:{..." or "<!--ARTIFACT:{..." may appear
 * This function removes them to prevent showing raw JSON to users
 *
 * Logic:
 * - If <!--QUIZ: exists but no closing --> after it, remove from <!--QUIZ: to end
 * - If <!--ARTIFACT: exists but no <!--/ARTIFACT--> after it, remove from <!--ARTIFACT: to end
 */
export function removeIncompleteStreamingTags(content: string): string {
  let result = content;

  // Check for incomplete QUIZ tag
  const quizStartIndex = result.lastIndexOf("<!--QUIZ:");
  if (quizStartIndex !== -1) {
    // Look for --> after the QUIZ start
    const afterQuizStart = result.substring(quizStartIndex);
    const quizEndIndex = afterQuizStart.indexOf("-->");
    if (quizEndIndex === -1) {
      // No closing tag found - remove from <!--QUIZ: to end
      result = result.substring(0, quizStartIndex);
    }
  }

  // Check for incomplete ARTIFACT tag
  const artifactStartIndex = result.lastIndexOf("<!--ARTIFACT:");
  if (artifactStartIndex !== -1) {
    // Look for <!--/ARTIFACT--> after the ARTIFACT start
    const afterArtifactStart = result.substring(artifactStartIndex);
    const artifactEndIndex = afterArtifactStart.indexOf("<!--/ARTIFACT-->");
    if (artifactEndIndex === -1) {
      // No closing tag found - remove from <!--ARTIFACT: to end
      result = result.substring(0, artifactStartIndex);
    }
  }

  return result;
}
