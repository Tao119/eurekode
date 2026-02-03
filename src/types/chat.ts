import type { ChatMode } from "@/generated/prisma/client";

export type { ChatMode };

export interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

// Represents a conversation branch
export interface ConversationBranch {
  id: string;
  name: string;
  parentBranchId?: string;
  forkPointIndex: number; // Index in parent branch where fork occurred
  createdAt: string;
}

// Extended chat state with branching support
export interface ChatBranchState {
  branches: ConversationBranch[];
  currentBranchId: string;
  messagesByBranch: Record<string, Message[]>;
}

export interface MessageMetadata {
  // インタラクティブ要素
  quiz?: QuizData;
  quickReplies?: QuickReply[];
  codeBlock?: CodeBlockData;

  // 生成モード用
  unlockLevel?: number;
  unlockProgress?: UnlockProgress;

  // 壁打ちモード用
  brainstormPhase?: BrainstormPhase;
  planSteps?: PlanStep[];

  // 共通
  type?: MessageType;
  insightSuggestion?: InsightSuggestion;
}

export type MessageType =
  | "thinking"
  | "quiz"
  | "code"
  | "explanation"
  | "quick-reply"
  | "unlock-challenge"
  | "phase-transition"
  | "insight";

// ===========================================
// Quiz System (省力化設計)
// ===========================================

export interface QuizData {
  id?: string;
  question: string;
  options: QuizOption[];
  correctAnswer: number;
  userAnswer?: number;
  explanation?: string;
  // 自動進行設定
  autoAdvance?: boolean;
  // ヒント表示設定
  showHintOnWrong?: boolean;
  hintDelay?: number; // milliseconds
}

export interface QuizOption {
  id: number;
  text: string;
  // オプション: アイコンや補足説明
  icon?: string;
  description?: string;
}

export interface QuizResult {
  quizId: string;
  answerId: number;
  isCorrect: boolean;
  timestamp: string;
}

// ===========================================
// Quick Replies (ワンクリック回答)
// ===========================================

export interface QuickReply {
  id: string;
  label: string;
  value: string;
  // スタイルバリアント
  variant?: "default" | "primary" | "secondary" | "outline";
  // アイコン（オプション）
  icon?: string;
  // グループ化（カテゴリ分け）
  group?: string;
}

// ===========================================
// Code Block & Unlock System
// ===========================================

export interface CodeBlockData {
  language: string;
  code: string;
  filename?: string;
  lineNumbers?: boolean;
  // 段階アンロック用
  blurLevel?: BlurLevel;
  highlightedLines?: number[];
}

export type BlurLevel = 0 | 1 | 2 | 3 | 4; // 0 = 完全表示, 4 = 最大ぼかし

export interface UnlockProgress {
  currentLevel: number; // 1-4
  maxLevel: number; // 4
  challenges: UnlockChallenge[];
  isFullyUnlocked: boolean;
}

export interface UnlockChallenge {
  level: number;
  question: string;
  type: "quiz" | "explanation" | "acknowledgment";
  completed: boolean;
  // quiz の場合
  quizData?: QuizData;
  // explanation の場合
  explanationPoints?: string[];
  // acknowledgment の場合（「理解した」ボタン）
  acknowledgmentText?: string;
}

// ===========================================
// Brainstorm Mode (壁打ちモード)
// ===========================================

// 壁打ちのサブモード
export type BrainstormSubMode = "casual" | "planning";

export interface BrainstormSubModeConfig {
  mode: BrainstormSubMode;
  title: string;
  description: string;
  icon: string;
}

export const BRAINSTORM_SUB_MODES: BrainstormSubModeConfig[] = [
  {
    mode: "casual",
    title: "壁打ちモード",
    description: "気軽にアイデアを相談",
    icon: "chat_bubble",
  },
  {
    mode: "planning",
    title: "企画書モード",
    description: "ステップに沿って企画を整理",
    icon: "description",
  },
];

export type BrainstormPhase =
  | "verbalization"    // 言語化
  | "persona"          // ペルソナ明確化
  | "market"           // 市場検証
  | "technology"       // 技術検証
  | "impact"           // インパクト検証
  | "mvp"              // MVP定義
  | "task-breakdown";  // タスク分解

export interface BrainstormPhaseConfig {
  phase: BrainstormPhase;
  title: string;
  description: string;
  icon: string;
  quickReplies?: QuickReply[];
}

export const BRAINSTORM_PHASES: BrainstormPhaseConfig[] = [
  {
    phase: "verbalization",
    title: "言語化",
    description: "アイデアを一言で表現しましょう",
    icon: "edit_note",
    quickReplies: [
      { id: "v1", label: "タスク管理系", value: "タスクや予定を管理するアプリを作りたい", variant: "outline" },
      { id: "v2", label: "学習支援系", value: "学習を支援するツールを作りたい", variant: "outline" },
      { id: "v3", label: "コミュニティ系", value: "人をつなげるサービスを作りたい", variant: "outline" },
      { id: "v4", label: "自動化系", value: "面倒な作業を自動化したい", variant: "outline" },
    ],
  },
  {
    phase: "persona",
    title: "ペルソナ",
    description: "誰のどんな課題を解決しますか？",
    icon: "person_search",
    quickReplies: [
      { id: "p1", label: "学生", value: "ターゲットは学生です", variant: "outline" },
      { id: "p2", label: "社会人", value: "ターゲットは社会人です", variant: "outline" },
      { id: "p3", label: "エンジニア", value: "ターゲットはエンジニアです", variant: "outline" },
      { id: "p4", label: "その他", value: "ターゲットについて詳しく説明します", variant: "outline" },
    ],
  },
  {
    phase: "market",
    title: "市場検証",
    description: "類似サービスとの違いを考えましょう",
    icon: "search",
  },
  {
    phase: "technology",
    title: "技術検証",
    description: "必要な技術スタックを洗い出しましょう",
    icon: "code",
    quickReplies: [
      { id: "t1", label: "Webアプリ", value: "Webアプリとして作りたい", variant: "outline" },
      { id: "t2", label: "モバイルアプリ", value: "モバイルアプリとして作りたい", variant: "outline" },
      { id: "t3", label: "デスクトップ", value: "デスクトップアプリとして作りたい", variant: "outline" },
      { id: "t4", label: "まだ決まっていない", value: "プラットフォームはまだ決まっていない", variant: "outline" },
    ],
  },
  {
    phase: "impact",
    title: "インパクト",
    description: "このサービスが成功したら世界はどう変わる？",
    icon: "rocket_launch",
  },
  {
    phase: "mvp",
    title: "MVP定義",
    description: "最小限の検証に必要な機能を絞りましょう",
    icon: "flag",
  },
  {
    phase: "task-breakdown",
    title: "タスク分解",
    description: "実装ステップを整理しましょう",
    icon: "checklist",
  },
];

export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  estimatedTime?: string;
  estimatedMinutes?: number;
  completed: boolean;
  order?: number;
  subSteps?: PlanStep[];
}

// ===========================================
// Insight & Learning System
// ===========================================

export interface InsightSuggestion {
  title: string;
  content: string;
  tags: string[];
  // ワンクリック保存
  autoSave?: boolean;
}

export interface LearningInsight {
  id: string;
  userId: string;
  conversationId?: string;
  content: string;
  tags: string[];
  type: "insight" | "reflection";
  createdAt: string;
}

export interface ReflectionData {
  // 簡易振り返り（絵文字選択）
  quickReflection?: "good" | "okay" | "difficult";
  // 詳細振り返り（オプション）
  detailedReflection?: {
    whatDid: string;      // 何をした？
    whatLearned: string;  // 何がわかった？
    whyHappened: string;  // なぜそうなった？
    whatNext: string;     // 次どうする？
  };
}

export interface ConversationMetadata {
  options: ChatOptions;
  state: ChatState;
  // 分岐状態（履歴から復元用）
  branchState?: ChatBranchState;
  // 壁打ちモード状態（履歴から復元用）
  brainstormState?: BrainstormModeState;
  // 最後にアクティブだった分岐ID
  lastActiveBranchId?: string;
}

// 壁打ちモードの状態（永続化用）
export interface BrainstormModeState {
  subMode: BrainstormSubMode;
  currentPhase: BrainstormPhase;
  completedPhases: BrainstormPhase[];
  ideaSummary: string | null;
  persona: string | null;
  competitors: string[];
  techStack: string[];
  mvpFeatures: string[];
  planSteps: PlanStep[];
  insights: string[];
}

// ===========================================
// Chat Options (各モード設定)
// ===========================================

export interface ChatOptions {
  // 解説モード
  quizEnabled: boolean;
  explanationDetail: "simple" | "standard" | "detailed";
  relatedCodeEnabled: boolean;
  // 生成モード
  unlockMethod: "quiz" | "explanation" | "skip";
  hintSpeed: "immediate" | "30sec" | "none";
  estimationTraining: boolean;
  // 壁打ちモード
  webSearchEnabled: boolean;
  // 共通
  autoAdvance: boolean;
}

export interface ChatState {
  // 生成モード
  unlockLevel?: number;
  quizAttempts?: number;
  hintsUsed?: number;
  estimatedTime?: number;
  actualTime?: number;
  // 壁打ちモード
  currentPhase?: BrainstormPhase;
  phaseHistory?: BrainstormPhase[];
  // 共通
  messageCount: number;
  tokensUsed: number;
}

export interface ExplanationModeOptions {
  quizEnabled: boolean;
  explanationDetail: "simple" | "standard" | "detailed";
  relatedCodeEnabled: boolean;
}

export interface GenerationModeOptions {
  unlockMethod: "quiz" | "explanation" | "skip";
  hintSpeed: "immediate" | "30sec" | "none";
  estimationTraining: boolean;
}

export interface BrainstormModeOptions {
  webSearchEnabled: boolean;
}

export const DEFAULT_EXPLANATION_OPTIONS: ExplanationModeOptions = {
  quizEnabled: true,
  explanationDetail: "standard",
  relatedCodeEnabled: false,
};

export const DEFAULT_GENERATION_OPTIONS: GenerationModeOptions = {
  unlockMethod: "quiz",
  hintSpeed: "30sec",
  estimationTraining: true,
};

export const DEFAULT_BRAINSTORM_OPTIONS: BrainstormModeOptions = {
  webSearchEnabled: false,
};

export const DEFAULT_CHAT_OPTIONS: ChatOptions = {
  ...DEFAULT_EXPLANATION_OPTIONS,
  ...DEFAULT_GENERATION_OPTIONS,
  ...DEFAULT_BRAINSTORM_OPTIONS,
  autoAdvance: true,
};

export const DEFAULT_CHAT_STATE: ChatState = {
  messageCount: 0,
  tokensUsed: 0,
};

// ===========================================
// Conversation Types (Project-centric)
// ===========================================

export interface Conversation {
  id: string;
  userId: string;
  mode: ChatMode;
  title?: string | null;
  messages: Message[];
  tokensConsumed: number;
  metadata?: ConversationMetadata | null;
  generationStatus: "idle" | "generating" | "completed" | "failed";
  pendingContent?: string | null;
  generationError?: string | null;
  // Project-centric fields
  projectId?: string | null;
  isOrganized: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations (when included)
  project?: {
    id: string;
    title: string;
    projectType: "product" | "learning";
  } | null;
}

export interface ConversationsFilter {
  mode?: ChatMode;
  projectId?: string;
  isOrganized?: boolean;
  search?: string;
}

export interface ConversationsResponse {
  items: Conversation[];
  total: number;
  hasMore: boolean;
}

// 会話整理用
export interface OrganizeConversationRequest {
  projectId?: string;
  createProject?: {
    name: string;
    projectType: "product" | "learning";
  };
  convertToLearning?: boolean;
}

// ===========================================
// API Types
// ===========================================

export interface ChatRequest {
  mode: ChatMode;
  messages: Message[];
  options?: Partial<ChatOptions>;
  conversationId?: string;
  projectId?: string; // プロジェクトに紐づけて会話を開始
}

export interface ChatResponse {
  content: string;
  metadata?: MessageMetadata;
  tokensUsed: number;
  conversationId: string;
}

export interface StreamChunk {
  content?: string;
  metadata?: Partial<MessageMetadata>;
  done?: boolean;
  error?: string;
}

// ===========================================
// Artifact System (生成モード用)
// ===========================================

export interface Artifact {
  id: string;
  type: "code" | "component" | "config";
  title: string;
  content: string;
  language?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StructuredQuiz {
  level: 1 | 2 | 3 | 4;
  question: string;
  options: { label: string; text: string }[];
  correctLabel: string;
  hint?: string;
}

// ===========================================
// Interactive Quiz Form (複合クイズ)
// ===========================================

export type InteractiveQuestionType = "choice" | "fill" | "text";

export interface InteractiveQuestion {
  id: string;
  type: InteractiveQuestionType;
  // For choice type
  options?: { label: string; text: string }[];
  // For fill type - the placeholder text (e.g., "????")
  placeholder?: string;
  // Context text before the question
  contextBefore?: string;
  // Context text after the question (for fill type)
  contextAfter?: string;
  // Full question text (for text type)
  questionText?: string;
}

export interface InteractiveQuizForm {
  questions: InteractiveQuestion[];
  contentWithoutQuestions: string;
}
