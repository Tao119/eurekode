"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { InteractiveQuestion, InteractiveQuizForm } from "@/types/chat";

interface InteractiveQuizProps {
  quiz: InteractiveQuizForm;
  onSubmit: (formattedAnswer: string) => void;
  disabled?: boolean;
}

export function InteractiveQuiz({ quiz, onSubmit, disabled = false }: InteractiveQuizProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const allAnswered = useMemo(() => {
    return quiz.questions.every((q) => answers[q.id]?.trim());
  }, [quiz.questions, answers]);

  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!allAnswered || disabled) return;

    // Format the answer combining all responses
    const formattedParts: string[] = [];

    for (const question of quiz.questions) {
      const answer = answers[question.id];
      if (question.type === "choice") {
        formattedParts.push(answer);
      } else if (question.type === "fill") {
        formattedParts.push(`${question.contextBefore || ""}${answer}${question.contextAfter || ""}`);
      } else {
        formattedParts.push(`${question.questionText}: ${answer}`);
      }
    }

    onSubmit(formattedParts.join("\n"));
  }, [allAnswered, disabled, quiz.questions, answers, onSubmit]);

  const answeredCount = Object.values(answers).filter((a) => a?.trim()).length;
  const totalCount = quiz.questions.length;

  return (
    <div className="mt-4 space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="material-symbols-outlined text-lg text-primary">edit_note</span>
        <span>
          {disabled ? "回答済み" : `${answeredCount}/${totalCount} 回答中`}
        </span>
        {!disabled && (
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(answeredCount / totalCount) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {quiz.questions.map((question, index) => (
          <QuestionInput
            key={question.id}
            question={question}
            index={index}
            value={answers[question.id] || ""}
            onChange={(value) => handleAnswerChange(question.id, value)}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Submit button */}
      {!disabled && (
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={cn(
            "w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
            allAnswered
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <span className="material-symbols-outlined text-xl">send</span>
          {allAnswered ? "回答を送信" : "すべての質問に回答してください"}
        </button>
      )}
    </div>
  );
}

interface QuestionInputProps {
  question: InteractiveQuestion;
  index: number;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

function QuestionInput({ question, index, value, onChange, disabled }: QuestionInputProps) {
  switch (question.type) {
    case "choice":
      return (
        <ChoiceQuestion
          question={question}
          index={index}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "fill":
      return (
        <FillQuestion
          question={question}
          index={index}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "text":
      return (
        <TextQuestion
          question={question}
          index={index}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}

function ChoiceQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
}: QuestionInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
          {index + 1}
        </span>
        <span>選択してください</span>
      </div>
      <div className="grid gap-2">
        {question.options?.map((option) => {
          const isSelected = value === `${option.label}) ${option.text}`;
          return (
            <button
              key={option.label}
              onClick={() => onChange(`${option.label}) ${option.text}`)}
              disabled={disabled}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                disabled
                  ? "border-border/50 bg-muted/30 cursor-not-allowed opacity-60"
                  : isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-primary/5 hover:border-primary/50"
              )}
            >
              <span className="inline-flex items-center gap-3">
                <span
                  className={cn(
                    "flex-shrink-0 size-7 rounded-full font-bold flex items-center justify-center text-sm transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/20 text-primary"
                  )}
                >
                  {option.label}
                </span>
                <span className={isSelected ? "text-foreground font-medium" : "text-foreground/90"}>
                  {option.text}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FillQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
}: QuestionInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="size-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs">
          {index + 1}
        </span>
        <span>穴埋め</span>
      </div>
      <div className="p-3 rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
          {question.contextBefore && (
            <span className="text-muted-foreground">{question.contextBefore}</span>
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={question.placeholder || "????"}
            className={cn(
              "px-3 py-1.5 rounded border bg-background text-foreground font-mono",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
              "min-w-[100px] max-w-[200px]",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          />
          {question.contextAfter && (
            <span className="text-muted-foreground">{question.contextAfter}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TextQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
}: QuestionInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="size-6 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center text-xs">
          {index + 1}
        </span>
        <span>{question.questionText}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="回答を入力..."
        rows={2}
        className={cn(
          "w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
          "resize-none",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      />
    </div>
  );
}
