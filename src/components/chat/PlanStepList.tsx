"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PlanStep } from "@/types/chat";

interface PlanStepListProps {
  steps: PlanStep[];
  editable?: boolean;
  onStepsChange?: (steps: PlanStep[]) => void;
  onApprove?: (steps: PlanStep[]) => void;
}

export function PlanStepList({
  steps,
  editable = false,
  onStepsChange,
  onApprove,
}: PlanStepListProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleExpand = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const toggleComplete = (stepId: string) => {
    if (!editable || !onStepsChange) return;

    const updateSteps = (items: PlanStep[]): PlanStep[] =>
      items.map((step) => {
        if (step.id === stepId) {
          return { ...step, completed: !step.completed };
        }
        if (step.subSteps) {
          return { ...step, subSteps: updateSteps(step.subSteps) };
        }
        return step;
      });

    onStepsChange(updateSteps(steps));
  };

  const completedCount = countCompleted(steps);
  const totalCount = countTotal(steps);
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              checklist
            </span>
            実装計画
          </h3>
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount} 完了
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {steps.map((step, index) => (
          <PlanStepItem
            key={step.id}
            step={step}
            index={index + 1}
            isExpanded={expandedSteps.has(step.id)}
            onToggleExpand={() => toggleExpand(step.id)}
            onToggleComplete={() => toggleComplete(step.id)}
            editable={editable}
          />
        ))}
      </div>

      {/* Actions */}
      {onApprove && (
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onApprove(steps)}
              className="flex-1 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              この計画で進める
            </button>
            {editable && (
              <button className="py-2.5 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">
                修正する
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PlanStepItemProps {
  step: PlanStep;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleComplete: () => void;
  editable: boolean;
  depth?: number;
}

function PlanStepItem({
  step,
  index,
  isExpanded,
  onToggleExpand,
  onToggleComplete,
  editable,
  depth = 0,
}: PlanStepItemProps) {
  const hasSubSteps = step.subSteps && step.subSteps.length > 0;
  const subStepsCompleted = hasSubSteps
    ? step.subSteps!.filter((s) => s.completed).length
    : 0;
  const subStepsTotal = hasSubSteps ? step.subSteps!.length : 0;

  return (
    <div className={cn(depth > 0 && "border-l-2 border-border ml-6")}>
      <div
        className={cn(
          "p-4 flex items-start gap-3 transition-colors",
          editable && "hover:bg-muted/30"
        )}
      >
        {/* Checkbox / Number */}
        {editable ? (
          <button
            onClick={onToggleComplete}
            className={cn(
              "size-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
              step.completed
                ? "bg-green-500 border-green-500"
                : "border-border hover:border-primary"
            )}
          >
            {step.completed && (
              <span className="material-symbols-outlined text-white text-sm">
                check
              </span>
            )}
          </button>
        ) : (
          <div
            className={cn(
              "size-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
              step.completed
                ? "bg-green-500/20 text-green-400"
                : "bg-primary/20 text-primary"
            )}
          >
            {step.completed ? (
              <span className="material-symbols-outlined text-sm">check</span>
            ) : (
              index
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "font-medium text-sm",
                step.completed && "line-through text-muted-foreground"
              )}
            >
              {step.title}
            </p>
            {step.estimatedTime && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {step.estimatedTime}
              </span>
            )}
          </div>
          {step.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {step.description}
            </p>
          )}

          {/* SubSteps Summary */}
          {hasSubSteps && !isExpanded && (
            <p className="text-xs text-muted-foreground mt-2">
              サブタスク: {subStepsCompleted}/{subStepsTotal} 完了
            </p>
          )}
        </div>

        {/* Expand Button */}
        {hasSubSteps && (
          <button
            onClick={onToggleExpand}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
          >
            <span
              className={cn(
                "material-symbols-outlined text-lg transition-transform",
                isExpanded && "rotate-180"
              )}
            >
              expand_more
            </span>
          </button>
        )}
      </div>

      {/* SubSteps */}
      {hasSubSteps && isExpanded && (
        <div className="pb-2">
          {step.subSteps!.map((subStep, subIndex) => (
            <PlanStepItem
              key={subStep.id}
              step={subStep}
              index={subIndex + 1}
              isExpanded={false}
              onToggleExpand={() => {}}
              onToggleComplete={() => {}}
              editable={editable}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper functions
function countCompleted(steps: PlanStep[]): number {
  return steps.reduce((acc, step) => {
    let count = step.completed ? 1 : 0;
    if (step.subSteps) {
      count += countCompleted(step.subSteps);
    }
    return acc + count;
  }, 0);
}

function countTotal(steps: PlanStep[]): number {
  return steps.reduce((acc, step) => {
    let count = 1;
    if (step.subSteps) {
      count += countTotal(step.subSteps);
    }
    return acc + count;
  }, 0);
}

// AI-suggested plan preview
interface SuggestedPlanProps {
  steps: PlanStep[];
  onAccept: () => void;
  onModify: () => void;
  onSimplify: () => void;
}

export function SuggestedPlan({
  steps,
  onAccept,
  onModify,
  onSimplify,
}: SuggestedPlanProps) {
  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            auto_awesome
          </span>
          <span className="font-semibold text-sm">AIからの計画提案</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          以下の手順で進めることを提案します
        </p>
      </div>

      {/* Steps Preview */}
      <div className="p-4 space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-card/50"
          >
            <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
              {index + 1}
            </div>
            <span className="text-sm">{step.title}</span>
            {step.estimatedTime && (
              <span className="text-xs text-muted-foreground ml-auto">
                {step.estimatedTime}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-primary/20 flex items-center gap-2">
        <button
          onClick={onAccept}
          className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          この計画で進める
        </button>
        <button
          onClick={onModify}
          className="py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          修正する
        </button>
        <button
          onClick={onSimplify}
          className="py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          もっとシンプルに
        </button>
      </div>
    </div>
  );
}
