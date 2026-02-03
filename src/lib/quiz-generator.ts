import type { StructuredQuiz, Artifact, UnlockQuizOption } from "@/types/chat";
import type { UnlockLevel, UnlockQuiz } from "@/hooks/useGenerationMode";

// ローカル型エイリアス
type QuizOption = UnlockQuizOption;

// Session-based flag to track if fallback helper has been used
// Key: artifactId, Value: true if helper was used
const fallbackUsedInSession = new Map<string, boolean>();
const MAX_FALLBACK_ENTRIES = 100;

/**
 * Estimate the appropriate number of quiz questions based on code complexity
 * - 1問: Simple code (< 15 lines, no complex patterns)
 * - 2問: Normal code (15-50 lines, some patterns)
 * - 3問: Complex code (> 50 lines, multiple complex patterns)
 */
export function estimateQuizCount(code: string): number {
  if (!code || code.trim().length === 0) {
    return 1;
  }

  const lines = code.split("\n").filter(line => line.trim().length > 0);
  const lineCount = lines.length;

  // Count complexity indicators
  let complexityScore = 0;

  // Line count factor
  if (lineCount > 50) {
    complexityScore += 2;
  } else if (lineCount > 15) {
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
  ];

  for (const pattern of complexPatterns) {
    if (pattern.test(code)) {
      complexityScore += 1;
    }
  }

  // Determine quiz count based on complexity score
  if (complexityScore >= 4) {
    return 3;
  } else if (complexityScore >= 2) {
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
 * Generate a simple fallback quiz when AI fails to provide one
 * This is intentionally minimal - the AI should be the primary quiz generator
 *
 * IMPORTANT: This fallback is limited to once per artifact per session
 */
export function generateFallbackQuiz(
  level: UnlockLevel,
  artifact: Artifact | null
): UnlockQuiz {
  const language = artifact?.language || "javascript";
  const code = artifact?.content || "";

  // Extract first few meaningful lines for context
  const codeLines = code.split("\n").filter(line => line.trim()).slice(0, 5);
  const codeSnippet = codeLines.length > 0 ? codeLines.join("\n") : undefined;

  // Simple, generic question that prompts the user to think about the code
  const question = "このコードの実装について、あなたはどの程度理解していますか？";

  const options: QuizOption[] = [
    {
      label: "A",
      text: "理解している - コードの目的と動作を説明できる",
      explanation: "素晴らしいです。コードをコピーして使用してください。",
    },
    {
      label: "B",
      text: "部分的に理解 - もう少し説明が欲しい",
      explanation: "AIに「このコードについてもっと詳しく説明して」と聞いてみてください。",
    },
    {
      label: "C",
      text: "まだ理解できていない - 基礎から教えて欲しい",
      explanation: "AIに「このコードを基礎から説明して」と聞いてみてください。",
    },
  ];

  // All options are "correct" - this is a self-assessment
  return {
    level,
    totalQuestions: 1,
    question,
    options,
    correctLabel: "A", // Any answer unlocks
    hint: "これは自己評価です。正直に回答してください。",
    codeSnippet,
    codeLanguage: language,
  };
}

/**
 * Convert StructuredQuiz to UnlockQuiz format
 */
export function structuredQuizToUnlockQuiz(quiz: StructuredQuiz): UnlockQuiz {
  return {
    level: quiz.level as UnlockLevel,
    totalQuestions: quiz.totalQuestions,
    question: quiz.question,
    options: quiz.options,
    correctLabel: quiz.correctLabel,
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
