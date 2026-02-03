"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/project";

interface TaskTimerProps {
  task: Task | null;
  onStart?: (taskId: string) => Promise<Task | null>;
  onStop?: (taskId: string) => Promise<Task | null>;
  onComplete?: (taskId: string, retrospective?: string) => Promise<Task | null>;
  className?: string;
}

export function TaskTimer({
  task,
  onStart,
  onStop,
  onComplete,
  className,
}: TaskTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate initial elapsed time from task
  useEffect(() => {
    if (!task) {
      setElapsedSeconds(0);
      setIsRunning(false);
      return;
    }

    let initial = (task.actualMinutes || 0) * 60;

    // If task is in progress and has startedAt, calculate elapsed
    if (task.status === "in_progress" && task.startedAt) {
      const startTime = new Date(task.startedAt).getTime();
      const now = Date.now();
      const additionalSeconds = Math.floor((now - startTime) / 1000);
      initial += additionalSeconds;
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }

    setElapsedSeconds(initial);
  }, [task]);

  // Timer tick
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleStart = useCallback(async () => {
    if (!task || !onStart) return;
    const result = await onStart(task.id);
    if (result) {
      setIsRunning(true);
    }
  }, [task, onStart]);

  const handleStop = useCallback(async () => {
    if (!task || !onStop) return;
    const result = await onStop(task.id);
    if (result) {
      setIsRunning(false);
    }
  }, [task, onStop]);

  const handleComplete = useCallback(async () => {
    setShowCompleteModal(true);
  }, []);

  if (!task) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center",
          className
        )}
      >
        <span className="material-symbols-outlined text-3xl text-muted-foreground mb-2">
          timer
        </span>
        <p className="text-sm text-muted-foreground">
          タスクを選択してタイマーを開始
        </p>
      </div>
    );
  }

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const estimatedMinutes = task.estimatedMinutes || 0;
  const actualMinutes = Math.ceil(elapsedSeconds / 60);
  const progress = estimatedMinutes > 0 ? (actualMinutes / estimatedMinutes) * 100 : 0;
  const isOvertime = progress > 100;

  return (
    <>
      <div
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden",
          className
        )}
      >
        {/* Task Info */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="font-medium text-sm line-clamp-1">{task.title}</h3>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {task.description}
            </p>
          )}
        </div>

        {/* Timer Display */}
        <div className="p-6 text-center">
          <div
            className={cn(
              "text-4xl font-mono font-bold tracking-wider",
              isRunning
                ? isOvertime
                  ? "text-red-400"
                  : "text-primary"
                : "text-foreground"
            )}
          >
            {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </div>

          {/* Progress */}
          {estimatedMinutes > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>経過: {formatMinutes(actualMinutes)}</span>
                <span>見積: {formatMinutes(estimatedMinutes)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    isOvertime ? "bg-red-500" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              {isOvertime && (
                <p className="text-xs text-red-400 mt-1">
                  見積を {formatMinutes(actualMinutes - estimatedMinutes)} 超過中
                </p>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center gap-2">
          {!isRunning ? (
            <Button
              className="flex-1"
              onClick={handleStart}
              disabled={!onStart || task.status === "completed"}
            >
              <span className="material-symbols-outlined text-base">play_arrow</span>
              開始
            </Button>
          ) : (
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleStop}
              disabled={!onStop}
            >
              <span className="material-symbols-outlined text-base">pause</span>
              一時停止
            </Button>
          )}

          <Button
            variant={isOvertime ? "destructive" : "secondary"}
            onClick={handleComplete}
            disabled={!onComplete || task.status === "completed"}
          >
            <span className="material-symbols-outlined text-base">check</span>
            完了
          </Button>
        </div>
      </div>

      {/* Complete Modal */}
      {showCompleteModal && (
        <TaskCompleteModal
          task={task}
          actualMinutes={actualMinutes}
          onComplete={async (retrospective) => {
            if (onComplete) {
              await onComplete(task.id, retrospective);
            }
            setShowCompleteModal(false);
            setIsRunning(false);
          }}
          onCancel={() => setShowCompleteModal(false)}
        />
      )}
    </>
  );
}

function TaskCompleteModal({
  task,
  actualMinutes,
  onComplete,
  onCancel,
}: {
  task: Task;
  actualMinutes: number;
  onComplete: (retrospective?: string) => void;
  onCancel: () => void;
}) {
  const [retrospective, setRetrospective] = useState("");

  const estimatedMinutes = task.estimatedMinutes || 0;
  const difference = actualMinutes - estimatedMinutes;
  const accuracy =
    estimatedMinutes > 0
      ? Math.round((1 - Math.abs(difference) / estimatedMinutes) * 100)
      : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-lg border border-border bg-card shadow-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-400 text-xl">
                check_circle
              </span>
            </div>
            <div>
              <h3 className="font-semibold">タスク完了</h3>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {task.title}
              </p>
            </div>
          </div>

          {/* Time Summary */}
          <div className="rounded-lg bg-muted/50 p-4 mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">見積時間</span>
              <span>{formatMinutes(estimatedMinutes)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">実績時間</span>
              <span
                className={cn(
                  difference > 0 ? "text-red-400" : "text-green-400"
                )}
              >
                {formatMinutes(actualMinutes)}
              </span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">見積精度</span>
              <span
                className={cn(
                  "font-medium",
                  accuracy >= 80
                    ? "text-green-400"
                    : accuracy >= 50
                      ? "text-yellow-400"
                      : "text-red-400"
                )}
              >
                {Math.max(0, accuracy)}%
              </span>
            </div>
          </div>

          {/* Retrospective */}
          <div className="space-y-2">
            <label className="text-sm font-medium">振り返り（任意）</label>
            <textarea
              value={retrospective}
              onChange={(e) => setRetrospective(e.target.value)}
              placeholder="見積とのズレや学びをメモ..."
              className={cn(
                "w-full h-24 px-3 py-2 rounded-md border border-border bg-background text-sm",
                "placeholder:text-muted-foreground resize-none",
                "focus:outline-none focus:ring-2 focus:ring-ring"
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            キャンセル
          </Button>
          <Button
            className="flex-1"
            onClick={() => onComplete(retrospective || undefined)}
          >
            <span className="material-symbols-outlined text-base">check</span>
            完了する
          </Button>
        </div>
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
