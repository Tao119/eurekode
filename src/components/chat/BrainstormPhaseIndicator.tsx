"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BRAINSTORM_PHASES, type BrainstormPhase } from "@/types/chat";

interface BrainstormPhaseIndicatorProps {
  currentPhase: BrainstormPhase;
  completedPhases?: BrainstormPhase[];
  onPhaseClick?: (phase: BrainstormPhase) => void;
  onPhaseSkip?: (phase: BrainstormPhase) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function BrainstormPhaseIndicator({
  currentPhase,
  completedPhases = [],
  onPhaseClick,
  onPhaseSkip,
  compact = false,
  disabled = false,
}: BrainstormPhaseIndicatorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const currentIndex = BRAINSTORM_PHASES.findIndex((p) => p.phase === currentPhase);

  if (compact) {
    return (
      <div className="relative z-[90]">
        {/* Compact Trigger Button */}
        <button
          onClick={(e) => {
            if (disabled) return;
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-colors shadow-md",
            disabled
              ? "bg-purple-900/30 border-purple-600/30 cursor-not-allowed opacity-60"
              : "bg-purple-700/50 border-purple-400/60 hover:bg-purple-600/60 hover:border-purple-300/70 cursor-pointer"
          )}
        >
          <span className="material-symbols-outlined text-purple-200 text-lg">
            {BRAINSTORM_PHASES[currentIndex]?.icon || "lightbulb"}
          </span>
          <span className="text-sm font-medium text-purple-100">
            {BRAINSTORM_PHASES[currentIndex]?.title || "壁打ち"}
          </span>
          <span className="text-xs text-purple-200/80">
            {currentIndex + 1}/{BRAINSTORM_PHASES.length}
          </span>
          <span className="material-symbols-outlined text-purple-200 text-sm">
            {showDropdown ? "expand_less" : "expand_more"}
          </span>
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <>
            {/* Backdrop - click to close */}
            <div
              className="fixed inset-0 z-[100] bg-black/20"
              onClick={() => setShowDropdown(false)}
            />
            {/* Dropdown Menu */}
            <div className="absolute right-0 top-full mt-2 z-[110] w-72 rounded-xl border border-purple-500/30 bg-card shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-purple-500/20 bg-purple-500/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-100">
                  <span className="material-symbols-outlined text-base text-purple-400">route</span>
                  <span>フェーズを選択</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  クリックで移動・スキップ
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                {BRAINSTORM_PHASES.map((phase, index) => {
                  const isCompleted = completedPhases.includes(phase.phase);
                  const isCurrent = phase.phase === currentPhase;
                  const isFuture = index > currentIndex;

                  const handleClick = () => {
                    if (isCurrent) return;
                    setShowDropdown(false);
                    if (isFuture && onPhaseSkip) {
                      onPhaseSkip(phase.phase);
                    } else if (onPhaseClick) {
                      onPhaseClick(phase.phase);
                    }
                  };

                  return (
                    <button
                      key={phase.phase}
                      onClick={handleClick}
                      disabled={isCurrent}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left",
                        isCurrent
                          ? "bg-purple-500/20 border border-purple-500/40 cursor-default"
                          : isCompleted
                            ? "bg-green-500/10 hover:bg-green-500/20 border border-transparent"
                            : isFuture
                              ? "bg-orange-500/10 hover:bg-orange-500/20 border border-dashed border-orange-500/30"
                              : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "size-8 rounded-full flex items-center justify-center flex-shrink-0",
                          isCurrent
                            ? "bg-purple-500/30"
                            : isCompleted
                              ? "bg-green-500/20"
                              : isFuture
                                ? "bg-orange-500/20"
                                : "bg-muted"
                        )}
                      >
                        {isCompleted && !isCurrent ? (
                          <span className="material-symbols-outlined text-green-400 text-base">check</span>
                        ) : isFuture ? (
                          <span className="material-symbols-outlined text-orange-400 text-base">skip_next</span>
                        ) : (
                          <span className={cn(
                            "material-symbols-outlined text-base",
                            isCurrent ? "text-purple-400" : "text-muted-foreground"
                          )}>
                            {phase.icon}
                          </span>
                        )}
                      </div>

                      {/* Phase Info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          isCurrent
                            ? "text-purple-400"
                            : isCompleted
                              ? "text-green-400"
                              : isFuture
                                ? "text-orange-400"
                                : "text-foreground"
                        )}>
                          {phase.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {phase.description}
                        </p>
                      </div>

                      {/* Badge */}
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 text-xs font-medium">
                          現在
                        </span>
                      )}
                      {isFuture && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/30 text-orange-300 text-xs font-medium">
                          スキップ
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card/50">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">壁打ちの進捗</h3>
        <span className="text-xs text-muted-foreground">
          ステップ {currentIndex + 1} / {BRAINSTORM_PHASES.length}
        </span>
      </div>

      {/* Phase List */}
      <div className="space-y-2">
        {BRAINSTORM_PHASES.map((phase, index) => {
          const isCompleted = completedPhases.includes(phase.phase);
          const isCurrent = phase.phase === currentPhase;
          const isFuture = index > currentIndex;
          const isClickable = !isCurrent && (onPhaseClick || onPhaseSkip);

          const handleClick = () => {
            if (isCurrent) return;
            if (isFuture && onPhaseSkip) {
              onPhaseSkip(phase.phase);
            } else if (onPhaseClick) {
              onPhaseClick(phase.phase);
            }
          };

          return (
            <button
              key={phase.phase}
              onClick={handleClick}
              disabled={!isClickable}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left",
                isCurrent
                  ? "bg-purple-500/10 border border-purple-500/30 cursor-default"
                  : isCompleted
                    ? "bg-green-500/5 border border-green-500/20 hover:bg-green-500/10"
                    : isFuture
                      ? "bg-orange-500/5 border border-dashed border-orange-500/20 hover:bg-orange-500/10"
                      : "bg-muted/30 border border-transparent opacity-50"
              )}
            >
              {/* Status Icon */}
              <div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center flex-shrink-0",
                  isCurrent
                    ? "bg-purple-500/20"
                    : isCompleted
                      ? "bg-green-500/20"
                      : isFuture
                        ? "bg-orange-500/20"
                        : "bg-muted"
                )}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-green-400 text-lg">
                    check
                  </span>
                ) : isFuture ? (
                  <span className="material-symbols-outlined text-orange-400 text-lg">
                    skip_next
                  </span>
                ) : (
                  <span
                    className={cn(
                      "material-symbols-outlined text-lg",
                      isCurrent ? "text-purple-400" : "text-muted-foreground"
                    )}
                  >
                    {phase.icon}
                  </span>
                )}
              </div>

              {/* Phase Info */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isCurrent
                      ? "text-purple-400"
                      : isCompleted
                        ? "text-green-400"
                        : isFuture
                          ? "text-orange-400"
                          : "text-muted-foreground"
                  )}
                >
                  {phase.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {phase.description}
                </p>
              </div>

              {/* Status Badge */}
              {isCurrent && (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                  現在
                </span>
              )}
              {isFuture && (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium">
                  スキップ
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
              style={{
                width: `${((currentIndex + 1) / BRAINSTORM_PHASES.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {Math.round(((currentIndex + 1) / BRAINSTORM_PHASES.length) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Phase Transition Card - shown when moving between phases
interface PhaseTransitionCardProps {
  fromPhase: BrainstormPhase;
  toPhase: BrainstormPhase;
  onContinue: () => void;
  onBack: () => void;
}

export function PhaseTransitionCard({
  fromPhase,
  toPhase,
  onContinue,
  onBack,
}: PhaseTransitionCardProps) {
  const fromConfig = BRAINSTORM_PHASES.find((p) => p.phase === fromPhase);
  const toConfig = BRAINSTORM_PHASES.find((p) => p.phase === toPhase);

  if (!fromConfig || !toConfig) return null;

  return (
    <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5">
      {/* Completed Phase */}
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-green-400">
          check_circle
        </span>
        <span className="text-sm">
          <span className="font-medium">{fromConfig.title}</span>
          <span className="text-muted-foreground"> が完了しました</span>
        </span>
      </div>

      {/* Next Phase Preview */}
      <div className="p-3 rounded-lg bg-card/50 border border-border mb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-purple-400 text-xl">
              {toConfig.icon}
            </span>
          </div>
          <div>
            <p className="font-medium text-sm">次: {toConfig.title}</p>
            <p className="text-xs text-muted-foreground">{toConfig.description}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onContinue}
          className="flex-1 py-2 px-4 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors"
        >
          次へ進む
        </button>
        <button
          onClick={onBack}
          className="py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          前に戻る
        </button>
      </div>
    </div>
  );
}
