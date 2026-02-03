"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "@/types/project";

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void;
  onTaskStart?: (taskId: string) => void;
  onAddTask?: () => void;
  view?: "board" | "list";
  onViewChange?: (view: "board" | "list") => void;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: "未着手",
    icon: "radio_button_unchecked",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
  },
  in_progress: {
    label: "進行中",
    icon: "play_circle",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
  },
  completed: {
    label: "完了",
    icon: "check_circle",
    bgColor: "bg-green-500/10",
    textColor: "text-green-400",
  },
  blocked: {
    label: "ブロック",
    icon: "block",
    bgColor: "bg-red-500/10",
    textColor: "text-red-400",
  },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: "低", color: "text-slate-400" },
  medium: { label: "中", color: "text-blue-400" },
  high: { label: "高", color: "text-orange-400" },
  urgent: { label: "緊急", color: "text-red-400" },
};

export function TaskBoard({
  tasks,
  onTaskClick,
  onTaskStatusChange,
  onTaskStart,
  onAddTask,
  view = "board",
  onViewChange,
}: TaskBoardProps) {
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      blocked: [],
    };

    for (const task of tasks) {
      const status = task.status as TaskStatus;
      if (grouped[status]) {
        grouped[status].push(task);
      }
    }

    return grouped;
  }, [tasks]);

  const statuses: TaskStatus[] = ["pending", "in_progress", "completed", "blocked"];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">dashboard</span>
          <h2 className="font-semibold">タスクボード</h2>
          <span className="text-sm text-muted-foreground">
            ({tasks.length}件)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          {onViewChange && (
            <div className="flex items-center rounded-lg border border-border p-0.5">
              <button
                onClick={() => onViewChange("board")}
                className={cn(
                  "px-2 py-1 rounded-md text-sm transition-colors",
                  view === "board"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="material-symbols-outlined text-base">view_kanban</span>
              </button>
              <button
                onClick={() => onViewChange("list")}
                className={cn(
                  "px-2 py-1 rounded-md text-sm transition-colors",
                  view === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="material-symbols-outlined text-base">view_list</span>
              </button>
            </div>
          )}

          {/* Add Task Button */}
          {onAddTask && (
            <Button size="sm" onClick={onAddTask}>
              <span className="material-symbols-outlined text-base">add</span>
              タスク追加
            </Button>
          )}
        </div>
      </div>

      {/* Board View */}
      {view === "board" ? (
        <div className="flex-1 grid grid-cols-4 gap-4 min-h-0 overflow-hidden">
          {statuses.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onTaskClick={onTaskClick}
              onTaskStatusChange={onTaskStatusChange}
              onTaskStart={onTaskStart}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <TaskListView
            tasks={tasks}
            onTaskClick={onTaskClick}
            onTaskStatusChange={onTaskStatusChange}
            onTaskStart={onTaskStart}
          />
        </div>
      )}
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  onTaskClick,
  onTaskStatusChange,
  onTaskStart,
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void;
  onTaskStart?: (taskId: string) => void;
}) {
  const config = STATUS_CONFIG[status];
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const taskId = e.dataTransfer.getData("taskId");
      if (taskId && onTaskStatusChange) {
        onTaskStatusChange(taskId, status);
      }
    },
    [status, onTaskStatusChange]
  );

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card/50 overflow-hidden transition-colors",
        isDragOver && "border-primary bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b border-border",
          config.bgColor
        )}
      >
        <span className={cn("material-symbols-outlined text-lg", config.textColor)}>
          {config.icon}
        </span>
        <span className="font-medium text-sm">{config.label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
          {tasks.length}
        </span>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick?.(task)}
            onStart={onTaskStart ? () => onTaskStart(task.id) : undefined}
          />
        ))}

        {tasks.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            タスクなし
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onClick,
  onStart,
}: {
  task: Task;
  onClick?: () => void;
  onStart?: () => void;
}) {
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority];

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("taskId", task.id);
    },
    [task.id]
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 cursor-pointer transition-all",
        "hover:border-primary/50 hover:shadow-sm",
        "active:scale-[0.98]"
      )}
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
    >
      {/* Title */}
      <h4 className="font-medium text-sm line-clamp-2 mb-2">{task.title}</h4>

      {/* Meta */}
      <div className="flex items-center gap-2 text-xs">
        {/* Priority */}
        <span className={cn("flex items-center gap-1", priorityConfig.color)}>
          <span className="material-symbols-outlined text-sm">flag</span>
          {priorityConfig.label}
        </span>

        {/* Estimated Time */}
        {task.estimatedMinutes && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {formatMinutes(task.estimatedMinutes)}
          </span>
        )}

        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="material-symbols-outlined text-sm">checklist</span>
            {task.subtasks.filter((st) => st.status === "completed").length}/
            {task.subtasks.length}
          </span>
        )}
      </div>

      {/* Start Button (for pending tasks) */}
      {task.status === "pending" && onStart && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          className={cn(
            "mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-md text-xs",
            "bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          )}
        >
          <span className="material-symbols-outlined text-base">play_arrow</span>
          開始
        </button>
      )}
    </div>
  );
}

function TaskListView({
  tasks,
  onTaskClick,
  onTaskStatusChange,
  onTaskStart,
}: {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void;
  onTaskStart?: (taskId: string) => void;
}) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {tasks.map((task) => (
        <TaskListItem
          key={task.id}
          task={task}
          onClick={() => onTaskClick?.(task)}
          onStatusChange={onTaskStatusChange}
          onStart={onTaskStart ? () => onTaskStart(task.id) : undefined}
        />
      ))}

      {tasks.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          タスクがありません
        </div>
      )}
    </div>
  );
}

function TaskListItem({
  task,
  onClick,
  onStatusChange,
  onStart,
}: {
  task: Task;
  onClick?: () => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onStart?: () => void;
}) {
  const statusConfig = STATUS_CONFIG[task.status as TaskStatus];
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority];

  const handleStatusClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onStatusChange) return;

      // Cycle through statuses
      const statuses: TaskStatus[] = ["pending", "in_progress", "completed"];
      const currentIndex = statuses.indexOf(task.status as TaskStatus);
      const nextStatus = statuses[(currentIndex + 1) % statuses.length];
      onStatusChange(task.id, nextStatus);
    },
    [task.id, task.status, onStatusChange]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors",
        "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      {/* Status Icon */}
      <button
        onClick={handleStatusClick}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors",
          statusConfig.bgColor,
          "hover:opacity-80"
        )}
      >
        <span className={cn("material-symbols-outlined text-lg", statusConfig.textColor)}>
          {statusConfig.icon}
        </span>
      </button>

      {/* Title & Description */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{task.title}</h4>
        {task.description && (
          <p className="text-xs text-muted-foreground truncate">{task.description}</p>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs">
        {/* Priority */}
        <span className={cn("flex items-center gap-1", priorityConfig.color)}>
          <span className="material-symbols-outlined text-sm">flag</span>
          {priorityConfig.label}
        </span>

        {/* Time */}
        {task.estimatedMinutes && (
          <span className="flex items-center gap-1 text-muted-foreground w-16">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {formatMinutes(task.estimatedMinutes)}
          </span>
        )}

        {/* Start Button */}
        {task.status === "pending" && onStart && (
          <Button
            size="xs"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
          >
            <span className="material-symbols-outlined text-base">play_arrow</span>
            開始
          </Button>
        )}
      </div>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}
