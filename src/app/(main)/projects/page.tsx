"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FullPageLoading } from "@/components/common/LoadingSpinner";
import { EstimationDashboard } from "@/components/projects/EstimationDashboard";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { ProjectWithStats, ProjectStatus } from "@/types/project";

const STATUS_CONFIG: Record<ProjectStatus, { label: string; icon: string; color: string }> = {
  planning: { label: "企画中", icon: "edit_note", color: "text-purple-400" },
  in_progress: { label: "進行中", icon: "play_circle", color: "text-blue-400" },
  completed: { label: "完了", icon: "check_circle", color: "text-green-400" },
  archived: { label: "アーカイブ", icon: "archive", color: "text-slate-400" },
};

export default function ProjectsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const {
    projects,
    isLoading,
    error,
    total,
    hasMore,
    fetchProjects,
    deleteProject,
    setFilters,
  } = useProjects({
    initialLimit: 20,
    autoFetch: !!session?.user?.id,
    initialFilter: {},
  });

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setFilters({ search: query, status: statusFilter ?? undefined });
    },
    [statusFilter, setFilters]
  );

  const handleStatusFilter = useCallback(
    (status: ProjectStatus | null) => {
      setStatusFilter(status);
      setFilters({ search: searchQuery, status: status ?? undefined });
    },
    [searchQuery, setFilters]
  );

  const handleLoadMore = useCallback(() => {
    fetchProjects({ offset: projects.length, append: true });
  }, [fetchProjects, projects.length]);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm("このプロジェクトを削除しますか？")) {
        await deleteProject(id);
      }
    },
    [deleteProject]
  );

  if (authStatus === "loading" || (authStatus === "authenticated" && isLoading && projects.length === 0)) {
    return <FullPageLoading />;
  }

  if (authStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">folder_open</span>
            プロジェクト
          </h1>
          <p className="text-muted-foreground mt-1">
            壁打ちから生まれたプロジェクトを管理
          </p>
        </div>

        <Button onClick={() => setShowCreateDialog(true)}>
          <span className="material-symbols-outlined text-base">add</span>
          新規プロジェクト
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
            search
          </span>
          <Input
            type="text"
            placeholder="プロジェクトを検索..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 bg-muted p-1 rounded-lg">
          <Button
            variant={statusFilter === null ? "default" : "ghost"}
            size="sm"
            onClick={() => handleStatusFilter(null)}
          >
            すべて
          </Button>
          {(Object.entries(STATUS_CONFIG) as [ProjectStatus, typeof STATUS_CONFIG[ProjectStatus]][]).map(
            ([status, config]) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "ghost"}
                size="sm"
                onClick={() => handleStatusFilter(status)}
                className="gap-1"
              >
                <span className={cn("material-symbols-outlined text-base", config.color)}>
                  {config.icon}
                </span>
                {config.label}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive flex items-center gap-2">
              <span className="material-symbols-outlined">error</span>
              {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project List */}
        <div className="lg:col-span-2 space-y-4">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <span className="material-symbols-outlined text-5xl text-muted-foreground mb-4">
                  folder_off
                </span>
                <h3 className="font-medium text-lg mb-2">プロジェクトがありません</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  壁打ちモードでアイデアを具体化し、プロジェクトとして保存しましょう
                </p>
                <Link href="/chat/brainstorm">
                  <Button>
                    <span className="material-symbols-outlined text-base">lightbulb</span>
                    壁打ちを始める
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={(e) => handleDelete(project.id, e)}
                />
              ))}

              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">
                        progress_activity
                      </span>
                      読み込み中...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">expand_more</span>
                      さらに読み込む ({total - projects.length}件)
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Sidebar - Estimation Dashboard */}
        <div className="lg:col-span-1">
          <EstimationDashboard projects={projects} />
        </div>
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={() => fetchProjects()}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
}: {
  project: ProjectWithStats;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const statusConfig = STATUS_CONFIG[project.status as ProjectStatus];
  const completedTasks = project.taskStats?.completed ?? 0;
  const totalTasks = project.taskStats?.total ?? 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("material-symbols-outlined text-lg", statusConfig.color)}>
                  {statusConfig.icon}
                </span>
                <span className={cn("text-xs font-medium", statusConfig.color)}>
                  {statusConfig.label}
                </span>
              </div>
              <CardTitle className="text-lg truncate">{project.title}</CardTitle>
              {project.description && (
                <CardDescription className="line-clamp-2 mt-1">
                  {project.description}
                </CardDescription>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Task Progress */}
          {totalTasks > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">タスク進捗</span>
                <span className="font-medium">
                  {completedTasks}/{totalTasks} ({Math.round(progress)}%)
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {project.estimationAccuracy !== undefined && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">analytics</span>
                見積精度 {project.estimationAccuracy}%
              </div>
            )}

            {project.techStack && project.techStack.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">code</span>
                {project.techStack.slice(0, 2).join(", ")}
                {project.techStack.length > 2 && ` +${project.techStack.length - 2}`}
              </div>
            )}

            <div className="flex items-center gap-1 ml-auto">
              <span className="material-symbols-outlined text-sm">schedule</span>
              {new Date(project.updatedAt).toLocaleDateString("ja-JP")}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
