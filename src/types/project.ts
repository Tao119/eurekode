// ===========================================
// Project & Task Type Definitions
// ===========================================

export type ProjectStatus = "planning" | "in_progress" | "completed" | "archived";
export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

// プロジェクト中心アーキテクチャ用の型
export type ProjectType = "product" | "learning";
export type ProjectPhase = "planning" | "design" | "development";

// マネジメントシート（TMS的なもの）
export interface ManagementSheet {
  milestones?: {
    title: string;
    dueDate?: string;
    status: "pending" | "completed";
  }[];
  risks?: {
    description: string;
    impact: "low" | "medium" | "high";
    mitigation?: string;
  }[];
  notes?: string;
}

// ===========================================
// Project Types
// ===========================================

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: ProjectStatus;
  // プロジェクト中心アーキテクチャ
  projectType: ProjectType;
  currentPhase?: ProjectPhase | null;
  planningDocUrl?: string | null;
  managementSheet?: ManagementSheet | null;
  // 企画情報
  ideaSummary?: string | null;
  targetPersona?: string | null;
  competitors: string[];
  techStack: string[];
  mvpFeatures: string[];
  // 見積もり情報
  estimatedHours?: number | null;
  actualHours?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  metadata?: ProjectMetadata | null;
  createdAt: string;
  updatedAt: string;
  // Relations (when included)
  tasks?: Task[];
  conversations?: { id: string; title?: string; mode: string }[];
  learnings?: { id: string; content: string; type: string }[];
}

export interface ProjectMetadata {
  // 壁打ちモードからの追加情報
  brainstormInsights?: string[];
  marketAnalysis?: string;
  impactStatement?: string;
}

export interface ProjectWithStats extends Project {
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    blocked: number;
  };
  estimationAccuracy?: number; // 見積もり精度（%）
}

// ===========================================
// Task Types
// ===========================================

export interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  // 見積もり・実績
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  // 作業記録
  startedAt?: string | null;
  completedAt?: string | null;
  // 順序とマイルストーン
  order: number;
  isMilestone: boolean;
  dueDate?: string | null;
  // メモ・振り返り
  notes?: string | null;
  retrospective?: string | null;
  metadata?: TaskMetadata | null;
  createdAt: string;
  updatedAt: string;
  // Relations (when included)
  subtasks?: Task[];
}

export interface TaskMetadata {
  // タスクに関連する追加情報
  dependencies?: string[]; // 依存タスクID
  blockedReason?: string;
  tags?: string[];
}

export interface TaskWithEstimation extends Task {
  estimationAccuracy?: number; // 見積もり精度（%）
  timeVariance?: number; // 実績 - 見積もり（分）
}

// ===========================================
// API Request/Response Types
// ===========================================

export interface CreateProjectRequest {
  title: string;
  description?: string;
  // プロジェクト中心アーキテクチャ
  projectType?: ProjectType;
  currentPhase?: ProjectPhase;
  planningDocUrl?: string;
  managementSheet?: ManagementSheet;
  // 企画情報
  ideaSummary?: string;
  targetPersona?: string;
  competitors?: string[];
  techStack?: string[];
  mvpFeatures?: string[];
  estimatedHours?: number;
  startDate?: string;
  dueDate?: string;
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string;
  status?: ProjectStatus;
  // プロジェクト中心アーキテクチャ
  projectType?: ProjectType;
  currentPhase?: ProjectPhase;
  planningDocUrl?: string;
  managementSheet?: ManagementSheet;
  // 企画情報
  ideaSummary?: string;
  targetPersona?: string;
  competitors?: string[];
  techStack?: string[];
  mvpFeatures?: string[];
  estimatedHours?: number;
  actualHours?: number;
  startDate?: string;
  dueDate?: string;
}

// フェーズ更新用
export interface UpdateProjectPhaseRequest {
  phase: ProjectPhase;
}

export interface CreateTaskRequest {
  projectId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  dueDate?: string;
  isMilestone?: boolean;
  order?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  actualMinutes?: number;
  dueDate?: string;
  isMilestone?: boolean;
  order?: number;
  notes?: string;
  retrospective?: string;
}

export interface BulkCreateTasksRequest {
  projectId: string;
  tasks: Omit<CreateTaskRequest, "projectId">[];
}

// ===========================================
// Filter & Query Types
// ===========================================

export interface ProjectsFilter {
  status?: ProjectStatus;
  projectType?: ProjectType;
  search?: string;
}

export interface TasksFilter {
  projectId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  parentTaskId?: string | null; // null = top-level tasks only
}

export interface ProjectsResponse {
  items: ProjectWithStats[];
  total: number;
  hasMore: boolean;
}

export interface TasksResponse {
  items: Task[];
  total: number;
}

// ===========================================
// Estimation Analytics Types
// ===========================================

export interface EstimationStats {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  // 見積もり精度
  averageAccuracy: number; // 平均精度（%）
  underEstimatedCount: number; // 過小見積もりの数
  overEstimatedCount: number; // 過大見積もりの数
  onTargetCount: number; // 適切な見積もりの数（±10%以内）
  // 時間分析
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  averageVarianceMinutes: number; // 平均差分（分）
}

export interface TaskEstimationHistory {
  taskId: string;
  taskTitle: string;
  projectTitle: string;
  estimatedMinutes: number;
  actualMinutes: number;
  accuracy: number;
  completedAt: string;
}
