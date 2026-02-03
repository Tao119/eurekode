import type { StructuredQuiz, Artifact } from "@/types/chat";
import type { UnlockLevel, UnlockQuiz, QuizOption } from "@/hooks/useGenerationMode";

/**
 * Parse structured quiz from AI response
 * Format: <!--QUIZ:{"level":1,"question":"...","options":[...],"correctLabel":"A","hint":"..."}-->
 *
 * Handles common formatting issues:
 * - Multi-line JSON
 * - Trailing whitespace
 * - Japanese characters in strings
 */
export function parseStructuredQuiz(content: string): StructuredQuiz | null {
  // Match the quiz tag (supports multi-line content)
  const quizMatch = content.match(/<!--QUIZ:([\s\S]*?)-->/);
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
      console.warn("[Quiz Parser] Missing required fields:", {
        hasQuestion: !!parsed.question,
        optionsCount: parsed.options?.length ?? 0,
      });
      return null;
    }

    return parsed;
  } catch (e) {
    // Log the error for debugging
    console.warn("[Quiz Parser] Failed to parse quiz JSON:", e);
    console.warn("[Quiz Parser] Raw content:", quizMatch[1].substring(0, 200));
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

  return {
    level,
    question,
    options,
    correctLabel: "A", // Default to A (should be specified by AI)
    hint: "コードの内容をよく読んで考えてみてください。",
  };
}

// コード内容から具体的な質問を生成するためのヘルパー
function generateCodeSpecificQuestion(code: string, _language: string): string {
  // コードの特徴を検出して具体的な「なぜ？」質問を生成

  // 非同期処理
  if (/async\s+\w+|await\s+/.test(code)) {
    if (code.includes("await Promise.all")) {
      return "なぜ Promise.all を使用していますか？";
    }
    if (/try\s*{[\s\S]*await[\s\S]*}\s*catch/.test(code)) {
      return "なぜ async/await を try-catch で囲んでいますか？";
    }
    return "なぜこの処理を async/await で実装していますか？";
  }

  // React hooks
  if (/useCallback\s*\(/.test(code)) {
    return "なぜ useCallback でラップしていますか？";
  }
  if (/useMemo\s*\(/.test(code)) {
    return "なぜ useMemo を使用していますか？";
  }
  if (/useEffect\s*\([\s\S]*,\s*\[\s*\]/.test(code)) {
    return "なぜ useEffect の依存配列を空にしていますか？";
  }
  if (/useState</.test(code)) {
    return "なぜこの状態の型をジェネリクスで指定していますか？";
  }

  // 配列操作
  if (/\.reduce\s*\(/.test(code)) {
    const reduceMatch = code.match(/\.reduce\s*\([^,]+,\s*([^)]+)\)/);
    if (reduceMatch) {
      return `なぜ reduce の初期値に ${reduceMatch[1].trim()} を渡していますか？`;
    }
    return "なぜ reduce を使用していますか？";
  }
  if (/\.filter\s*\([\s\S]*\)\.map\s*\(/.test(code)) {
    return "なぜ filter と map をチェーンしていますか？";
  }
  if (/\.flatMap\s*\(/.test(code)) {
    return "なぜ flatMap を使用していますか？";
  }

  // オプショナルチェイニング
  if (/\?\.\w+/.test(code)) {
    return "なぜオプショナルチェイニング（?.）を使用していますか？";
  }

  // Null合体演算子
  if (/\?\?\s*/.test(code)) {
    return "なぜ Null合体演算子（??）を使用していますか？";
  }

  // スプレッド演算子
  if (/\.\.\.\w+/.test(code)) {
    return "なぜスプレッド演算子（...）を使用していますか？";
  }

  // 分割代入
  if (/const\s*{\s*\w+.*}\s*=/.test(code)) {
    return "なぜ分割代入を使用していますか？";
  }

  // エラーハンドリング
  if (/throw\s+new\s+Error/.test(code)) {
    return "なぜこの箇所で例外をスローしていますか？";
  }

  // 型ガード
  if (/typeof\s+\w+\s*===/.test(code) || /instanceof\s+\w+/.test(code)) {
    return "なぜ型チェックを行っていますか？";
  }

  // デフォルト値
  if (/=\s*{\s*}|=\s*\[\s*]|=\s*null|=\s*undefined|=\s*''|=\s*0/.test(code)) {
    return "なぜこのデフォルト値を設定していますか？";
  }

  // 早期リターン
  if (/if\s*\([^)]+\)\s*(return|throw)/.test(code)) {
    return "なぜ早期リターンを使用していますか？";
  }

  // デフォルトの質問（コードの具体的な要素を参照）
  const functionMatch = code.match(/(?:function|const|let|var)\s+(\w+)/);
  if (functionMatch) {
    return `なぜ ${functionMatch[1]} をこのように実装していますか？`;
  }

  return "なぜこのような実装方法を選択していますか？";
}

/**
 * Generate a fallback quiz based on code content and level
 * This is used when AI doesn't provide a structured quiz
 *
 * Important: Always generates code-specific "なぜ？" questions, never generic pattern questions
 */
export function generateFallbackQuiz(
  level: UnlockLevel,
  artifact: Artifact | null
): UnlockQuiz {
  const code = artifact?.content || "";
  const language = artifact?.language || "javascript";

  // Generate a specific question based on actual code content
  const question = generateCodeSpecificQuestion(code, language);

  // Analyze code to generate context-aware options
  const options = generateOptionsFromCode(level, artifact);

  // Extract a relevant code snippet for display
  const codeSnippet = extractRelevantSnippet(code, question);

  return {
    level,
    question,
    options,
    correctLabel: "A",
    hint: getHintFromCode(level, artifact),
    codeSnippet,
    codeLanguage: language,
  };
}

/**
 * Extract a relevant code snippet based on the question
 */
function extractRelevantSnippet(code: string, question: string): string | undefined {
  const lines = code.split("\n");

  // Find relevant lines based on question keywords
  if (question.includes("async") || question.includes("await")) {
    const asyncIndex = lines.findIndex(l => /async|await/.test(l));
    if (asyncIndex >= 0) {
      return lines.slice(Math.max(0, asyncIndex - 1), asyncIndex + 4).join("\n");
    }
  }

  if (question.includes("useCallback") || question.includes("useMemo")) {
    const hookIndex = lines.findIndex(l => /useCallback|useMemo/.test(l));
    if (hookIndex >= 0) {
      return lines.slice(Math.max(0, hookIndex - 1), hookIndex + 5).join("\n");
    }
  }

  if (question.includes("reduce")) {
    const reduceIndex = lines.findIndex(l => /\.reduce/.test(l));
    if (reduceIndex >= 0) {
      return lines.slice(Math.max(0, reduceIndex - 1), reduceIndex + 3).join("\n");
    }
  }

  // Default: return first 5-8 non-empty lines
  const nonEmptyLines = lines.filter(l => l.trim()).slice(0, 8);
  return nonEmptyLines.length > 0 ? nonEmptyLines.join("\n") : undefined;
}

/**
 * Generate quiz options based on code analysis
 */
function generateOptionsFromCode(
  level: UnlockLevel,
  artifact: Artifact | null
): QuizOption[] {
  const code = artifact?.content || "";
  const language = artifact?.language || "javascript";

  // Level 1: Purpose-based options
  if (level === 1) {
    return generatePurposeOptions(code, language);
  }

  // Level 2: Pattern-based options
  if (level === 2) {
    return generatePatternOptions(code, language);
  }

  // Level 3: Design decision options
  if (level === 3) {
    return generateDesignOptions(code, language);
  }

  // Default fallback
  return [
    { label: "A", text: "正しい実装方法である", explanation: "このコードは要件を満たす正しい実装です。" },
    { label: "B", text: "別のアプローチの方が良い", explanation: "現在のコードが要件を満たしているため、別のアプローチは必要ありません。" },
    { label: "C", text: "この実装は特定の条件でのみ有効", explanation: "このコードは一般的なユースケースに対応しています。" },
  ];
}

function generatePurposeOptions(code: string, language: string): QuizOption[] {
  // Detect common patterns in code
  const hasApi = /fetch\(|axios|api|http|request/i.test(code);
  const hasState = code.includes("useState") || code.includes("setState") || code.includes("state");
  const hasValidation = /validate|schema|check|verify/i.test(code);
  const hasLoop = /for\s*\(|while\s*\(|\.map\(|\.forEach\(/.test(code);

  if (hasApi) {
    return [
      { label: "A", text: "外部APIとの通信を行う", explanation: "fetch、axios、またはAPI関連のコードが含まれており、外部サービスとの通信が主目的です。" },
      { label: "B", text: "ローカルデータの処理を行う", explanation: "このコードにはAPI通信のコードが含まれているため、ローカルデータ処理だけが目的ではありません。" },
      { label: "C", text: "UIの表示を制御する", explanation: "UIの制御も含まれる可能性がありますが、主目的はAPI通信です。" },
    ];
  } else if (hasState) {
    return [
      { label: "A", text: "状態管理を行う", explanation: "useState、setStateなどの状態管理APIが使用されており、コンポーネントの状態を管理しています。" },
      { label: "B", text: "データの変換を行う", explanation: "データ変換は状態管理の一部かもしれませんが、主目的は状態の管理です。" },
      { label: "C", text: "副作用を実行する", explanation: "副作用はuseEffectなどで実行されますが、このコードの主目的は状態管理です。" },
    ];
  } else if (hasValidation) {
    return [
      { label: "A", text: "データのバリデーションを行う", explanation: "validateやschemaなどのキーワードが含まれており、入力データの検証が主目的です。" },
      { label: "B", text: "データの保存を行う", explanation: "データの保存は検証後に行われることが多いですが、このコードの主目的はバリデーションです。" },
      { label: "C", text: "エラーハンドリングを行う", explanation: "バリデーションエラーの処理は含まれますが、主目的はデータの検証です。" },
    ];
  } else if (hasLoop) {
    return [
      { label: "A", text: "データの集合を処理する", explanation: "ループ処理（for、map、forEachなど）が含まれており、配列やリストの処理が主目的です。" },
      { label: "B", text: "単一のデータを処理する", explanation: "ループが使用されているため、単一ではなく複数のデータを処理しています。" },
      { label: "C", text: "イベントを処理する", explanation: "イベント処理のためにループが使われることもありますが、このコードはデータ処理が主目的です。" },
    ];
  }

  return [
    { label: "A", text: "特定の処理を実行する", explanation: "このコードは特定のビジネスロジックや処理を実行するために設計されています。" },
    { label: "B", text: "ユーティリティ機能を提供する", explanation: "汎用的なユーティリティではなく、特定の目的のために作られています。" },
    { label: "C", text: "設定を管理する", explanation: "設定管理が目的ではなく、特定の処理の実行が主な目的です。" },
  ];
}

function generatePatternOptions(code: string, language: string): QuizOption[] {
  const hasClass = /class\s+\w+/.test(code);
  const hasHook = /use[A-Z]\w+/.test(code);
  const hasFactory = /create[A-Z]\w+|factory/i.test(code);
  const hasObserver = /subscribe|observe|listener|on[A-Z]\w+/i.test(code);
  const hasComponent = /function\s+[A-Z]\w+|const\s+[A-Z]\w+\s*=/.test(code) && code.includes("return");

  if (hasHook) {
    return [
      { label: "A", text: "カスタムフックパターン", explanation: "useXxxという命名規則でReactのカスタムフックが実装されています。状態やロジックを再利用可能な形で切り出すパターンです。" },
      { label: "B", text: "HOCパターン", explanation: "HOC（Higher-Order Component）はコンポーネントをラップして機能を追加するパターンですが、このコードではフックが使用されています。" },
      { label: "C", text: "Renderプロップパターン", explanation: "Renderプロップは関数をpropsとして渡すパターンですが、このコードはカスタムフックパターンです。" },
    ];
  } else if (hasComponent) {
    return [
      { label: "A", text: "関数コンポーネントパターン", explanation: "大文字で始まる関数がJSXを返しており、モダンなReactの関数コンポーネントパターンです。" },
      { label: "B", text: "クラスコンポーネントパターン", explanation: "classキーワードを使用していないため、クラスコンポーネントではありません。" },
      { label: "C", text: "コンテナコンポーネントパターン", explanation: "コンテナコンポーネントはロジックとUIを分離するパターンですが、このコードは関数コンポーネントパターンです。" },
    ];
  } else if (hasFactory) {
    return [
      { label: "A", text: "ファクトリパターン", explanation: "createXxxという関数名でオブジェクトを生成しており、ファクトリパターンが使用されています。" },
      { label: "B", text: "シングルトンパターン", explanation: "シングルトンは単一インスタンスを保証するパターンですが、このコードは新しいオブジェクトを生成しています。" },
      { label: "C", text: "ビルダーパターン", explanation: "ビルダーパターンはメソッドチェーンでオブジェクトを構築しますが、このコードはファクトリパターンです。" },
    ];
  } else if (hasObserver) {
    return [
      { label: "A", text: "オブザーバーパターン", explanation: "subscribe/observeなどのメソッドで、状態の変化を監視・通知するオブザーバーパターンです。" },
      { label: "B", text: "Pub/Subパターン", explanation: "Pub/Subは似ていますが、より疎結合なメッセージングパターンで、このコードはオブザーバーパターンです。" },
      { label: "C", text: "イベントエミッターパターン", explanation: "イベントエミッターも関連しますが、このコードはオブザーバーパターンの実装です。" },
    ];
  } else if (hasClass) {
    return [
      { label: "A", text: "オブジェクト指向パターン", explanation: "classキーワードを使用してオブジェクト指向のアプローチで実装されています。" },
      { label: "B", text: "関数型パターン", explanation: "関数型プログラミングは純粋関数と不変データを重視しますが、このコードはクラスベースです。" },
      { label: "C", text: "手続き型パターン", explanation: "手続き型は順次実行を重視しますが、このコードはオブジェクト指向パターンです。" },
    ];
  }

  return [
    { label: "A", text: "モジュールパターン", explanation: "関連する機能をモジュールとしてまとめて、外部に公開するインターフェースを制御しています。" },
    { label: "B", text: "ユーティリティパターン", explanation: "特定のユーティリティではなく、モジュールとして機能をまとめています。" },
    { label: "C", text: "プロシージャルパターン", explanation: "手続き的な処理よりも、モジュール化された構造が特徴です。" },
  ];
}

function generateDesignOptions(code: string, language: string): QuizOption[] {
  const hasAsync = code.includes("async") || code.includes("await");
  const hasErrorHandling = /try\s*{|catch\s*\(|\.catch\(/.test(code);
  const hasTyping = /:\s*\w+|interface\s+|type\s+/.test(code);
  const hasMemoization = /useMemo|useCallback|memo\(/.test(code);

  if (hasAsync && hasErrorHandling) {
    return [
      { label: "A", text: "非同期処理とエラーハンドリングの両立", explanation: "async/awaitとtry-catchを組み合わせることで、非同期処理のエラーを適切に捕捉し、ユーザー体験を損なわない堅牢な実装になっています。" },
      { label: "B", text: "シンプルな同期処理で十分", explanation: "このコードはAPIコールやファイル操作など非同期が必要な処理を含んでおり、同期処理では対応できません。" },
      { label: "C", text: "エラーハンドリングは不要", explanation: "非同期処理ではネットワークエラーなど予期しない問題が起こりうるため、エラーハンドリングは必須です。" },
    ];
  } else if (hasMemoization) {
    return [
      { label: "A", text: "パフォーマンス最適化のため", explanation: "useMemo/useCallbackを使用することで、不要な再計算や再レンダリングを防ぎ、特に重い計算やリストの処理でパフォーマンスが向上します。" },
      { label: "B", text: "コードの可読性のため", explanation: "メモ化はパフォーマンス最適化が目的であり、可読性の向上にはあまり寄与しません。" },
      { label: "C", text: "メモリ使用量削減のため", explanation: "実際にはメモ化はキャッシュを保持するためメモリを消費します。目的は再計算の防止です。" },
    ];
  } else if (hasTyping) {
    return [
      { label: "A", text: "型安全性と開発体験の向上", explanation: "TypeScriptの型定義により、コンパイル時にエラーを検出でき、IDEの補完機能も向上して開発効率が上がります。" },
      { label: "B", text: "ドキュメンテーションのため", explanation: "型はドキュメントとしても機能しますが、主目的は型チェックによるバグ防止と開発体験の向上です。" },
      { label: "C", text: "実行時エラーの防止", explanation: "TypeScriptはコンパイル時のチェックであり、実行時エラーの完全な防止は保証されません。" },
    ];
  }

  return [
    { label: "A", text: "保守性と拡張性のバランス", explanation: "適切な抽象化と明確な責務分離により、将来の変更や機能追加がしやすい設計になっています。" },
    { label: "B", text: "実装の簡潔さを優先", explanation: "簡潔さも重要ですが、このコードは保守性と拡張性を考慮した設計がされています。" },
    { label: "C", text: "パフォーマンスを優先", explanation: "パフォーマンスも考慮されていますが、主な設計判断は保守性と拡張性のバランスです。" },
  ];
}

function getHintFromCode(level: UnlockLevel, artifact: Artifact | null): string {
  const code = artifact?.content || "";

  if (level === 1) {
    if (/fetch|axios|api/i.test(code)) return "このコードはネットワーク通信を行っています。";
    if (/useState|setState/.test(code)) return "このコードは状態管理に関係しています。";
    if (/validate|schema/.test(code)) return "このコードはデータの検証を行っています。";
  }

  if (level === 2) {
    if (/use[A-Z]\w+/.test(code)) return "Reactのフックパターンが使われています。";
    if (/class\s+/.test(code)) return "クラスベースの設計が採用されています。";
    if (/createContext|Provider/.test(code)) return "Contextパターンが使われています。";
  }

  if (level === 3) {
    if (/async|await/.test(code)) return "非同期処理の取り扱いに注目してください。";
    if (/try\s*{|catch/.test(code)) return "エラーハンドリングの方針を考えてみてください。";
  }

  return "";
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
