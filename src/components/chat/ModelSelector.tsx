"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ClaudeModel } from "@/types/chat";
import { CLAUDE_MODELS, getModelConfig } from "@/types/chat";
import type { AIModel } from "@/config/plans";

// ClaudeModel から AIModel へのマッピング
function toAIModel(claudeModel: ClaudeModel): AIModel {
  return claudeModel === "opus" ? "opus" : "sonnet";
}

// モデルごとの説明文（Opusには消費が早い旨を追加）
const MODEL_DESCRIPTIONS: Record<ClaudeModel, string> = {
  opus: "最高性能・複雑な推論に最適（ポイント消費が早い）",
  sonnet: "バランス型・コーディングに最適",
  haiku: "高速・軽量タスクに最適",
};

// モジュールレベル定数: レンダリング毎の再生成を防止
const TIER_COLORS: Record<string, string> = {
  premium: "text-amber-500",
  standard: "text-blue-500",
  economy: "text-green-500",
};

const TIER_BG_COLORS: Record<string, string> = {
  premium: "bg-amber-500/10",
  standard: "bg-blue-500/10",
  economy: "bg-green-500/10",
};

interface ModelSelectorProps {
  selectedModel: ClaudeModel;
  onModelChange: (model: ClaudeModel) => void;
  /** 利用可能なモデル（プランに基づく） */
  availableModels?: AIModel[];
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  availableModels = ["sonnet", "opus"],
  disabled = false,
  className,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = getModelConfig(selectedModel);

  // モデルが利用可能かチェック
  const isModelAvailable = (model: ClaudeModel): boolean => {
    const aiModel = toAIModel(model);
    return availableModels.includes(aiModel);
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

  return (
    <div ref={dropdownRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap",
          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "bg-muted/50"
        )}
      >
        <span className={cn("material-symbols-outlined text-lg", TIER_COLORS[currentModel.tier])}>
          {currentModel.icon}
        </span>
        <span className="text-sm font-medium">{currentModel.name}</span>
        <span className="material-symbols-outlined text-sm text-muted-foreground">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-1">
            {CLAUDE_MODELS.filter((m) => m.id !== "haiku").map((model) => {
              const available = isModelAvailable(model.id);

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
                      TIER_BG_COLORS[model.tier]
                    )}
                  >
                    <span
                      className={cn("material-symbols-outlined", TIER_COLORS[model.tier])}
                    >
                      {model.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{model.name}</span>
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
                      {MODEL_DESCRIPTIONS[model.id]}
                    </p>
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
