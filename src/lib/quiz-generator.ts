import type { StructuredQuiz, Artifact } from "@/types/chat";
import type { UnlockLevel, UnlockQuiz, QuizOption } from "@/hooks/useGenerationMode";

/**
 * Parse structured quiz from AI response
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

  // Fallback to template
  if (!question) {
    question = QUIZ_QUESTIONS[level][0];
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
    hint: `コードの${LEVEL_DESCRIPTIONS[level]}を考えてみてください。`,
  };
}

// Quiz question templates by level
const QUIZ_QUESTIONS: Record<UnlockLevel, string[]> = {
  1: [
    "このコードの主な目的は何ですか？",
    "このコードは何を達成しようとしていますか？",
    "この実装の目標は何ですか？",
  ],
  2: [
    "このコードで使われているデザインパターンは何ですか？",
    "この実装で採用されているアプローチは何ですか？",
    "このコードの構造はどのパターンに基づいていますか？",
  ],
  3: [
    "なぜこの書き方が選ばれたのでしょうか？",
    "別のアプローチではなく、この方法を選んだ理由は何ですか？",
    "この実装の利点は何ですか？",
  ],
  4: [], // Level 4 doesn't need quiz
};

const LEVEL_DESCRIPTIONS: Record<UnlockLevel, string> = {
  1: "目的",
  2: "パターンとアプローチ",
  3: "設計意図",
  4: "完了",
};

/**
 * Generate a fallback quiz based on code content and level
 * This is used when AI doesn't provide a structured quiz
 */
export function generateFallbackQuiz(
  level: UnlockLevel,
  artifact: Artifact | null
): UnlockQuiz {
  // Get a random question for this level
  const questions = QUIZ_QUESTIONS[level];
  const question = questions[Math.floor(Math.random() * questions.length)] || questions[0];

  // Analyze code to generate context-aware options
  const options = generateOptionsFromCode(level, artifact);

  return {
    level,
    question,
    options,
    correctLabel: "A",
    hint: `コードの${LEVEL_DESCRIPTIONS[level]}について考えてみてください。${getHintFromCode(level, artifact)}`,
  };
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
