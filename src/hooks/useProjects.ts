"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  Project,
  ProjectWithStats,
  Task,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  ProjectsFilter,
  ProjectStatus,
  TaskStatus,
} from "@/types/project";
import { isAuthError, handleAuthError } from "@/lib/auth-error-handler";

interface UseProjectsOptions {
  initialLimit?: number;
  autoFetch?: boolean;
  initialFilter?: ProjectsFilter;
  onError?: (error: Error) => void;
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { initialLimit = 20, autoFetch = true, initialFilter = {}, onError } = options;

  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFiltersState] = useState<ProjectsFilter>(initialFilter);

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      onError?.(err);
    },
    [onError]
  );

  const fetchProjects = useCallback(
    async (fetchOptions: { offset?: number; append?: boolean } = {}) => {
      const { offset = 0, append = false } = fetchOptions;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", initialLimit.toString());
        params.set("offset", offset.toString());
        if (filters.status) params.set("status", filters.status);
        if (filters.search) params.set("search", filters.search);

        const response = await fetch(`/api/projects?${params}`);

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return;
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to fetch projects");
        }

        setProjects((prev) => (append ? [...prev, ...data.data.items] : data.data.items));
        setTotal(data.data.total);
        setHasMore(data.data.hasMore);
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [initialLimit, filters, handleError]
  );

  const createProject = useCallback(
    async (data: CreateProjectRequest): Promise<Project | null> => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return null;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to create project");
        }

        // Refetch to get stats
        await fetchProjects();
        return result.data;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProjects, handleError]
  );

  const updateProject = useCallback(
    async (id: string, data: UpdateProjectRequest): Promise<Project | null> => {
      try {
        const response = await fetch(`/api/projects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return null;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to update project");
        }

        // Update local state
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...result.data } : p))
        );

        return result.data;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [handleError]
  );

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/projects/${id}`, {
          method: "DELETE",
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return false;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to delete project");
        }

        setProjects((prev) => prev.filter((p) => p.id !== id));
        setTotal((prev) => prev - 1);

        return true;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return false;
      }
    },
    [handleError]
  );

  const setFilters = useCallback((newFilters: ProjectsFilter) => {
    setFiltersState(newFilters);
  }, []);

  const refetch = useCallback(() => {
    return fetchProjects({ offset: 0, append: false });
  }, [fetchProjects]);

  useEffect(() => {
    if (autoFetch) {
      fetchProjects();
    }
  }, [autoFetch, fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    total,
    hasMore,
    filters,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    setFilters,
    refetch,
  };
}

// Hook for single project with tasks
interface UseProjectOptions {
  projectId: string;
  autoFetch?: boolean;
  onError?: (error: Error) => void;
}

interface ProjectWithTasks extends ProjectWithStats {
  tasks: Task[];
}

export function useProject(options: UseProjectOptions) {
  const { projectId, autoFetch = true, onError } = options;

  const [project, setProject] = useState<ProjectWithTasks | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      onError?.(err);
    },
    [onError]
  );

  const fetchProject = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}`);

      // Check for auth error
      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch project");
      }

      setProject(data.data);
    } catch (err) {
      handleError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, handleError]);

  const updateProject = useCallback(
    async (data: UpdateProjectRequest): Promise<Project | null> => {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return null;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to update project");
        }

        setProject((prev) => (prev ? { ...prev, ...result.data } : null));
        return result.data;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [projectId, handleError]
  );

  const createTask = useCallback(
    async (data: Omit<CreateTaskRequest, "projectId">): Promise<Task | null> => {
      try {
        const response = await fetch(`/api/projects/${projectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return null;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to create task");
        }

        // Refetch project to get updated tasks
        await fetchProject();
        return result.data;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [projectId, fetchProject, handleError]
  );

  const createTasks = useCallback(
    async (tasks: Omit<CreateTaskRequest, "projectId">[]): Promise<number> => {
      try {
        const response = await fetch(`/api/projects/${projectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks }),
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return 0;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to create tasks");
        }

        // Refetch project to get updated tasks
        await fetchProject();
        return result.data.count;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return 0;
      }
    },
    [projectId, fetchProject, handleError]
  );

  const updateTask = useCallback(
    async (taskId: string, data: UpdateTaskRequest): Promise<Task | null> => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return null;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to update task");
        }

        // Update local state
        setProject((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === taskId ? result.data : t)),
          };
        });

        return result.data;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [handleError]
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "DELETE",
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return false;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to delete task");
        }

        // Update local state
        setProject((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.filter((t) => t.id !== taskId),
          };
        });

        return true;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return false;
      }
    },
    [handleError]
  );

  const startTask = useCallback(
    async (taskId: string): Promise<Task | null> => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return null;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to start task");
        }

        setProject((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === taskId ? result.data : t)),
          };
        });

        return result.data;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [handleError]
  );

  const stopTask = useCallback(
    async (taskId: string): Promise<Task | null> => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop" }),
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return null;
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Failed to stop task");
        }

        setProject((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === taskId ? result.data : t)),
          };
        });

        return result.data;
      } catch (err) {
        handleError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [handleError]
  );

  const completeTask = useCallback(
    async (taskId: string, retrospective?: string): Promise<Task | null> => {
      return updateTask(taskId, {
        status: "completed" as TaskStatus,
        retrospective,
      });
    },
    [updateTask]
  );

  useEffect(() => {
    if (autoFetch && projectId) {
      fetchProject();
    }
  }, [autoFetch, projectId, fetchProject]);

  return {
    project,
    isLoading,
    error,
    fetchProject,
    updateProject,
    createTask,
    createTasks,
    updateTask,
    deleteTask,
    startTask,
    stopTask,
    completeTask,
    refetch: fetchProject,
  };
}

// Helper function to create project from brainstorm mode
export async function createProjectFromBrainstorm(
  brainstormData: {
    ideaSummary?: string;
    persona?: string;
    competitors?: string[];
    techStack?: string[];
    mvpFeatures?: string[];
    planSteps?: { title: string; estimatedMinutes?: number }[];
    conversationId?: string;
  },
  projectTitle: string
): Promise<{ project: Project; tasksCreated: number } | null> {
  try {
    // Create project
    const projectResponse = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: projectTitle,
        ideaSummary: brainstormData.ideaSummary,
        targetPersona: brainstormData.persona,
        competitors: brainstormData.competitors,
        techStack: brainstormData.techStack,
        mvpFeatures: brainstormData.mvpFeatures,
        conversationId: brainstormData.conversationId,
      }),
    });

    // Check for auth error
    if (isAuthError(projectResponse)) {
      await handleAuthError();
      return null;
    }

    const projectResult = await projectResponse.json();

    if (!projectResult.success) {
      throw new Error(projectResult.error?.message || "Failed to create project");
    }

    const project = projectResult.data;

    // Create tasks from plan steps
    if (brainstormData.planSteps && brainstormData.planSteps.length > 0) {
      const tasksResponse = await fetch(`/api/projects/${project.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: brainstormData.planSteps.map((step, index) => ({
            title: step.title,
            estimatedMinutes: step.estimatedMinutes,
            order: index,
          })),
        }),
      });

      // Check for auth error
      if (isAuthError(tasksResponse)) {
        await handleAuthError();
        return null;
      }

      const tasksResult = await tasksResponse.json();

      if (!tasksResult.success) {
        console.error("Failed to create tasks:", tasksResult.error);
        return { project, tasksCreated: 0 };
      }

      return { project, tasksCreated: tasksResult.data.count };
    }

    return { project, tasksCreated: 0 };
  } catch (error) {
    console.error("Error creating project from brainstorm:", error);
    return null;
  }
}
