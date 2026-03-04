import type { BrainstormPhase, PlanStep } from "@/types/chat";

/**
 * AIレスポンスから各フェーズの情報を抽出
 * キーワードマッチングではなく、内容の有無を確認
 */
export function extractPhaseInfoFromResponse(
  content: string,
  currentPhase: BrainstormPhase
): Record<string, string | null> {
  const extracted: Record<string, string | null> = {};

  switch (currentPhase) {
    case "verbalization": {
      const hasIdea =
        content.length > 50 &&
        (content.includes("という") ||
          content.includes("です") ||
          content.includes("サービス") ||
          content.includes("アプリ") ||
          content.includes("システム"));
      if (hasIdea) {
        const firstSentence = content.split(/[。！？\n]/)[0];
        extracted.ideaSummary = firstSentence.slice(0, 100);
      }
      break;
    }
    case "persona": {
      const targetPatterns = [
        /ターゲット(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
        /対象(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
        /(.+?)(?:向け|のため)/,
      ];
      for (const pattern of targetPatterns) {
        const match = content.match(pattern);
        if (match) {
          extracted.targetUser = match[1].trim().slice(0, 50);
          break;
        }
      }
      const painPatterns = [
        /課題(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
        /困っている(?:こと|点)(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
        /解決したい(?:こと|問題)(?:は|：|:)?\s*(.+?)(?:です|。|$)/,
      ];
      for (const pattern of painPatterns) {
        const match = content.match(pattern);
        if (match) {
          extracted.painPoint = match[1].trim().slice(0, 100);
          break;
        }
      }
      break;
    }
    case "market": {
      if (
        content.includes("競合") ||
        content.includes("類似") ||
        content.includes("既存")
      ) {
        extracted.competitors = "mentioned";
      }
      if (
        content.includes("差別化") ||
        content.includes("違い") ||
        content.includes("独自")
      ) {
        extracted.differentiation = "mentioned";
      }
      break;
    }
    case "technology": {
      const platformPatterns = [
        /(?:Web|ウェブ)(?:アプリ|サイト)/i,
        /モバイル(?:アプリ)?/,
        /(?:iOS|Android|iPhone)/i,
        /デスクトップ/,
      ];
      for (const pattern of platformPatterns) {
        if (pattern.test(content)) {
          extracted.platform =
            content.match(pattern)?.[0] || "mentioned";
          break;
        }
      }
      const techKeywords = [
        "React",
        "Next.js",
        "Vue",
        "Python",
        "Node",
        "TypeScript",
        "Firebase",
        "AWS",
      ];
      const mentionedTech = techKeywords.filter((tech) =>
        content.toLowerCase().includes(tech.toLowerCase())
      );
      if (mentionedTech.length > 0) {
        extracted.techStack = mentionedTech.join(", ");
      }
      break;
    }
    case "impact": {
      if (
        content.includes("価値") ||
        content.includes("メリット") ||
        content.includes("変わる") ||
        content.includes("できるようになる")
      ) {
        extracted.valueProposition = "mentioned";
      }
      break;
    }
    case "mvp": {
      if (
        content.includes("最小限") ||
        content.includes("コア機能") ||
        content.includes("必須機能") ||
        content.includes("まず")
      ) {
        extracted.coreFeatures = "mentioned";
      }
      break;
    }
    case "task-breakdown": {
      const taskPattern = /^[\s\-\•\*]*(\d+)[.）)]\s*(.+)$/gm;
      const matches = [...content.matchAll(taskPattern)];
      if (matches.length > 0) {
        extracted.tasks = `${matches.length}件`;
      }
      break;
    }
  }

  return extracted;
}

/**
 * 完了判定のキーワードを検出
 */
export function detectCompletionIntent(content: string): boolean {
  const completionPatterns = [
    /整理(?:でき|し)(?:ました|た)/,
    /(?:これで|以上で).*(?:完了|大丈夫|OK)/i,
    /次(?:に|の(?:ステップ|フェーズ))/,
    /進(?:みましょう|めましょう)/,
  ];
  return completionPatterns.some((pattern) => pattern.test(content));
}

/**
 * AIレスポンスから計画ステップを抽出
 */
export function extractPlanSteps(content: string): PlanStep[] {
  const stepPattern = /^[\s\-\•\*]*(\d+)[.）)]\s*(.+)$/gm;
  const matches = [...content.matchAll(stepPattern)];

  if (matches.length === 0) return [];

  return matches.map((match, index) => ({
    id: `step-${index + 1}`,
    title: match[2].trim(),
    completed: false,
    order: parseInt(match[1], 10),
  }));
}
