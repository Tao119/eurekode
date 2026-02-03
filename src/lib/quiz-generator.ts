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
 * Important: Always generates code-specific "なぜ？" questions with matching reason-based options
 */
export function generateFallbackQuiz(
  level: UnlockLevel,
  artifact: Artifact | null
): UnlockQuiz {
  const code = artifact?.content || "";
  const language = artifact?.language || "javascript";

  // Generate a specific question based on actual code content
  const question = generateCodeSpecificQuestion(code, language);

  // Generate options that match the "なぜ〜？" question format
  const options = generateReasonBasedOptions(code, question);

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
 * Generate reason-based options that match "なぜ〜？" questions
 * Options should explain WHY something was done, not WHAT pattern it is
 */
function generateReasonBasedOptions(code: string, question: string): QuizOption[] {
  // async/await 関連
  if (question.includes("async") || question.includes("await")) {
    if (question.includes("try-catch")) {
      return [
        { label: "A", text: "非同期処理のエラーをキャッチして適切に処理するため", explanation: "async/awaitでのエラーはtry-catchでキャッチする必要があります。Promiseのrejectがそのままスローされます。" },
        { label: "B", text: "同期処理のエラーをキャッチするため", explanation: "try-catchは同期エラーもキャッチしますが、ここではawaitによる非同期エラーの処理が主目的です。" },
        { label: "C", text: "パフォーマンスを向上させるため", explanation: "try-catchはパフォーマンス向上ではなく、エラーハンドリングのために使用します。" },
      ];
    }
    return [
      { label: "A", text: "非同期処理を同期的な書き方で読みやすくするため", explanation: "async/awaitを使うと、Promiseチェーンよりも直感的で読みやすいコードになります。" },
      { label: "B", text: "処理を並列実行するため", explanation: "async/await自体は並列化しません。並列化にはPromise.allなどが必要です。" },
      { label: "C", text: "同期処理を非同期にするため", explanation: "async/awaitは既存の非同期処理を扱いやすくするもので、同期処理を非同期にはしません。" },
    ];
  }

  // useCallback 関連
  if (question.includes("useCallback")) {
    return [
      { label: "A", text: "不要な再レンダリングを防ぎ、パフォーマンスを最適化するため", explanation: "useCallbackで関数をメモ化することで、依存配列が変わらない限り同じ参照を保持し、子コンポーネントの不要な再レンダリングを防ぎます。" },
      { label: "B", text: "関数の実行を遅延させるため", explanation: "useCallbackは実行を遅延させません。関数の参照を安定させるために使用します。" },
      { label: "C", text: "関数の戻り値をキャッシュするため", explanation: "関数の戻り値をキャッシュするのはuseMemoです。useCallbackは関数自体をメモ化します。" },
    ];
  }

  // useMemo 関連
  if (question.includes("useMemo")) {
    return [
      { label: "A", text: "計算コストの高い処理結果をキャッシュし、パフォーマンスを最適化するため", explanation: "useMemoは依存配列が変わらない限り前回の計算結果を再利用し、不要な再計算を防ぎます。" },
      { label: "B", text: "関数をメモ化するため", explanation: "関数をメモ化するのはuseCallbackです。useMemoは値（計算結果）をメモ化します。" },
      { label: "C", text: "状態を永続化するため", explanation: "状態の永続化はuseStateやuseRefで行います。useMemoは計算結果のキャッシュ用です。" },
    ];
  }

  // useEffect 依存配列 関連
  if (question.includes("useEffect") && question.includes("依存配列")) {
    return [
      { label: "A", text: "コンポーネントのマウント時に一度だけ実行するため", explanation: "空の依存配列[]を指定すると、effectはマウント時にのみ実行され、再レンダリング時には実行されません。" },
      { label: "B", text: "すべてのレンダリング時に実行するため", explanation: "すべてのレンダリング時に実行するには、依存配列自体を省略します。空配列はマウント時のみです。" },
      { label: "C", text: "エラーを防ぐため", explanation: "空の依存配列はエラー防止ではなく、実行タイミングの制御のために使用します。" },
    ];
  }

  // reduce 関連
  if (question.includes("reduce")) {
    return [
      { label: "A", text: "配列が空の場合にエラーを防ぎ、初期値から計算を開始するため", explanation: "reduceに初期値を渡すと、空配列でもエラーにならず、その値から集計を開始します。" },
      { label: "B", text: "処理を高速化するため", explanation: "初期値はパフォーマンスには影響しません。空配列対策と計算の起点設定が目的です。" },
      { label: "C", text: "型推論を助けるため", explanation: "TypeScriptでは型推論に役立ちますが、主な目的は空配列対策と計算の起点設定です。" },
    ];
  }

  // オプショナルチェイニング 関連
  if (question.includes("オプショナルチェイニング") || question.includes("?.")) {
    return [
      { label: "A", text: "プロパティがnull/undefinedの場合にエラーを防ぐため", explanation: "?.を使うと、途中のプロパティがnull/undefinedでもエラーにならず、undefinedを返します。" },
      { label: "B", text: "コードを短くするため", explanation: "コードは短くなりますが、主目的はnull/undefined時の安全なアクセスです。" },
      { label: "C", text: "パフォーマンスを向上させるため", explanation: "オプショナルチェイニングはパフォーマンス向上ではなく、安全なプロパティアクセスのために使用します。" },
    ];
  }

  // Null合体演算子 関連
  if (question.includes("Null合体") || question.includes("??")) {
    return [
      { label: "A", text: "値がnull/undefinedの場合にデフォルト値を設定するため", explanation: "??はnullまたはundefinedの時のみ右辺を返します。0や空文字はそのまま使用されます。" },
      { label: "B", text: "falsyな値すべてにデフォルト値を設定するため", explanation: "falsyな値すべてにデフォルトを設定するのは||です。??はnull/undefinedのみ対象です。" },
      { label: "C", text: "型変換を行うため", explanation: "??は型変換を行いません。デフォルト値の設定のみが目的です。" },
    ];
  }

  // スプレッド演算子 関連
  if (question.includes("スプレッド") || question.includes("...")) {
    return [
      { label: "A", text: "配列やオブジェクトを展開してコピー・結合するため", explanation: "スプレッド演算子で要素を展開し、新しい配列/オブジェクトを作成したり、既存のものと結合できます。" },
      { label: "B", text: "参照を共有するため", explanation: "スプレッド演算子は浅いコピーを作成します。参照の共有ではなく、新しい参照を作ります。" },
      { label: "C", text: "型を変換するため", explanation: "スプレッド演算子は型変換を行いません。展開とコピーが目的です。" },
    ];
  }

  // 分割代入 関連
  if (question.includes("分割代入")) {
    return [
      { label: "A", text: "オブジェクト/配列から必要なプロパティだけを簡潔に取り出すため", explanation: "分割代入により、長いアクセス記法を使わずに必要な値だけを変数に取り出せます。" },
      { label: "B", text: "元のオブジェクトを変更するため", explanation: "分割代入は元のオブジェクトを変更しません。値を抽出するだけです。" },
      { label: "C", text: "パフォーマンスを向上させるため", explanation: "分割代入はパフォーマンス向上ではなく、コードの可読性向上が主な目的です。" },
    ];
  }

  // try-catch 関連
  if (question.includes("try-catch") || question.includes("例外")) {
    return [
      { label: "A", text: "エラーが発生してもプログラムがクラッシュせず、適切に処理できるため", explanation: "try-catchでエラーをキャッチすることで、エラー時の処理を制御し、ユーザーに適切なフィードバックを提供できます。" },
      { label: "B", text: "エラーを無視するため", explanation: "エラーを無視するのではなく、キャッチして適切に処理することが目的です。" },
      { label: "C", text: "処理を高速化するため", explanation: "try-catchはエラーハンドリングのためで、パフォーマンス向上が目的ではありません。" },
    ];
  }

  // 型チェック 関連
  if (question.includes("型チェック")) {
    return [
      { label: "A", text: "実行時に値の型を確認し、型に応じた処理を行うため", explanation: "typeofやinstanceofで型を確認し、型に応じて異なる処理を行うことで、より堅牢なコードになります。" },
      { label: "B", text: "コンパイル時のエラーを防ぐため", explanation: "コンパイル時の型チェックはTypeScriptが行います。typeof/instanceofは実行時のチェックです。" },
      { label: "C", text: "パフォーマンスを向上させるため", explanation: "型チェックはパフォーマンス向上ではなく、安全性と正確性のために使用します。" },
    ];
  }

  // デフォルト値 関連
  if (question.includes("デフォルト値")) {
    return [
      { label: "A", text: "値が未定義の場合に安全な初期状態を確保するため", explanation: "デフォルト値を設定することで、undefinedやnullによるエラーを防ぎ、プログラムを安定させます。" },
      { label: "B", text: "メモリを節約するため", explanation: "デフォルト値はメモリ節約のためではなく、安全な初期状態の確保が目的です。" },
      { label: "C", text: "型推論を助けるため", explanation: "TypeScriptでは型推論に役立ちますが、主な目的は安全な初期状態の確保です。" },
    ];
  }

  // 早期リターン 関連
  if (question.includes("早期リターン")) {
    return [
      { label: "A", text: "条件を満たさない場合に早めに処理を終了し、ネストを減らすため", explanation: "早期リターンにより、if-elseのネストが深くならず、コードが読みやすくなります。" },
      { label: "B", text: "処理を高速化するため", explanation: "早期リターンは可読性向上が主目的で、パフォーマンスへの影響は限定的です。" },
      { label: "C", text: "エラーを無視するため", explanation: "早期リターンはエラーを無視するのではなく、条件に基づいて処理を制御します。" },
    ];
  }

  // デフォルトの選択肢（汎用的な理由ベース）
  return [
    { label: "A", text: "コードの可読性と保守性を向上させるため", explanation: "この実装方法により、コードが読みやすく、将来の変更にも対応しやすくなります。" },
    { label: "B", text: "パフォーマンスを最優先にするため", explanation: "この実装の主目的は可読性と保守性の向上です。" },
    { label: "C", text: "特に理由はなく慣習的に使用している", explanation: "この実装には明確な理由があり、コードの品質向上に貢献しています。" },
  ];
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
