import type { ChatMode } from "@/types/chat";

/**
 * ユーザー入力からチャットモードを自動判定する
 *
 * 判定ロジック:
 * 1. コード/エラー/技術用語が含まれる → explanation（解説モード）
 * 2. 作成/実装/開発の意図 → generation（生成モード）
 * 3. 相談/議論/アイデアの意図 → brainstorm（壁打ちモード）
 * 4. デフォルト → explanation
 */
export function detectChatMode(content: string): ChatMode {
  const normalizedContent = content.toLowerCase();

  // コードブロックやエラーメッセージのパターン
  const codePatterns = [
    /```[\s\S]*```/, // コードブロック
    /`[^`]+`/, // インラインコード
    /error:|exception:|failed:|undefined|null pointer|syntax error/i,
    /import\s+[\w{},\s]+\s+from/i, // ES import
    /require\s*\(/i, // CommonJS require
    /function\s+\w+\s*\(/i, // 関数定義
    /const\s+\w+\s*=/i, // 変数定義
    /=>\s*{/, // アロー関数
    /class\s+\w+/i, // クラス定義
    /\w+\.\w+\(/, // メソッド呼び出し
  ];

  // 解説モードのキーワード
  const explanationKeywords = [
    "説明",
    "教えて",
    "わからない",
    "分からない",
    "なぜ",
    "どうして",
    "どういう意味",
    "とは",
    "について",
    "仕組み",
    "原因",
    "エラー",
    "バグ",
    "うまくいかない",
    "動かない",
    "理解",
    "解説",
    "違い",
    "比較",
    "どっちがいい",
    "どちらがいい",
    "ベストプラクティス",
    "なんで",
  ];

  // 生成モードのキーワード
  const generationKeywords = [
    "作って",
    "作りたい",
    "作成",
    "実装",
    "実装して",
    "開発",
    "書いて",
    "コード",
    "生成",
    "作る",
    "追加",
    "追加して",
    "機能",
    "ファイル",
    "コンポーネント",
    "api",
    "エンドポイント",
    "作成して",
    "してほしい",
    "を書いて",
    "できる",
    "作り方",
    "サンプル",
    "テンプレート",
  ];

  // 壁打ちモードのキーワード
  const brainstormKeywords = [
    "相談",
    "どう思う",
    "どう思い",
    "意見",
    "アドバイス",
    "悩んで",
    "迷って",
    "アイデア",
    "案",
    "考え",
    "設計",
    "アーキテクチャ",
    "構成",
    "方針",
    "戦略",
    "どうすれば",
    "どうしたら",
    "良いと思う",
    "いいと思う",
    "判断",
    "検討",
    "議論",
    "ディスカッション",
    "ブレスト",
    "壁打ち",
  ];

  // コードパターンチェック（最優先で解説モードへ）
  for (const pattern of codePatterns) {
    if (pattern.test(content)) {
      return "explanation";
    }
  }

  // キーワードスコアリング
  const scores: Record<ChatMode, number> = {
    explanation: 0,
    generation: 0,
    brainstorm: 0,
  };

  // 各モードのキーワードマッチをカウント
  for (const keyword of explanationKeywords) {
    if (normalizedContent.includes(keyword)) {
      scores.explanation += 1;
    }
  }

  for (const keyword of generationKeywords) {
    if (normalizedContent.includes(keyword)) {
      scores.generation += 1;
    }
  }

  for (const keyword of brainstormKeywords) {
    if (normalizedContent.includes(keyword)) {
      scores.brainstorm += 1;
    }
  }

  // 最高スコアのモードを返す
  const maxScore = Math.max(scores.explanation, scores.generation, scores.brainstorm);

  if (maxScore === 0) {
    // マッチなしの場合はデフォルトで解説モード
    return "explanation";
  }

  // 同スコアの場合の優先順位: brainstorm > generation > explanation
  if (scores.brainstorm === maxScore) {
    return "brainstorm";
  }
  if (scores.generation === maxScore) {
    return "generation";
  }
  return "explanation";
}

/**
 * モード判定結果の詳細を返す（デバッグ/UI表示用）
 */
export interface ModeDetectionResult {
  mode: ChatMode;
  confidence: "high" | "medium" | "low";
  scores: Record<ChatMode, number>;
  matchedPatterns: string[];
}

export function detectChatModeWithDetails(content: string): ModeDetectionResult {
  const normalizedContent = content.toLowerCase();
  const matchedPatterns: string[] = [];

  // コードブロックやエラーメッセージのパターン
  const codePatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /```[\s\S]*```/, name: "code_block" },
    { pattern: /`[^`]+`/, name: "inline_code" },
    { pattern: /error:|exception:|failed:/i, name: "error_message" },
    { pattern: /import\s+[\w{},\s]+\s+from/i, name: "es_import" },
    { pattern: /function\s+\w+\s*\(/i, name: "function_def" },
    { pattern: /const\s+\w+\s*=/i, name: "variable_def" },
  ];

  // コードパターンチェック
  for (const { pattern, name } of codePatterns) {
    if (pattern.test(content)) {
      matchedPatterns.push(name);
    }
  }

  if (matchedPatterns.length > 0) {
    return {
      mode: "explanation",
      confidence: "high",
      scores: { explanation: 10, generation: 0, brainstorm: 0 },
      matchedPatterns,
    };
  }

  // キーワードスコアリング
  const scores: Record<ChatMode, number> = {
    explanation: 0,
    generation: 0,
    brainstorm: 0,
  };

  const keywordMappings: Array<{ keywords: string[]; mode: ChatMode }> = [
    {
      keywords: [
        "説明",
        "教えて",
        "わからない",
        "なぜ",
        "どうして",
        "とは",
        "について",
        "仕組み",
        "エラー",
        "バグ",
      ],
      mode: "explanation",
    },
    {
      keywords: [
        "作って",
        "作りたい",
        "作成",
        "実装",
        "開発",
        "書いて",
        "コード",
        "生成",
        "追加",
        "機能",
      ],
      mode: "generation",
    },
    {
      keywords: [
        "相談",
        "どう思う",
        "意見",
        "アドバイス",
        "悩んで",
        "迷って",
        "アイデア",
        "設計",
        "アーキテクチャ",
        "方針",
      ],
      mode: "brainstorm",
    },
  ];

  for (const { keywords, mode } of keywordMappings) {
    for (const keyword of keywords) {
      if (normalizedContent.includes(keyword)) {
        scores[mode] += 1;
        matchedPatterns.push(`${mode}:${keyword}`);
      }
    }
  }

  const maxScore = Math.max(scores.explanation, scores.generation, scores.brainstorm);
  const totalScore = scores.explanation + scores.generation + scores.brainstorm;

  let mode: ChatMode;
  if (maxScore === 0) {
    mode = "explanation";
  } else if (scores.brainstorm === maxScore) {
    mode = "brainstorm";
  } else if (scores.generation === maxScore) {
    mode = "generation";
  } else {
    mode = "explanation";
  }

  // 信頼度の計算
  let confidence: "high" | "medium" | "low";
  if (maxScore >= 3 && maxScore / totalScore > 0.6) {
    confidence = "high";
  } else if (maxScore >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    mode,
    confidence,
    scores,
    matchedPatterns,
  };
}
