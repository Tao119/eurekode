import type { UserType, IndividualPlan, OrganizationPlan } from "@/generated/prisma/client";

/**
 * Subscription plan type (union of individual and organization plans)
 * Note: This is for session/runtime use. Database uses separate enums.
 */
export type SubscriptionPlan = IndividualPlan | OrganizationPlan;

export interface UserSettings {
  quizEnabled: boolean;
  explanationDetail: "simple" | "standard" | "detailed";
  unlockMethod: "quiz" | "explanation" | "skip";
  hintSpeed: "immediate" | "30sec" | "none";
  estimationTraining: boolean;
  unlockSkipAllowed: boolean; // Allow skipping unlock in generation mode (individual users only)
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
  unlockSkipAllowed: false,
};

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  allowedModes: ["explanation", "generation", "brainstorm"],
  allowedTechStacks: [],
  unlockSkipAllowed: false,
  reflectionRequired: false,
  defaultDailyTokenLimit: 1000,
};
