"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PlanningHelperProps {
  onSubmitPlan: (steps: string[], estimate?: number) => void;
  showEstimation?: boolean;
  suggestedSteps?: string[];
}

// よくある実装ステップのテンプレート
const STEP_TEMPLATES = {
  general: [
    "必要な要件を整理する",
    "データ構造を設計する",
    "関数のインターフェースを決める",
    "メインロジックを実装する",
    "エラーハンドリングを追加する",
    "テストを書く",
  ],
  api: [
    "APIエンドポイントを設計する",
    "リクエスト/レスポンスの型を定義する",
    "データフェッチ関数を作成する",
    "エラーハンドリングを実装する",
    "ローディング状態を管理する",
  ],
  component: [
    "コンポーネントの責務を明確にする",
    "Propsのインターフェースを定義する",
    "UIの基本構造を作成する",
    "状態管理を実装する",
    "イベントハンドラーを追加する",
    "スタイリングを適用する",
  ],
  form: [
    "フォームの項目を決める",
    "バリデーションルールを定義する",
    "入力コンポーネントを配置する",
    "送信処理を実装する",
    "エラー表示を追加する",
  ],
};

type TemplateType = keyof typeof STEP_TEMPLATES;

// 見積もり時間のプリセット
const TIME_PRESETS = [
  { label: "5分", value: 5 },
  { label: "15分", value: 15 },
  { label: "30分", value: 30 },
  { label: "1時間", value: 60 },
  { label: "2時間以上", value: 120 },
];

export function PlanningHelper({
  onSubmitPlan,
  showEstimation = true,
  suggestedSteps,
}: PlanningHelperProps) {
  const [steps, setSteps] = useState<string[]>([]);
  const [newStep, setNewStep] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);

  // ステップを追加
  const addStep = useCallback((step: string) => {
    if (step.trim()) {
      setSteps((prev) => [...prev, step.trim()]);
      setNewStep("");
    }
  }, []);

  // ステップを削除
  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ステップを並び替え
  const moveStep = useCallback((index: number, direction: "up" | "down") => {
    setSteps((prev) => {
      const newSteps = [...prev];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newSteps.length) return prev;
      [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
      return newSteps;
    });
  }, []);

  // テンプレートを適用
  const applyTemplate = useCallback((type: TemplateType) => {
    setSteps(STEP_TEMPLATES[type]);
    setSelectedTemplate(type);
    setShowTemplates(false);
  }, []);

  // 提出
  const handleSubmit = useCallback(() => {
    if (steps.length > 0) {
      onSubmitPlan(steps, estimate ?? undefined);
    }
  }, [steps, estimate, onSubmitPlan]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">checklist</span>
          <span className="font-medium">実装計画を立てましょう</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          どんな手順で実装するか、ステップに分けて考えてみてください
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* テンプレート選択 */}
        {showTemplates && steps.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              テンプレートから始める:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(STEP_TEMPLATES) as TemplateType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => applyTemplate(type)}
                  className={cn(
                    "p-3 rounded-lg border border-border text-left transition-all",
                    "hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <span className="text-sm font-medium capitalize">
                    {type === "general" && "一般的な実装"}
                    {type === "api" && "API連携"}
                    {type === "component" && "UIコンポーネント"}
                    {type === "form" && "フォーム"}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {STEP_TEMPLATES[type].length}ステップ
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>または自分で作成</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        )}

        {/* AIからの提案ステップ */}
        {suggestedSteps && suggestedSteps.length > 0 && steps.length === 0 && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm font-medium text-blue-400 mb-2">
              AIからの提案:
            </p>
            <div className="space-y-1">
              {suggestedSteps.map((step, index) => (
                <button
                  key={index}
                  onClick={() => setSteps(suggestedSteps)}
                  className="w-full text-left text-sm text-foreground/80 hover:text-foreground"
                >
                  {index + 1}. {step}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSteps(suggestedSteps)}
              className="mt-2 text-blue-400 hover:text-blue-300"
            >
              この計画を使用する
            </Button>
          </div>
        )}

        {/* ステップリスト */}
        {steps.length > 0 && (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 group"
              >
                <span className="flex-shrink-0 size-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm">{step}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveStep(index, "up")}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  </button>
                  <button
                    onClick={() => moveStep(index, "down")}
                    disabled={index === steps.length - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                  </button>
                  <button
                    onClick={() => removeStep(index)}
                    className="p-1 rounded hover:bg-red-500/20 text-red-400"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 新しいステップを追加 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addStep(newStep);
              }
            }}
            placeholder="ステップを追加..."
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button
            onClick={() => addStep(newStep)}
            disabled={!newStep.trim()}
            size="sm"
          >
            <span className="material-symbols-outlined text-sm">add</span>
          </Button>
        </div>

        {/* 見積もり */}
        {showEstimation && steps.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium mb-2">
              この実装にどれくらいかかると思いますか？
            </p>
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setEstimate(preset.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-all",
                    estimate === preset.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 送信ボタン */}
        <Button
          onClick={handleSubmit}
          disabled={steps.length === 0}
          className="w-full"
        >
          <span className="material-symbols-outlined text-lg mr-2">send</span>
          この計画で進める
          {steps.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
              {steps.length}ステップ
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
