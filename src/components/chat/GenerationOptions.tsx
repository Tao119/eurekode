"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GenerationOptions } from "@/hooks/useGenerationMode";

interface GenerationOptionsBarProps {
  options: GenerationOptions;
  onOptionsChange: (options: Partial<GenerationOptions>) => void;
  disabled?: boolean;
  canSkip?: boolean; // 管理者設定でスキップが許可されているか
}

export function GenerationOptionsBar({
  options,
  onOptionsChange,
  disabled = false,
  canSkip = false,
}: GenerationOptionsBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-t border-border bg-muted/30">
      {/* コンパクトビュー */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          {/* アンロック方式の簡易表示 */}
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-muted-foreground">
              lock_open
            </span>
            <span className="text-muted-foreground">
              {options.unlockMethod === "quiz" && "クイズ形式"}
              {options.unlockMethod === "explanation" && "説明形式"}
              {options.unlockMethod === "skip" && "スキップ可"}
            </span>
          </div>

          {/* ヒント速度の簡易表示 */}
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-muted-foreground">
              lightbulb
            </span>
            <span className="text-muted-foreground">
              {options.hintSpeed === "immediate" && "ヒント即座"}
              {options.hintSpeed === "30sec" && "30秒後"}
              {options.hintSpeed === "none" && "ヒントなし"}
            </span>
          </div>

          {/* 見積もり訓練 */}
          {options.estimationTraining && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-muted-foreground">
                timer
              </span>
              <span className="text-muted-foreground">見積もり訓練</span>
            </div>
          )}
        </div>

        {/* 展開ボタン */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">tune</span>
          設定
          <span
            className={cn(
              "material-symbols-outlined text-sm transition-transform",
              isExpanded && "rotate-180"
            )}
          >
            expand_more
          </span>
        </button>
      </div>

      {/* 展開ビュー */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
          {/* アンロック方式 */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              アンロック方式
            </label>
            <div className="flex gap-2">
              {[
                { value: "quiz", label: "クイズ", icon: "quiz", description: "選択式で理解を確認" },
                { value: "explanation", label: "説明", icon: "chat", description: "自分の言葉で説明" },
                ...(canSkip
                  ? [{ value: "skip", label: "スキップ", icon: "skip_next", description: "理解確認なし" }]
                  : []),
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onOptionsChange({ unlockMethod: item.value as GenerationOptions["unlockMethod"] })}
                  disabled={disabled}
                  className={cn(
                    "flex-1 p-3 rounded-lg border text-left transition-all disabled:opacity-50",
                    options.unlockMethod === item.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "material-symbols-outlined text-lg",
                      options.unlockMethod === item.value ? "text-primary" : "text-muted-foreground"
                    )}>
                      {item.icon}
                    </span>
                    <span className={cn(
                      "text-sm font-medium",
                      options.unlockMethod === item.value && "text-primary"
                    )}>
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
              <label className="text-sm font-medium mb-2 block">
                ヒント表示タイミング
              </label>
              <div className="flex gap-2">
                {[
                  { value: "immediate", label: "即座に", description: "すぐにヒントを表示" },
                  { value: "30sec", label: "30秒後", description: "少し考えてから" },
                  { value: "none", label: "なし", description: "ヒントなしで挑戦" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => onOptionsChange({ hintSpeed: item.value as GenerationOptions["hintSpeed"] })}
                    disabled={disabled}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-center transition-all disabled:opacity-50",
                      options.hintSpeed === item.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium",
                      options.hintSpeed === item.value && "text-primary"
                    )}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 見積もり訓練 */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">見積もり訓練</span>
              <p className="text-xs text-muted-foreground">
                実装時間を予測して、見積もり力を鍛える
              </p>
            </div>
            <button
              onClick={() => onOptionsChange({ estimationTraining: !options.estimationTraining })}
              disabled={disabled}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors disabled:opacity-50",
                options.estimationTraining ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform",
                  options.estimationTraining && "translate-x-5"
                )}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
