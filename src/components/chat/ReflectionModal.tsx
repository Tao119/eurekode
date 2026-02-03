"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReflectionData } from "@/types/chat";

interface ReflectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reflection: ReflectionData) => void;
}

type QuickReflectionType = "good" | "okay" | "difficult";

const QUICK_REFLECTIONS = [
  { type: "good" as const, emoji: "😊", label: "よく理解できた", color: "green" },
  { type: "okay" as const, emoji: "🤔", label: "まあまあ", color: "amber" },
  { type: "difficult" as const, emoji: "😅", label: "難しかった", color: "red" },
];

export function ReflectionModal({
  open,
  onOpenChange,
  onSubmit,
}: ReflectionModalProps) {
  const [step, setStep] = useState<"quick" | "detailed">("quick");
  const [quickReflection, setQuickReflection] = useState<QuickReflectionType | null>(null);
  const [detailedReflection, setDetailedReflection] = useState({
    whatDid: "",
    whatLearned: "",
    whyHappened: "",
    whatNext: "",
  });

  const handleQuickSelect = (type: QuickReflectionType) => {
    setQuickReflection(type);
  };

  const handleSubmitQuick = () => {
    if (quickReflection) {
      onSubmit({ quickReflection });
      handleClose();
    }
  };

  const handleSubmitDetailed = () => {
    onSubmit({
      quickReflection: quickReflection ?? undefined,
      detailedReflection,
    });
    handleClose();
  };

  const handleClose = () => {
    setStep("quick");
    setQuickReflection(null);
    setDetailedReflection({
      whatDid: "",
      whatLearned: "",
      whyHappened: "",
      whatNext: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              psychology
            </span>
            今日の振り返り
          </DialogTitle>
        </DialogHeader>

        {step === "quick" ? (
          <QuickReflectionStep
            selected={quickReflection}
            onSelect={handleQuickSelect}
            onSubmit={handleSubmitQuick}
            onExpandDetailed={() => setStep("detailed")}
          />
        ) : (
          <DetailedReflectionStep
            quickReflection={quickReflection}
            values={detailedReflection}
            onChange={setDetailedReflection}
            onSubmit={handleSubmitDetailed}
            onBack={() => setStep("quick")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface QuickReflectionStepProps {
  selected: QuickReflectionType | null;
  onSelect: (type: QuickReflectionType) => void;
  onSubmit: () => void;
  onExpandDetailed: () => void;
}

function QuickReflectionStep({
  selected,
  onSelect,
  onSubmit,
  onExpandDetailed,
}: QuickReflectionStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        今日のセッションはどうでしたか？
      </p>

      {/* Quick Selection */}
      <div className="grid grid-cols-3 gap-3">
        {QUICK_REFLECTIONS.map((item) => (
          <button
            key={item.type}
            onClick={() => onSelect(item.type)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
              selected === item.type
                ? item.color === "green"
                  ? "border-green-500 bg-green-500/10"
                  : item.color === "amber"
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-red-500 bg-red-500/10"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            <span className="text-3xl">{item.emoji}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onSubmit}
          disabled={!selected}
          className={cn(
            "w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors",
            selected
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          この内容で完了
        </button>
        <button
          onClick={onExpandDetailed}
          className="w-full py-2.5 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          詳しく書く
        </button>
      </div>
    </div>
  );
}

interface DetailedReflectionStepProps {
  quickReflection: QuickReflectionType | null;
  values: {
    whatDid: string;
    whatLearned: string;
    whyHappened: string;
    whatNext: string;
  };
  onChange: (values: {
    whatDid: string;
    whatLearned: string;
    whyHappened: string;
    whatNext: string;
  }) => void;
  onSubmit: () => void;
  onBack: () => void;
}

const REFLECTION_QUESTIONS = [
  { key: "whatDid" as const, label: "何をした？", icon: "description", placeholder: "今日取り組んだことを書いてください" },
  { key: "whatLearned" as const, label: "何がわかった？", icon: "lightbulb", placeholder: "新しく学んだこと、気づいたことを書いてください" },
  { key: "whyHappened" as const, label: "なぜそうなった？", icon: "search", placeholder: "うまくいった/いかなかった理由を考えてみましょう" },
  { key: "whatNext" as const, label: "次どうする？", icon: "arrow_forward", placeholder: "次回やりたいこと、改善したいことを書いてください" },
];

function DetailedReflectionStep({
  quickReflection,
  values,
  onChange,
  onSubmit,
  onBack,
}: DetailedReflectionStepProps) {
  const handleChange = (key: keyof typeof values, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const hasContent = Object.values(values).some((v) => v.trim());

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        戻る
      </button>

      {/* Quick Reflection Display */}
      {quickReflection && (
        <div className={cn(
          "flex items-center gap-2 p-2 rounded-lg text-sm",
          quickReflection === "good" ? "bg-green-500/10 text-green-400" :
          quickReflection === "okay" ? "bg-amber-500/10 text-amber-400" :
          "bg-red-500/10 text-red-400"
        )}>
          <span>{QUICK_REFLECTIONS.find(r => r.type === quickReflection)?.emoji}</span>
          <span>{QUICK_REFLECTIONS.find(r => r.type === quickReflection)?.label}</span>
        </div>
      )}

      {/* Reflection Questions */}
      <div className="space-y-4">
        {REFLECTION_QUESTIONS.map((question) => (
          <div key={question.key}>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <span className="material-symbols-outlined text-primary text-lg">
                {question.icon}
              </span>
              {question.label}
            </label>
            <textarea
              value={values[question.key]}
              onChange={(e) => handleChange(question.key, e.target.value)}
              placeholder={question.placeholder}
              className="w-full min-h-[80px] p-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={!hasContent && !quickReflection}
        className={cn(
          "w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors",
          hasContent || quickReflection
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        振り返りを保存
      </button>
    </div>
  );
}

// Trigger button component
interface ReflectionTriggerProps {
  onClick: () => void;
  compact?: boolean;
}

export function ReflectionTrigger({ onClick, compact = false }: ReflectionTriggerProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">psychology</span>
        振り返り
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card/50">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-xl">
            psychology
          </span>
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">今日の振り返りを書きましょう</p>
          <p className="text-xs text-muted-foreground">
            学んだことを整理すると、記憶に残りやすくなります
          </p>
        </div>
        <button
          onClick={onClick}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          書く
        </button>
      </div>
    </div>
  );
}
