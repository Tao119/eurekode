"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProjectFromBrainstorm } from "@/hooks/useProjects";
import type { BrainstormModeState } from "@/hooks/useBrainstormMode";
import type { PlanStep } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ProjectSaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brainstormState: BrainstormModeState;
  conversationId?: string;
}

export function ProjectSaveModal({
  open,
  onOpenChange,
  brainstormState,
  conversationId,
}: ProjectSaveModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("プロジェクト名を入力してください");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await createProjectFromBrainstorm(
        {
          ideaSummary: brainstormState.ideaSummary ?? undefined,
          persona: brainstormState.persona ?? undefined,
          competitors: brainstormState.competitors,
          techStack: brainstormState.techStack,
          mvpFeatures: brainstormState.mvpFeatures,
          planSteps: brainstormState.planSteps.map((step) => ({
            title: step.title,
            estimatedMinutes: step.estimatedMinutes,
          })),
          conversationId,
        },
        title.trim()
      );

      if (result) {
        onOpenChange(false);
        router.push(`/projects/${result.project.id}`);
      } else {
        setError("プロジェクトの作成に失敗しました");
      }
    } catch {
      setError("予期せぬエラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  }, [title, brainstormState, conversationId, onOpenChange, router]);

  const handleClose = useCallback(() => {
    if (!isSaving) {
      setTitle("");
      setError(null);
      onOpenChange(false);
    }
  }, [isSaving, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">folder</span>
            プロジェクトとして保存
          </DialogTitle>
          <DialogDescription>
            壁打ち内容をプロジェクトとして保存し、タスク管理を開始します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Title */}
          <div className="space-y-2">
            <Label htmlFor="project-title">プロジェクト名 *</Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="例: タスク管理アプリ MVP"
              disabled={isSaving}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Summary Card */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">summarize</span>
              保存される内容
            </h4>

            <div className="space-y-2 text-sm">
              {brainstormState.ideaSummary && (
                <SummaryItem
                  icon="lightbulb"
                  label="アイデア概要"
                  value={brainstormState.ideaSummary}
                />
              )}

              {brainstormState.persona && (
                <SummaryItem
                  icon="person"
                  label="ターゲットペルソナ"
                  value={brainstormState.persona}
                />
              )}

              {brainstormState.competitors.length > 0 && (
                <SummaryItem
                  icon="trending_up"
                  label="競合"
                  value={brainstormState.competitors.join(", ")}
                />
              )}

              {brainstormState.techStack.length > 0 && (
                <SummaryItem
                  icon="code"
                  label="技術スタック"
                  value={brainstormState.techStack.join(", ")}
                />
              )}

              {brainstormState.mvpFeatures.length > 0 && (
                <SummaryItem
                  icon="rocket_launch"
                  label="MVP機能"
                  value={`${brainstormState.mvpFeatures.length}件の機能`}
                />
              )}

              {brainstormState.planSteps.length > 0 && (
                <SummaryItem
                  icon="checklist"
                  label="タスク"
                  value={`${brainstormState.planSteps.length}件のタスク`}
                />
              )}
            </div>
          </div>

          {/* Task Preview */}
          {brainstormState.planSteps.length > 0 && (
            <div className="space-y-2">
              <Label>タスクプレビュー</Label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {brainstormState.planSteps.map((step, index) => (
                  <TaskPreviewItem key={step.id} step={step} index={index} />
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">
                  progress_activity
                </span>
                保存中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">save</span>
                プロジェクトを作成
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryItem({
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

function TaskPreviewItem({
  step,
  index,
}: {
  step: PlanStep;
  index: number;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <span
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
          "bg-primary/10 text-primary"
        )}
      >
        {index + 1}
      </span>
      <span className="flex-1 truncate">{step.title}</span>
      {step.estimatedMinutes && (
        <span className="text-muted-foreground text-xs flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">schedule</span>
          {step.estimatedMinutes}分
        </span>
      )}
    </div>
  );
}
