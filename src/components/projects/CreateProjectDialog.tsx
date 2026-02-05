"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProjectType } from "@/types/project";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const PROJECT_TYPES: { value: ProjectType; label: string; description: string; icon: string }[] = [
  {
    value: "product",
    label: "プロダクト",
    description: "アプリやサービスの開発プロジェクト",
    icon: "rocket_launch",
  },
  {
    value: "learning",
    label: "学習",
    description: "技術の学習や練習プロジェクト",
    icon: "school",
  },
];

export function CreateProjectDialog({ open, onOpenChange, onCreated }: CreateProjectDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("product");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("プロジェクト名を入力してください");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          projectType,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success("プロジェクトを作成しました");
        setTitle("");
        setDescription("");
        setProjectType("product");
        onOpenChange(false);
        onCreated();
      } else {
        toast.error(result.error?.message || "プロジェクトの作成に失敗しました");
      }
    } catch {
      toast.error("プロジェクトの作成に失敗しました");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新規プロジェクト</DialogTitle>
          <DialogDescription>
            プロジェクトを作成して、会話や学びを整理しましょう
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="projectTitle">プロジェクト名 *</Label>
            <Input
              id="projectTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: SNSアプリ開発"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectDescription">説明</Label>
            <Input
              id="projectDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="プロジェクトの概要（任意）"
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label>プロジェクトタイプ</Label>
            <div className="grid grid-cols-2 gap-3">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setProjectType(type.value)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                    projectType === type.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span
                    className={cn(
                      "material-symbols-outlined text-xl mt-0.5",
                      projectType === type.value ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {type.icon}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !title.trim()}>
            {isCreating ? "作成中..." : "作成する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
