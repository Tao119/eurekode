"use client";

import { useState, useCallback, useEffect } from "react";
import type { InsightSuggestion, ReflectionData } from "@/types/chat";
import type {
  Learning,
  LearningsFilter,
  CreateLearningRequest,
  UpdateLearningRequest,
  LearningsResponse,
  LearningType,
} from "@/types/learning";

interface UseLearningsOptions {
  initialLimit?: number;
  autoFetch?: boolean;
  initialFilter?: LearningsFilter;
  onError?: (error: Error) => void;
}

interface UseLearningsReturn {
  learnings: Learning[];
  isLoading: boolean;
  error: Error | null;
  total: number;
  hasMore: boolean;
  filters: LearningsFilter;
  fetchLearnings: (options?: { offset?: number; append?: boolean }) => Promise<void>;
  createLearning: (data: CreateLearningRequest) => Promise<Learning | null>;
  updateLearning: (id: string, data: UpdateLearningRequest) => Promise<Learning | null>;
  deleteLearning: (id: string) => Promise<boolean>;
  setFilters: (filters: LearningsFilter) => void;
  refetch: () => Promise<void>;
  // Legacy methods for backwards compatibility
  saveInsight: (
    insight: InsightSuggestion,
    conversationId?: string
  ) => Promise<Learning | null>;
  saveReflection: (
    reflection: ReflectionData,
    conversationId?: string
  ) => Promise<Learning | null>;
}

export function useLearnings(options: UseLearningsOptions = {}): UseLearningsReturn {
  const { initialLimit = 20, autoFetch = true, initialFilter = {}, onError } = options;

  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFiltersState] = useState<LearningsFilter>(initialFilter);
  const [limit] = useState(initialLimit);

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      onError?.(err);
    },
    [onError]
  );

  const buildQueryString = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      params.set("limit", limit.toString());
      params.set("offset", offset.toString());

      if (filters.type) {
        params.set("type", filters.type);
      }
      if (filters.search) {
        params.set("search", filters.search);
      }
      if (filters.tags && filters.tags.length > 0) {
        params.set("tags", filters.tags.join(","));
      }

      return params.toString();
    },
    [limit, filters]
  );

  const fetchLearnings = useCallback(
    async (fetchOptions: { offset?: number; append?: boolean } = {}) => {
      const { offset = 0, append = false } = fetchOptions;

      setIsLoading(true);
      setError(null);

      try {
        const queryString = buildQueryString(offset);
        const response = await fetch(`/api/learnings?${queryString}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to fetch learnings");
        }

        const result = data.data as LearningsResponse;

        setLearnings((prev) => (append ? [...prev, ...result.items] : result.items));
        setTotal(result.total);
        setHasMore(result.hasMore);
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [buildQueryString, handleError]
  );

  const createLearning = useCallback(
    async (data: CreateLearningRequest): Promise<Learning | null> => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/learnings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to create learning");
        }

        const newLearning = result.data as Learning;

        // Prepend to the list
        setLearnings((prev) => [newLearning, ...prev]);
        setTotal((prev) => prev + 1);

        return newLearning;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const updateLearning = useCallback(
    async (id: string, data: UpdateLearningRequest): Promise<Learning | null> => {
      try {
        const response = await fetch(`/api/learnings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to update learning");
        }

        const updatedLearning = result.data as Learning;

        // Update in the list
        setLearnings((prev) =>
          prev.map((learning) => (learning.id === id ? updatedLearning : learning))
        );

        return updatedLearning;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [handleError]
  );

  const deleteLearning = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/learnings/${id}`, {
          method: "DELETE",
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to delete learning");
        }

        // Remove from the list
        setLearnings((prev) => prev.filter((learning) => learning.id !== id));
        setTotal((prev) => prev - 1);

        return true;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return false;
      }
    },
    [handleError]
  );

  const setFilters = useCallback((newFilters: LearningsFilter) => {
    setFiltersState(newFilters);
  }, []);

  const refetch = useCallback(() => {
    return fetchLearnings({ offset: 0, append: false });
  }, [fetchLearnings]);

  // Legacy method: Save insight
  const saveInsight = useCallback(
    async (
      insight: InsightSuggestion,
      conversationId?: string
    ): Promise<Learning | null> => {
      return createLearning({
        content: `${insight.title}\n\n${insight.content}`,
        tags: insight.tags,
        type: "insight" as LearningType,
        conversationId,
      });
    },
    [createLearning]
  );

  // Legacy method: Save reflection
  const saveReflection = useCallback(
    async (
      reflection: ReflectionData,
      conversationId?: string
    ): Promise<Learning | null> => {
      let content = "";

      if (reflection.quickReflection) {
        const label =
          reflection.quickReflection === "good"
            ? "Good"
            : reflection.quickReflection === "okay"
              ? "Okay"
              : "Needs improvement";
        content += `振り返り: ${label}\n\n`;
      }

      if (reflection.detailedReflection) {
        content += `【何をした？】\n${reflection.detailedReflection.whatDid}\n\n`;
        content += `【何がわかった？】\n${reflection.detailedReflection.whatLearned}\n\n`;
        content += `【なぜそうなった？】\n${reflection.detailedReflection.whyHappened}\n\n`;
        content += `【次どうする？】\n${reflection.detailedReflection.whatNext}`;
      }

      return createLearning({
        content: content.trim(),
        tags: [],
        type: "reflection" as LearningType,
        conversationId,
      });
    },
    [createLearning]
  );

  // Auto-fetch on mount and when filters change
  useEffect(() => {
    if (autoFetch) {
      fetchLearnings();
    }
  }, [autoFetch, fetchLearnings]);

  return {
    learnings,
    isLoading,
    error,
    total,
    hasMore,
    filters,
    fetchLearnings,
    createLearning,
    updateLearning,
    deleteLearning,
    setFilters,
    refetch,
    // Legacy methods
    saveInsight,
    saveReflection,
  };
}
