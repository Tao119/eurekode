import type { LearningType } from "@/generated/prisma/client";

export type { LearningType };

/**
 * Learning data returned from API
 */
export interface Learning {
  id: string;
  userId: string;
  conversationId: string | null;
  projectId: string | null;
  content: string;
  tags: string[];
  type: LearningType;
  createdAt: string;
  conversation?: {
    id: string;
    title: string | null;
    mode: string;
  } | null;
  project?: {
    id: string;
    title: string;
    projectType: "product" | "learning";
  } | null;
}

/**
 * Request body for creating a new learning
 */
export interface CreateLearningRequest {
  content: string;
  tags: string[];
  type: LearningType;
  conversationId?: string;
  projectId?: string;
}

/**
 * Request body for updating a learning
 */
export interface UpdateLearningRequest {
  content?: string;
  tags?: string[];
}

/**
 * Filter options for listing learnings
 */
export interface LearningsFilter {
  type?: LearningType;
  tags?: string[];
  search?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}

/**
 * Paginated learnings response
 */
export interface LearningsResponse {
  items: Learning[];
  total: number;
  hasMore: boolean;
}
