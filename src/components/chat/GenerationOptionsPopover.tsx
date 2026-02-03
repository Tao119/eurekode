"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GenerationOptions } from "@/hooks/useGenerationMode";

interface GenerationOptionsPopoverProps {
  options: GenerationOptions;
  onOptionsChange: (options: Partial<GenerationOptions>) => void;
  disabled?: boolean;
  canSkip?: boolean;
}

export function GenerationOptionsPopover({
  options,
  onOptionsChange,
  disabled = false,
  canSkip = false,
}: GenerationOptionsPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed",
            !disabled && "hover:border-yellow-500/50"
          )}
        >
          <span className="material-symbols-outlined text-base text-yellow-400">
            tune
          </span>
          <span className="hidden sm:inline">設定</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="hidden md:inline">
              {options.unlockMethod === "quiz" && "クイズ"}
              {options.unlockMethod === "explanation" && "説明"}
              {options.unlockMethod === "skip" && "スキップ"}
            </span>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined text-yellow-400">
              tune
            </span>
            生成モード設定
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* アンロック方式 */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              アンロック方式
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: "quiz",
                  label: "クイズ",
                  icon: "quiz",
                  description: "選択式で理解を確認",
                },
                {
                  value: "explanation",
                  label: "説明",
                  icon: "chat",
                  description: "自分の言葉で説明",
                },
                ...(canSkip
                  ? [
                      {
                        value: "skip",
                        label: "スキップ",
                        icon: "skip_next",
                        description: "理解確認なし",
                      },
                    ]
                  : []),
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() =>
                    onOptionsChange({
                      unlockMethod:
                        item.value as GenerationOptions["unlockMethod"],
                    })
                  }
                  disabled={disabled}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all disabled:opacity-50",
                    options.unlockMethod === item.value
                      ? "border-yellow-500 bg-yellow-500/10"
                      : "border-border hover:border-yellow-500/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "material-symbols-outlined text-lg",
                        options.unlockMethod === item.value
                          ? "text-yellow-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {item.icon}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        options.unlockMethod === item.value && "text-yellow-400"
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ヒント速度（クイズ形式の場合のみ） */}
          {options.unlockMethod === "quiz" && (
            <div>
              <label className="text-sm font-medium mb-3 block">
                ヒント表示タイミング
              </label>
              <div className="flex gap-2">
                {[
                  {
                    value: "immediate",
                    label: "即座に",
                    description: "すぐにヒントを表示",
                  },
                  {
                    value: "30sec",
                    label: "30秒後",
                    description: "少し考えてから",
                  },
                  {
                    value: "none",
                    label: "なし",
                    description: "ヒントなしで挑戦",
                  },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() =>
                      onOptionsChange({
                        hintSpeed: item.value as GenerationOptions["hintSpeed"],
                      })
                    }
                    disabled={disabled}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-center transition-all disabled:opacity-50",
                      options.hintSpeed === item.value
                        ? "border-yellow-500 bg-yellow-500/10"
                        : "border-border hover:border-yellow-500/50"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        options.hintSpeed === item.value && "text-yellow-400"
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 現在の設定サマリー */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="text-xs text-muted-foreground mb-2">現在の設定</div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 text-xs">
                <span className="material-symbols-outlined text-sm">
                  lock_open
                </span>
                {options.unlockMethod === "quiz" && "クイズ形式"}
                {options.unlockMethod === "explanation" && "説明形式"}
                {options.unlockMethod === "skip" && "スキップ可"}
              </span>
              {options.unlockMethod === "quiz" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 text-xs">
                  <span className="material-symbols-outlined text-sm">
                    lightbulb
                  </span>
                  {options.hintSpeed === "immediate" && "ヒント即座"}
                  {options.hintSpeed === "30sec" && "30秒後"}
                  {options.hintSpeed === "none" && "ヒントなし"}
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
