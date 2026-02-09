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
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalCount = quiz.questions.length;
  const currentQuestion = quiz.questions[currentIndex];
  const isLastQuestion = currentIndex === totalCount - 1;

  // Format all answers and submit
  const submitAllAnswers = useCallback((finalAnswers: Record<string, string>) => {
    const formattedParts: string[] = [];

    for (const question of quiz.questions) {
      const answer = finalAnswers[question.id];
      if (question.type === "choice") {
        formattedParts.push(answer);
      } else if (question.type === "fill") {
        formattedParts.push(`${question.contextBefore || ""}${answer}${question.contextAfter || ""}`);
      } else {
        formattedParts.push(`${question.questionText}: ${answer}`);
      }
    }

    onSubmit(formattedParts.join("\n"));
  }, [quiz.questions, onSubmit]);

  // Handle answer and auto-advance
  const handleAnswerChange = useCallback((questionId: string, value: string, autoAdvance: boolean = false) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (autoAdvance && value.trim()) {
      if (isLastQuestion) {
        // Last question - submit immediately
        submitAllAnswers(newAnswers);
      } else {
        // Move to next question
        setCurrentIndex((prev) => prev + 1);
      }
    }
  }, [answers, isLastQuestion, submitAllAnswers]);

  // Handle Enter key for fill/text types
  const handleEnterSubmit = useCallback((questionId: string, value: string) => {
    if (!value.trim()) return;

    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      submitAllAnswers(newAnswers);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [answers, isLastQuestion, submitAllAnswers]);

  // Go back to previous question
  const handleGoBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Count answered questions for progress
  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((a) => a?.trim()).length;
  }, [answers]);

  return (
    <div className="mt-4 space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="material-symbols-outlined text-lg text-primary">edit_note</span>
        <span>
          {disabled ? "回答済み" : `${currentIndex + 1}/${totalCount}`}
        </span>
        {!disabled && totalCount > 1 && (
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Current Question */}
      {!disabled && currentQuestion && (
        <div className="space-y-4">
          <QuestionInput
            key={currentQuestion.id}
            question={currentQuestion}
            index={currentIndex}
            value={answers[currentQuestion.id] || ""}
            onChange={(value, autoAdvance) => handleAnswerChange(currentQuestion.id, value, autoAdvance)}
            onEnterSubmit={(value) => handleEnterSubmit(currentQuestion.id, value)}
            disabled={disabled}
            isLastQuestion={isLastQuestion}
          />

          {/* Back button (only show if not first question) */}
          {currentIndex > 0 && (
            <button
              onClick={handleGoBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              前の質問に戻る
            </button>
          )}
        </div>
      )}

      {/* Show all answers when disabled (already submitted) */}
      {disabled && (
        <div className="space-y-4">
          {quiz.questions.map((question, index) => (
            <QuestionInput
              key={question.id}
              question={question}
              index={index}
              value={answers[question.id] || ""}
              onChange={() => {}}
              onEnterSubmit={() => {}}
              disabled={true}
              isLastQuestion={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface QuestionInputProps {
  question: InteractiveQuestion;
  index: number;
  value: string;
  onChange: (value: string, autoAdvance?: boolean) => void;
  onEnterSubmit: (value: string) => void;
  disabled: boolean;
  isLastQuestion: boolean;
}

function QuestionInput({ question, index, value, onChange, onEnterSubmit, disabled, isLastQuestion }: QuestionInputProps) {
  switch (question.type) {
    case "choice":
      return (
        <ChoiceQuestion
          question={question}
          index={index}
          value={value}
          onChange={onChange}
          onEnterSubmit={onEnterSubmit}
          disabled={disabled}
          isLastQuestion={isLastQuestion}
        />
      );
    case "fill":
      return (
        <FillQuestion
          question={question}
          index={index}
          value={value}
          onChange={onChange}
          onEnterSubmit={onEnterSubmit}
          disabled={disabled}
          isLastQuestion={isLastQuestion}
        />
      );
    case "text":
      return (
        <TextQuestion
          question={question}
          index={index}
          value={value}
          onChange={onChange}
          onEnterSubmit={onEnterSubmit}
          disabled={disabled}
          isLastQuestion={isLastQuestion}
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
  isLastQuestion,
}: QuestionInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 text-sm font-medium">
        <span className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs shrink-0 mt-0.5">
          {index + 1}
        </span>
        <span>{question.questionText || "選択してください"}</span>
      </div>
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {question.options?.map((option) => {
          const optionValue = `${option.label}) ${option.text}`;
          const isSelected = value === optionValue;
          return (
            <button
              key={option.label}
              onClick={() => onChange(optionValue, true)} // autoAdvance=true for choice
              disabled={disabled}
              className={cn(
                "w-full text-left p-3 sm:p-3.5 rounded-xl border transition-all overflow-hidden",
                "min-h-[48px]", // Minimum touch target size
                disabled
                  ? "border-border/50 bg-muted/30 cursor-not-allowed opacity-60"
                  : isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-primary/5 hover:border-primary/50"
              )}
            >
              <span className="flex items-start gap-2.5 sm:gap-3">
                <span
                  className={cn(
                    "flex-shrink-0 size-7 sm:size-8 rounded-full font-bold flex items-center justify-center text-sm sm:text-base transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/20 text-primary"
                  )}
                >
                  {option.label}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-sm sm:text-base pt-0.5",
                    isSelected ? "text-foreground font-medium" : "text-foreground/90"
                  )}
                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
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
  onEnterSubmit,
  disabled,
  isLastQuestion,
}: QuestionInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing && value.trim()) {
      e.preventDefault();
      onEnterSubmit(value);
    }
  };

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
            onChange={(e) => onChange(e.target.value, false)}
            onKeyDown={handleKeyDown}
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
      {!disabled && value.trim() && (
        <p className="text-xs text-muted-foreground">
          Enterキーで{isLastQuestion ? "送信" : "次へ"}
        </p>
      )}
    </div>
  );
}

function TextQuestion({
  question,
  index,
  value,
  onChange,
  onEnterSubmit,
  disabled,
  isLastQuestion,
}: QuestionInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift = submit, Shift+Enter = new line
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && value.trim()) {
      e.preventDefault();
      onEnterSubmit(value);
    }
  };

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
        onChange={(e) => onChange(e.target.value, false)}
        onKeyDown={handleKeyDown}
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
      {!disabled && value.trim() && (
        <p className="text-xs text-muted-foreground">
          Enterキーで{isLastQuestion ? "送信" : "次へ"}（Shift+Enterで改行）
        </p>
      )}
    </div>
  );
}
