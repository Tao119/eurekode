"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FullPageLoading } from "@/components/common/LoadingSpinner";
import { TaskBoard, TaskTimer, EstimationDashboard } from "@/components/projects";
import { useProject } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, ProjectStatus } from "@/types/project";
import type { ChatMode } from "@/generated/prisma/client";

// 関連会話の型定義
interface ProjectConversation {
  id: string;
  mode: ChatMode;
  title: string | null;
  tokensConsumed: number;
  learningsCount: number;
  createdAt: string;
  updatedAt: string;
}

const MODE_ICONS: Record<ChatMode, { icon: string; color: string; label: string }> = {
  explanation: { icon: "school", color: "text-blue-400", label: "解説" },
  generation: { icon: "code", color: "text-yellow-400", label: "生成" },
  brainstorm: { icon: "lightbulb", color: "text-purple-400", label: "壁打ち" },
};

const STATUS_CONFIG: Record<ProjectStatus, { label: string; icon: string; color: string; bgColor: string }> = {
  planning: { label: "企画中", icon: "edit_note", color: "text-purple-400", bgColor: "bg-purple-500/10" },
  in_progress: { label: "進行中", icon: "play_circle", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  completed: { label: "完了", icon: "check_circle", color: "text-green-400", bgColor: "bg-green-500/10" },
  archived: { label: "アーカイブ", icon: "archive", color: "text-slate-400", bgColor: "bg-slate-500/10" },
};

export default function ProjectDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const {
    project,
    isLoading,
    error,
    updateProject,
    createTask,
    updateTask,
    deleteTask,
    startTask,
    stopTask,
    completeTask,
  } = useProject({
    projectId,
    autoFetch: !!session?.user?.id,
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [conversations, setConversations] = useState<ProjectConversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // 関連会話を取得
  useEffect(() => {
    if (!session?.user?.id || !projectId) return;

    const fetchConversations = async () => {
      setIsLoadingConversations(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/conversations?limit=10`);
        const data = await response.json();
        if (data.success) {
          setConversations(data.data.items);
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [session?.user?.id, projectId]);

  // Get top-level tasks (no parent)
  const topLevelTasks = useMemo(() => {
    if (!project?.tasks) return [];
    return project.tasks.filter((t) => !t.parentTaskId);
  }, [project?.tasks]);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleTaskStatusChange = useCallback(
    async (taskId: string, status: TaskStatus) => {
      await updateTask(taskId, { status });
      // Update selected task if it's the one being changed
      if (selectedTask?.id === taskId) {
        const updatedTask = project?.tasks.find((t) => t.id === taskId);
        if (updatedTask) {
          setSelectedTask({ ...updatedTask, status });
        }
      }
    },
    [updateTask, selectedTask, project?.tasks]
  );

  const handleTaskStart = useCallback(
    async (taskId: string) => {
      const result = await startTask(taskId);
      if (result) {
        setSelectedTask(result);
      }
      return result;
    },
    [startTask]
  );

  const handleTaskStop = useCallback(
    async (taskId: string) => {
      const result = await stopTask(taskId);
      if (result) {
        setSelectedTask(result);
      }
      return result;
    },
    [stopTask]
  );

  const handleTaskComplete = useCallback(
    async (taskId: string, retrospective?: string) => {
      const result = await completeTask(taskId, retrospective);
      if (result) {
        setSelectedTask(result);
      }
      return result;
    },
    [completeTask]
  );

  const handleStatusChange = useCallback(
    async (status: ProjectStatus) => {
      await updateProject({ status });
    },
    [updateProject]
  );

  if (authStatus === "loading" || (authStatus === "authenticated" && isLoading && !project)) {
    return <FullPageLoading />;
  }

  if (authStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  if (error || !project) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <span className="material-symbols-outlined text-5xl text-destructive mb-4">
              error
            </span>
            <h3 className="font-medium text-lg mb-2">プロジェクトが見つかりません</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {error?.message || "このプロジェクトは存在しないか、アクセス権限がありません"}
            </p>
            <Link href="/projects">
              <Button>
                <span className="material-symbols-outlined text-base">arrow_back</span>
                プロジェクト一覧に戻る
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[project.status as ProjectStatus];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <Link href="/projects" className="mt-1">
            <Button variant="ghost" size="icon-sm">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </Button>
          </Link>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className={cn("px-2 py-0.5 rounded-full flex items-center gap-1", statusConfig.bgColor)}>
                <span className={cn("material-symbols-outlined text-sm", statusConfig.color)}>
                  {statusConfig.icon}
                </span>
                <span className={cn("text-xs font-medium", statusConfig.color)}>
                  {statusConfig.label}
                </span>
              </div>
            </div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2">
          {project.status === "planning" && (
            <Button onClick={() => handleStatusChange("in_progress")}>
              <span className="material-symbols-outlined text-base">play_arrow</span>
              開始する
            </Button>
          )}
          {project.status === "in_progress" && (
            <Button onClick={() => handleStatusChange("completed")}>
              <span className="material-symbols-outlined text-base">check</span>
              完了する
            </Button>
          )}
          {project.status === "completed" && (
            <Button variant="outline" onClick={() => handleStatusChange("in_progress")}>
              <span className="material-symbols-outlined text-base">replay</span>
              再開する
            </Button>
          )}
          {project.status === "archived" && (
            <Button variant="outline" onClick={() => handleStatusChange("in_progress")}>
              <span className="material-symbols-outlined text-base">unarchive</span>
              復元する
            </Button>
          )}
        </div>
      </div>

      {/* Project Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          icon="checklist"
          label="タスク"
          value={`${project.taskStats?.completed ?? 0}/${project.taskStats?.total ?? 0}`}
          subValue="完了/全体"
        />
        <SummaryCard
          icon="timer"
          label="見積合計"
          value={formatMinutes(
            project.tasks?.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0) || 0
          )}
        />
        <SummaryCard
          icon="schedule"
          label="実績合計"
          value={formatMinutes(
            project.tasks?.reduce((sum, t) => sum + (t.actualMinutes || 0), 0) || 0
          )}
        />
        <SummaryCard
          icon="analytics"
          label="見積精度"
          value={project.estimationAccuracy !== undefined ? `${project.estimationAccuracy}%` : "-"}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Board */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardContent className="h-full p-4">
              <TaskBoard
                tasks={topLevelTasks}
                view={view}
                onViewChange={setView}
                onTaskClick={handleTaskClick}
                onTaskStatusChange={handleTaskStatusChange}
                onTaskStart={handleTaskStart}
                onAddTask={() => setShowAddTaskModal(true)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Timer */}
          <TaskTimer
            task={selectedTask}
            onStart={handleTaskStart}
            onStop={handleTaskStop}
            onComplete={handleTaskComplete}
          />

          {/* Project Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">info</span>
                プロジェクト情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {project.ideaSummary && (
                <InfoItem icon="lightbulb" label="アイデア" value={project.ideaSummary} />
              )}
              {project.targetPersona && (
                <InfoItem icon="person" label="ペルソナ" value={project.targetPersona} />
              )}
              {project.techStack && project.techStack.length > 0 && (
                <InfoItem icon="code" label="技術" value={project.techStack.join(", ")} />
              )}
              {project.mvpFeatures && project.mvpFeatures.length > 0 && (
                <InfoItem
                  icon="rocket_launch"
                  label="MVP機能"
                  value={`${project.mvpFeatures.length}件`}
                />
              )}
            </CardContent>
          </Card>

          {/* Estimation Dashboard (Mini) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">analytics</span>
                見積精度
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EstimationDashboard tasks={project.tasks || []} className="space-y-3" />
            </CardContent>
          </Card>

          {/* 関連会話 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">chat</span>
                関連するチャット
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 新規チャット開始ボタン */}
              <div className="flex flex-wrap gap-2">
                <Link href={`/chat/explanation?projectId=${projectId}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <span className="material-symbols-outlined text-base text-blue-400">school</span>
                    質問する
                  </Button>
                </Link>
                <Link href={`/chat/generation?projectId=${projectId}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <span className="material-symbols-outlined text-base text-yellow-400">code</span>
                    コード生成
                  </Button>
                </Link>
                <Link href={`/chat/brainstorm?projectId=${projectId}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <span className="material-symbols-outlined text-base text-purple-400">lightbulb</span>
                    壁打ち
                  </Button>
                </Link>
              </div>

              {/* 会話リスト */}
              {isLoadingConversations ? (
                <div className="flex items-center justify-center py-4">
                  <span className="material-symbols-outlined animate-spin text-muted-foreground">
                    progress_activity
                  </span>
                </div>
              ) : conversations.length > 0 ? (
                <div className="space-y-2">
                  {conversations.map((conv) => {
                    const modeInfo = MODE_ICONS[conv.mode];
                    return (
                      <Link
                        key={conv.id}
                        href={`/chat/${conv.mode}/${conv.id}`}
                        className="block p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("material-symbols-outlined text-sm", modeInfo.color)}>
                            {modeInfo.icon}
                          </span>
                          <span className="text-xs text-muted-foreground">{modeInfo.label}</span>
                        </div>
                        <p className="text-sm font-medium mt-1 line-clamp-1">
                          {conv.title || "無題の会話"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(conv.updatedAt).toLocaleDateString("ja-JP")}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  関連する会話はありません
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <AddTaskModal
          onClose={() => setShowAddTaskModal(false)}
          onAdd={async (title, estimatedMinutes) => {
            await createTask({ title, estimatedMinutes });
            setShowAddTaskModal(false);
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  subValue,
}: {
  icon: string;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="material-symbols-outlined text-muted-foreground text-sm mt-0.5">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground/90 break-words">{value}</span>
      </div>
    </div>
  );
}

function AddTaskModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (title: string, estimatedMinutes?: number) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    await onAdd(title.trim(), estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_task</span>
            タスクを追加
          </CardTitle>
          <CardDescription>新しいタスクを作成します</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">タスク名 *</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: ログイン機能の実装"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated-minutes">見積時間（分）</Label>
              <Input
                id="estimated-minutes"
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="例: 30"
                min={0}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                キャンセル
              </Button>
              <Button type="submit" disabled={!title.trim() || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-base">
                      progress_activity
                    </span>
                    追加中...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">add</span>
                    追加
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "-";
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}
