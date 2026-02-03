import type { UserType, SubscriptionPlan } from "@/generated/prisma/client";

export interface UserSettings {
  quizEnabled: boolean;
  explanationDetail: "simple" | "standard" | "detailed";
  unlockMethod: "quiz" | "explanation" | "skip";
  hintSpeed: "immediate" | "30sec" | "none";
  estimationTraining: boolean;
}

export interface OrganizationSettings {
  allowedModes: ("explanation" | "generation" | "brainstorm")[];
  allowedTechStacks: string[];
  unlockSkipAllowed: boolean;
  reflectionRequired: boolean;
  defaultDailyTokenLimit: number;
}

export interface AccessKeySettings {
  allowedModes: ("explanation" | "generation" | "brainstorm")[];
  allowedTechStacks: string[];
  unlockSkipAllowed: boolean;
}

export interface SessionUser {
  id: string;
  email: string | null;
  displayName: string;
  userType: UserType;
  organizationId: string | null;
  plan: SubscriptionPlan;
  dailyTokenLimit: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  quizEnabled: true,
  explanationDetail: "standard",
  unlockMethod: "quiz",
  hintSpeed: "30sec",
  estimationTraining: true,
};

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  allowedModes: ["explanation", "generation", "brainstorm"],
  allowedTechStacks: [],
  unlockSkipAllowed: false,
  reflectionRequired: false,
  defaultDailyTokenLimit: 1000,
};
