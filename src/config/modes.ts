import type { ChatMode } from "@/types/chat";

export interface ModeConfig {
  title: string;
  description: string;
  shortDescription: string;
  icon: string;
  color: string;
  bgColor: string;
  hoverBgColor: string;
  href: string;
}

export const MODE_CONFIG: Record<ChatMode, ModeConfig> = {
  explanation: {
    title: "解説モード",
    description: "コードの構造や文法をAIが丁寧に解説します。初心者の方におすすめです。",
    shortDescription: "コードの仕組みを理解しよう",
    icon: "menu_book",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    hoverBgColor: "hover:bg-blue-500/5",
    href: "/chat/explanation",
  },
  generation: {
    title: "生成モード",
    description: "実装したい機能を言葉で伝えて、最適なコードスニペットを生成します。",
    shortDescription: "実装したい機能を言葉で伝えよう",
    icon: "bolt",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    hoverBgColor: "hover:bg-yellow-500/5",
    href: "/chat/generation",
  },
  brainstorm: {
    title: "壁打ちモード",
    description: "設計の悩みやアイデア出しをAIと対話しながら深めることができます。",
    shortDescription: "設計やアイデアを一緒に考えよう",
    icon: "lightbulb",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    hoverBgColor: "hover:bg-purple-500/5",
    href: "/chat/brainstorm",
  },
};

// Common sizes for consistency
export const MODE_ICON_SIZES = {
  // Card (home page)
  card: {
    container: "size-12",
    icon: "text-3xl",
  },
  // Chat header
  header: {
    container: "size-10",
    icon: "text-2xl",
  },
  // Welcome screen
  welcome: {
    container: "size-20",
    icon: "text-5xl",
  },
} as const;
