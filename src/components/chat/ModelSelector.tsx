"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ClaudeModel } from "@/types/chat";
import { CLAUDE_MODELS, getModelConfig } from "@/types/chat";
import { MODEL_CONSUMPTION_RATE, MODEL_DISPLAY_NAMES, type AIModel } from "@/config/plans";

// ClaudeModel から AIModel へのマッピング
function toAIModel(claudeModel: ClaudeModel): AIModel {
  return claudeModel === "opus" ? "opus" : "sonnet";
}

interface ModelSelectorProps {
  selectedModel: ClaudeModel;
  onModelChange: (model: ClaudeModel) => void;
  /** 利用可能なモデル（プランに基づく） */
  availableModels?: AIModel[];
  /** 残りポイント */
  remainingPoints?: number;
  /** ポイントコストを表示 */
  showPointCost?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  availableModels = ["sonnet", "opus"],
  remainingPoints,
  showPointCost = true,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = getModelConfig(selectedModel);
  const currentAIModel = toAIModel(selectedModel);
  const currentPointCost = MODEL_CONSUMPTION_RATE[currentAIModel];

  // モデルが利用可能かチェック
  const isModelAvailable = (model: ClaudeModel): boolean => {
    const aiModel = toAIModel(model);
    return availableModels.includes(aiModel);
  };

  // 残りポイントで何回会話できるか
  const getRemainingConversations = (model: ClaudeModel): number | undefined => {
    if (remainingPoints === undefined) return undefined;
    const cost = MODEL_CONSUMPTION_RATE[toAIModel(model)];
    return Math.floor(remainingPoints / cost);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tierColors: Record<string, string> = {
    premium: "text-amber-500",
    standard: "text-blue-500",
    economy: "text-green-500",
  };

  const tierBgColors: Record<string, string> = {
    premium: "bg-amber-500/10",
    standard: "bg-blue-500/10",
    economy: "bg-green-500/10",
  };

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "bg-muted/50"
        )}
      >
        <span className={cn("material-symbols-outlined text-lg", tierColors[currentModel.tier])}>
          {currentModel.icon}
        </span>
        <span className="text-sm font-medium">{currentModel.name}</span>
        {showPointCost && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {currentPointCost}pt
          </span>
        )}
        <span className="material-symbols-outlined text-sm text-muted-foreground">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-1">
            {CLAUDE_MODELS.filter((m) => m.id !== "haiku").map((model) => {
              const available = isModelAvailable(model.id);
              const pointCost = MODEL_CONSUMPTION_RATE[toAIModel(model.id)];
              const remaining = getRemainingConversations(model.id);

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    if (available) {
                      onModelChange(model.id);
                      setIsOpen(false);
                    }
                  }}
                  disabled={!available}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left",
                    selectedModel === model.id
                      ? "bg-primary/10 text-primary"
                      : available
                      ? "hover:bg-muted"
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div
                    className={cn(
                      "size-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      tierBgColors[model.tier]
                    )}
                  >
                    <span
                      className={cn("material-symbols-outlined", tierColors[model.tier])}
                    >
                      {model.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{model.name}</span>
                      {showPointCost && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          model.id === "opus"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        )}>
                          {pointCost}pt
                        </span>
                      )}
                      {selectedModel === model.id && (
                        <span className="material-symbols-outlined text-sm text-primary">
                          check
                        </span>
                      )}
                      {!available && (
                        <span className="text-xs text-muted-foreground">
                          (要アップグレード)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {model.description}
                    </p>
                    {remaining !== undefined && available && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        残り約{remaining}回
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
