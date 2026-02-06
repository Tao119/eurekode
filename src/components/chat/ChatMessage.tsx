"use client";

import { useState, createContext, useContext, useCallback, useEffect, useRef, memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Message, InteractiveQuestion, InteractiveQuizForm, ChatMode, FileAttachment } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { InteractiveQuiz } from "./InteractiveQuiz";
import { LockedCodeBlock } from "./LockedCodeBlock";
import { SaveLearningDialog } from "./SaveLearningDialog";
import { useUserSettingsOptional } from "@/contexts/UserSettingsContext";
import { extractQuizOptions, extractMultipleQuizzes } from "@/lib/quizExtractor";

// Context to pass mode and lock state to nested components
interface CodeBlockContextValue {
  mode?: ChatMode;
  shouldLockCode: boolean;
}
const CodeBlockContext = createContext<CodeBlockContextValue>({ shouldLockCode: false });

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onOptionSelect?: (option: string) => void;
  onFork?: () => void;
  showForkButton?: boolean;
  onRegenerate?: () => void;
  showRegenerateButton?: boolean;
  mode?: ChatMode;
  conversationId?: string;
}

// Detect n-choice options from AI response using shared utility
interface DetectedOptions {
  contentWithoutOptions: string;
  options: { label: string; text: string }[];
}

function detectOptions(content: string): DetectedOptions | null {
  const result = extractQuizOptions(content);
  if (!result) return null;

  return {
    contentWithoutOptions: result.contentWithoutOptions,
    options: result.options,
  };
}

// Detect interactive quiz with multiple question types (choice + fill + text)
// Also handles multiple independent choice questions in a single message
function detectInteractiveQuiz(content: string): InteractiveQuizForm | null {
  const questions: InteractiveQuestion[] = [];
  let questionId = 0;

  // First, try to detect multiple independent quizzes (e.g., 質問1, 質問2, etc.)
  // Also handles single quiz when content has multiple A-D sets (to avoid duplicate label issues)
  const multipleQuizzes = extractMultipleQuizzes(content);
  if (multipleQuizzes && multipleQuizzes.quizzes.length >= 1) {
    // Convert quizzes to InteractiveQuestion format
    for (const quiz of multipleQuizzes.quizzes) {
      questions.push({
        id: `choice-${questionId++}`,
        type: "choice",
        options: quiz.options,
        questionText: quiz.question,
      });
    }

    // Return if we have at least one quiz with proper options
    if (questions.length >= 1) {
      return {
        questions,
        contentWithoutQuestions: multipleQuizzes.contentWithoutQuizzes,
      };
    }
  }

  // Check for fill-in-the-blank patterns (????, ???, or similar)
  const fillPattern = /([^\n]*?)(\?{3,}|＿{3,}|_{3,})([^\n]*)/g;
  const fillMatches = [...content.matchAll(fillPattern)];

  // Check for n-choice patterns
  const choicePattern = /^[\s\-\•\*]*([A-DＡ-Ｄ])[)）.\:：]\s*(.+)$/gm;
  const choiceMatches = [...content.matchAll(choicePattern)];

  // Check for text questions (questions ending with ？ that expect free-form answer)
  // These are usually after "処理は？" or similar patterns
  const textQuestionPatterns = [
    /(.+?の処理は)[？?]/g,
    /(.+?は何)[？?]/g,
    /(.+?どう思いますか)[？?]/g,
  ];

  // Only create interactive quiz if we have multiple question types OR multiple fill-in questions
  const hasFillQuestions = fillMatches.length > 0;
  const hasChoiceQuestions = choiceMatches.length >= 2;

  // If we only have simple n-choice without fill-in, use the simpler detectOptions
  if (!hasFillQuestions && hasChoiceQuestions) {
    return null; // Let detectOptions handle simple n-choice
  }

  // If we have fill-in questions, create interactive quiz
  if (hasFillQuestions) {
    // Add fill-in questions
    for (const match of fillMatches) {
      questions.push({
        id: `fill-${questionId++}`,
        type: "fill",
        contextBefore: match[1].trim(),
        placeholder: match[2],
        contextAfter: match[3].trim(),
      });
    }
  }

  // Add choice questions if present (as a single grouped question)
  if (hasChoiceQuestions) {
    const options = choiceMatches.map((m) => ({
      label: m[1].replace(/[Ａ-Ｄ]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
      ),
      text: m[2].trim(),
    }));

    questions.push({
      id: `choice-${questionId++}`,
      type: "choice",
      options,
    });
  }

  // Check for text questions like "どう思いますか？"
  for (const pattern of textQuestionPatterns) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      // Avoid duplicates
      const questionText = match[0];
      if (!questions.some((q) => q.questionText === questionText)) {
        questions.push({
          id: `text-${questionId++}`,
          type: "text",
          questionText,
        });
      }
    }
  }

  // Only return if we have at least 2 questions or mixed types
  if (questions.length < 2) {
    return null;
  }

  // Remove the detected elements from content
  let contentWithoutQuestions = content;

  // Remove fill-in patterns
  for (const match of fillMatches) {
    contentWithoutQuestions = contentWithoutQuestions.replace(match[0], "");
  }

  // Remove choice patterns
  for (const match of choiceMatches) {
    contentWithoutQuestions = contentWithoutQuestions.replace(match[0], "");
  }

  // Clean up
  contentWithoutQuestions = contentWithoutQuestions
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    questions,
    contentWithoutQuestions,
  };
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming = false,
  onOptionSelect,
  onFork,
  showForkButton = false,
  onRegenerate,
  showRegenerateButton = false,
  mode,
  conversationId,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  // Save learning dialog state
  const [saveLearningOpen, setSaveLearningOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState("");

  // Text selection state for partial content saving
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Handle save learning button click (save entire message)
  const handleSaveLearning = useCallback(() => {
    setSelectedContent(message.content);
    setSaveLearningOpen(true);
  }, [message.content]);

  // Handle save selected text
  const handleSaveSelection = useCallback(() => {
    if (selectionPopup?.text) {
      setSelectedContent(selectionPopup.text);
      setSaveLearningOpen(true);
      setSelectionPopup(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [selectionPopup]);

  // Handle text selection within the message
  useEffect(() => {
    if (!isAssistant || isStreaming) return;

    const handleMouseUp = (e: MouseEvent) => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (selectedText && selectedText.length > 0 && messageRef.current) {
        // Check if selection is within this message
        const range = selection?.getRangeAt(0);
        if (range && messageRef.current.contains(range.commonAncestorContainer)) {
          const rect = range.getBoundingClientRect();
          const containerRect = messageRef.current.getBoundingClientRect();

          setSelectionPopup({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top - 8,
            text: selectedText,
          });
        }
      } else {
        // Small delay to allow clicking the popup button
        setTimeout(() => {
          if (!selectionPopup) return;
          const selection = window.getSelection();
          if (!selection || selection.toString().trim().length === 0) {
            setSelectionPopup(null);
          }
        }, 100);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectionPopup(null);
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAssistant, isStreaming, selectionPopup]);

  // Get user settings to check if quiz is enabled
  const userSettingsContext = useUserSettingsOptional();
  const quizEnabled = userSettingsContext?.settings.quizEnabled ?? true;

  // In generation mode, artifacts are handled by the right panel (BlurredCode)
  // Regular code blocks should NOT be locked - only show normally
  const shouldLockCode = false; // Disabled: artifacts use the right panel now

  // Only detect quizzes if enabled in user settings (for explanation mode)
  const shouldShowQuiz = quizEnabled && mode !== "generation"; // Generation mode has its own quiz system

  // First try to detect interactive quiz (multiple question types)
  const interactiveQuiz = isAssistant && !isStreaming && shouldShowQuiz
    ? detectInteractiveQuiz(message.content)
    : null;

  // Fall back to simple n-choice detection if no interactive quiz
  const detectedOptions = isAssistant && !isStreaming && shouldShowQuiz && !interactiveQuiz
    ? detectOptions(message.content)
    : null;

  // Determine display content
  const displayContent = interactiveQuiz
    ? interactiveQuiz.contentWithoutQuestions
    : detectedOptions
      ? detectedOptions.contentWithoutOptions
      : message.content;

  return (
    <div
      className={cn(
        "relative flex w-full gap-2.5 sm:gap-4 px-3 sm:px-4 py-4 sm:py-6",
        isUser ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className="flex-shrink-0">
        <div
          className={cn(
            "size-7 sm:size-8 rounded-full flex items-center justify-center text-sm font-medium",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
          )}
        >
          {isUser ? (
            <span className="material-symbols-outlined text-base sm:text-lg">person</span>
          ) : (
            <span className="material-symbols-outlined text-base sm:text-lg">smart_toy</span>
          )}
        </div>
      </div>

      <div ref={messageRef} className="flex-1 min-w-0 space-y-2 relative">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs sm:text-sm">
            {isUser ? "あなた" : "Eurecode"}
          </span>
          {isStreaming && (
            <span className="text-[10px] sm:text-xs text-muted-foreground animate-pulse">
              入力中...
            </span>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <CodeBlockContext.Provider value={{ mode, shouldLockCode }}>
            <MessageContent content={displayContent} isUser={isUser} />
          </CodeBlockContext.Provider>
        </div>

        {/* File Attachments Display */}
        {message.attachments && message.attachments.length > 0 && (
          <FileAttachmentDisplay attachments={message.attachments} />
        )}

        {/* Selection Popup for saving selected text */}
        {selectionPopup && (
          <div
            className="absolute z-10 animate-in fade-in-50 zoom-in-95 duration-150"
            style={{
              left: selectionPopup.x,
              top: selectionPopup.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <button
              onClick={handleSaveSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">bookmark_add</span>
              <span>選択を保存</span>
            </button>
          </div>
        )}

        {/* Interactive Quiz (multiple question types) */}
        {interactiveQuiz && interactiveQuiz.questions.length > 0 && (
          <InteractiveQuiz
            quiz={interactiveQuiz}
            onSubmit={onOptionSelect || (() => {})}
            disabled={!onOptionSelect}
          />
        )}

        {/* Simple n-choice option buttons */}
        {!interactiveQuiz && detectedOptions && detectedOptions.options.length > 0 && (
          <OptionButtons
            options={detectedOptions.options}
            onSelect={onOptionSelect}
          />
        )}

        {message.metadata?.quiz && (
          <QuizBlock quiz={message.metadata.quiz} />
        )}

        {message.metadata?.codeBlock && (
          <CodeBlock code={message.metadata.codeBlock} />
        )}
      </div>

      {/* Action Buttons - Mobile: icon only, Desktop: with labels */}
      {isAssistant && !isStreaming && (
        <div className="absolute right-2 sm:right-4 top-2 sm:top-4 flex items-center gap-1 sm:gap-2">
          {/* Save as Learning button */}
          <button
            onClick={handleSaveLearning}
            className="flex items-center gap-1.5 p-2.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium bg-card/80 border border-border/50 text-muted-foreground hover:bg-muted/80 hover:border-amber-500/50 hover:text-amber-500 active:scale-95 transition-all shadow-sm cursor-pointer"
            title="学びとして保存"
            aria-label="学びとして保存"
          >
            <span className="material-symbols-outlined text-lg sm:text-base" aria-hidden="true">bookmark_add</span>
            <span className="hidden sm:inline">保存</span>
          </button>
          {showRegenerateButton && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 p-2.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium bg-card/80 border border-border/50 text-muted-foreground hover:bg-muted/80 hover:border-primary/50 hover:text-foreground active:scale-95 transition-all shadow-sm cursor-pointer"
              title="この回答を再生成"
              aria-label="この回答を再生成"
            >
              <span className="material-symbols-outlined text-lg sm:text-base" aria-hidden="true">refresh</span>
              <span className="hidden sm:inline">再生成</span>
            </button>
          )}
          {showForkButton && onFork && (
            <button
              onClick={onFork}
              className="flex items-center gap-1.5 p-2.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium bg-card/80 border border-border/50 text-muted-foreground hover:bg-muted/80 hover:border-primary/50 hover:text-foreground active:scale-95 transition-all shadow-sm cursor-pointer"
              title="この時点から会話を分岐"
              aria-label="この時点から会話を分岐"
            >
              <span className="material-symbols-outlined text-lg sm:text-base" aria-hidden="true">fork_right</span>
              <span className="hidden sm:inline">分岐</span>
            </button>
          )}
        </div>
      )}

      {/* Save Learning Dialog */}
      <SaveLearningDialog
        open={saveLearningOpen}
        onOpenChange={setSaveLearningOpen}
        content={selectedContent}
        sourceMessage={message.content}
        conversationId={conversationId}
        onSaveSuccess={userSettingsContext?.refetch}
      />
    </div>
  );
});

// Display name for debugging
ChatMessage.displayName = "ChatMessage";

// Option buttons component with accessibility
function OptionButtons({
  options,
  onSelect,
}: {
  options: { label: string; text: string }[];
  onSelect?: (option: string) => void;
}) {
  const isDisabled = !onSelect;
  const groupId = `quiz-options-${Math.random().toString(36).slice(2, 9)}`;

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    option: { label: string; text: string },
    index: number
  ) => {
    if (isDisabled) return;

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect?.(`${option.label}) ${option.text}`);
        break;
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        {
          const nextIndex = (index + 1) % options.length;
          const nextButton = document.querySelector(
            `[data-option-index="${groupId}-${nextIndex}"]`
          ) as HTMLButtonElement;
          nextButton?.focus();
        }
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        {
          const prevIndex = (index - 1 + options.length) % options.length;
          const prevButton = document.querySelector(
            `[data-option-index="${groupId}-${prevIndex}"]`
          ) as HTMLButtonElement;
          prevButton?.focus();
        }
        break;
    }
  };

  return (
    <div
      className="mt-3 sm:mt-4 space-y-2"
      role="group"
      aria-label="クイズの選択肢"
    >
      <div className="flex items-center gap-2 mb-2" aria-hidden="true">
        <span className={cn(
          "material-symbols-outlined text-base sm:text-lg",
          isDisabled ? "text-muted-foreground" : "text-primary"
        )}>
          {isDisabled ? "check_circle" : "touch_app"}
        </span>
        <span className="text-xs sm:text-sm font-medium text-muted-foreground">
          {isDisabled ? "回答済み" : "タップして回答"}
        </span>
      </div>
      <div className="grid gap-1.5 sm:gap-2" role="radiogroup" aria-label="選択肢">
        {options.map((option, index) => (
          <button
            key={option.label}
            data-option-index={`${groupId}-${index}`}
            onClick={() => onSelect?.(`${option.label}) ${option.text}`)}
            onKeyDown={(e) => handleKeyDown(e, option, index)}
            disabled={isDisabled}
            role="radio"
            aria-checked={false}
            aria-label={`選択肢 ${option.label}: ${option.text}`}
            tabIndex={isDisabled ? -1 : 0}
            className={cn(
              "w-full text-left p-2.5 sm:p-3 rounded-lg border transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isDisabled
                ? "border-border/50 bg-muted/30 cursor-not-allowed opacity-60"
                : "border-border bg-card hover:bg-primary/10 hover:border-primary/50 active:scale-[0.98] group/option cursor-pointer"
            )}
          >
            <span className="flex items-start gap-2 sm:gap-3">
              <span className={cn(
                "flex-shrink-0 size-6 sm:size-7 rounded-full font-bold flex items-center justify-center text-xs sm:text-sm transition-colors mt-0.5",
                isDisabled
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/20 text-primary group-hover/option:bg-primary group-hover/option:text-primary-foreground"
              )}>
                {option.label}
              </span>
              <span className={cn(
                "text-xs sm:text-sm min-w-0 break-words",
                isDisabled ? "text-muted-foreground" : "text-foreground/90"
              )}>
                {option.text}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Code component that uses context to determine if it should be locked
function CodeComponent({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { shouldLockCode } = useContext(CodeBlockContext);
  const [copied, setCopied] = useState(false);
  const isInline = !className;
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = codeString;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [codeString]);

  if (isInline) {
    return (
      <code className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-emerald-400 font-mono text-sm border border-zinc-700">
        {children}
      </code>
    );
  }

  const language = className?.replace("language-", "") || "text";

  // In generation mode, show locked code block
  if (shouldLockCode) {
    return (
      <LockedCodeBlock
        code={codeString}
        language={language}
      />
    );
  }

  // Get display name for language
  const languageDisplayNames: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    bash: "Bash",
    shell: "Shell",
    sql: "SQL",
    tsx: "TSX",
    jsx: "JSX",
    text: "Text",
  };
  const displayLanguage = languageDisplayNames[language.toLowerCase()] || language;

  return (
    <div className="relative group">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700 rounded-t-lg">
        <span className="text-xs text-zinc-400 font-mono">{displayLanguage}</span>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs transition-all",
            copied
              ? "text-green-400 bg-green-500/10"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
          )}
        >
          <span className="material-symbols-outlined text-sm">
            {copied ? "check" : "content_copy"}
          </span>
          <span>{copied ? "コピーしました" : "コピー"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          borderRadius: "0 0 0.5rem 0.5rem",
          fontSize: "0.875rem",
          lineHeight: "1.5",
        }}
        codeTagProps={{
          style: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          },
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

// Pre component that wraps code blocks (skipped for locked code)
function PreComponent({ children }: { children?: React.ReactNode }) {
  const { shouldLockCode } = useContext(CodeBlockContext);

  // If code should be locked, LockedCodeBlock handles its own wrapper
  if (shouldLockCode) {
    return <>{children}</>;
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-zinc-700">
      {children}
    </div>
  );
}

const markdownComponents: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold mt-5 mb-3 text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h4>
  ),
  // Paragraphs
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>
  ),
  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-3 space-y-1 text-foreground/90">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-3 space-y-1 text-foreground/90">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  // Inline styles
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  // Code - uses context-aware component
  code: CodeComponent,
  pre: PreComponent,
  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 my-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  // Links (internal citation links use Next.js Link for SPA navigation)
  a: ({ href, children }) => {
    if (href?.startsWith("/chat/")) {
      return (
        <Link
          href={href as string}
          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className="text-primary hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  // Horizontal rule
  hr: () => <hr className="my-4 border-border" />,
  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border border-border rounded-lg">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left font-semibold border-b border-border">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 border-b border-border">{children}</td>
  ),
};

// Detect inline code patterns (single expressions, short statements)
function detectInlineCode(text: string): string {
  // Patterns for inline code that should be wrapped in backticks
  const inlineCodePatterns = [
    // Function calls: functionName() or obj.method()
    /(?<![`\w])(\w+(?:\.\w+)*\([^)]*\))(?![`\w])/g,
    // Variable declarations: const/let/var name = value
    /(?<![`])(\b(?:const|let|var)\s+\w+\s*=\s*[^,;\n]+)(?![`])/g,
    // Arrow functions: () => or (x) =>
    /(?<![`])(\([^)]*\)\s*=>)(?![`])/g,
    // Object/array literals with content: {key: value} or [item, item]
    /(?<![`])(\{[^{}]+\}|\[[^\[\]]+\])(?![`])/g,
    // Import/export statements
    /(?<![`])((?:import|export)\s+[^;\n]+)(?![`])/g,
    // HTML/JSX tags: <Component /> or <div>
    /(?<![`])(<\w+(?:\s+\w+(?:=(?:"[^"]*"|'[^']*'|\{[^}]*\}))?)*\s*\/?>)(?![`])/g,
    // Type annotations: : Type or : Type[]
    /(?<![`])(\w+:\s*\w+(?:\[\]|\<\w+\>)?)(?![`])/g,
  ];

  let result = text;

  for (const pattern of inlineCodePatterns) {
    result = result.replace(pattern, (match, code) => {
      // Don't wrap if already wrapped or if it's just a simple word
      if (match.startsWith('`') || match.endsWith('`')) return match;
      // Skip if it looks like natural language
      if (/^[a-z]+$/i.test(code.trim())) return match;
      return `\`${code}\``;
    });
  }

  return result;
}

// Detect language from code content
function detectLanguage(code: string): string {
  if (/^(import|export|const|let|var|function|class|interface|type|async|await|=>)/.test(code)) {
    return "typescript";
  } else if (/^(def|class|import|from|print|if __name__)/.test(code)) {
    return "python";
  } else if (/^(package|import|public|private|class|void|int|String)/.test(code)) {
    return "java";
  } else if (/<\w+/.test(code) && /<\/\w+>/.test(code)) {
    return "html";
  }
  return "text";
}

// Find and wrap code blocks within mixed content
function findCodeBlocksInText(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let codeBuffer: string[] = [];
  let inCodeBlock = false;
  let codeStartIndex = -1;

  const flushCodeBuffer = () => {
    if (codeBuffer.length > 0) {
      const code = codeBuffer.join("\n");
      const language = detectLanguage(code);
      result.push("```" + language);
      result.push(code);
      result.push("```");
      codeBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if this line looks like code (conservative detection)
    // Exclude lines containing Japanese/CJK characters - those are explanatory text
    const containsCJK = /[\u3000-\u9fff\uf900-\ufaff]/.test(trimmedLine);
    const isCodeLine = !containsCJK && (
      /^(import|export|from|const|let|var|function|class|interface|type|async|await|return)\s/.test(trimmedLine) ||
      /^(def|class|import|from|return)\s/.test(trimmedLine) ||
      /^(package|import|public|private|protected|class|void)\s/.test(trimmedLine) ||
      /^(\/\/|\/\*|\*\s)/.test(trimmedLine) ||
      /^\s*[{}[\]()]$/.test(trimmedLine) ||
      (/^\s{2,}\S/.test(line) && codeBuffer.length > 0) || // Indented line following code
      /=>\s*[{(]/.test(trimmedLine) ||
      /\)\s*\{$/.test(trimmedLine)
    );

    if (isCodeLine) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeStartIndex = i;
      }
      codeBuffer.push(line);
    } else {
      if (inCodeBlock && codeBuffer.length >= 3) {
        // We have a code block (3+ consecutive code lines), flush it
        flushCodeBuffer();
      } else if (codeBuffer.length > 0) {
        // Not enough lines to be a code block, treat as regular text
        result.push(...codeBuffer);
        codeBuffer = [];
      }
      inCodeBlock = false;
      // Apply inline code detection to non-code lines
      result.push(detectInlineCode(line));
    }
  }

  // Flush remaining code buffer
  if (codeBuffer.length >= 3) {
    flushCodeBuffer();
  } else {
    result.push(...codeBuffer);
  }

  return result.join("\n");
}

// Convert [[ref:conversationId:mode|displayText]] citations to markdown links
function preprocessCitations(content: string): string {
  return content.replace(
    /\[\[ref:([a-f0-9-]+):(\w+)\|([^\]]+)\]\]/g,
    (_, convId, mode, title) => `[📎 ${title}](/chat/${mode}/${convId})`
  );
}

// Preprocess content to wrap unformatted code in code blocks
function preprocessContent(content: string): string {
  // Convert RAG citations to markdown links
  let processed = preprocessCitations(content);

  // If content already has code blocks, return as-is
  if (/```[\s\S]*```/.test(processed)) {
    return processed;
  }

  // Find code blocks within mixed content (line-by-line detection only).
  // We do NOT wrap the entire content as a code block - the AI formats
  // code with ``` markers. Full-content wrapping caused false positives
  // when explanatory text contained code-related keywords.
  return findCodeBlocksInText(processed);
}

function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  // ユーザーメッセージは改行を保持してシンプルに表示
  if (isUser) {
    return (
      <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
        {content}
      </div>
    );
  }

  const processedContent = preprocessContent(content);

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

function QuizBlock({ quiz }: { quiz: NonNullable<Message["metadata"]>["quiz"] }) {
  if (!quiz) return null;

  return (
    <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-blue-400">quiz</span>
        <span className="font-semibold text-blue-400">確認クイズ</span>
      </div>
      <p className="font-medium mb-3">{quiz.question}</p>
      <div className="space-y-2">
        {quiz.options.map((option) => (
          <button
            key={option.id}
            className={cn(
              "w-full text-left p-3 rounded-md border transition-all",
              quiz.userAnswer === option.id
                ? option.id === quiz.correctAnswer
                  ? "bg-green-500/20 border-green-500/50 text-green-400"
                  : "bg-red-500/20 border-red-500/50 text-red-400"
                : "bg-card border-border hover:border-primary/50"
            )}
          >
            {option.text}
          </button>
        ))}
      </div>
      {quiz.explanation && quiz.userAnswer !== undefined && (
        <p className="mt-3 text-sm text-muted-foreground">{quiz.explanation}</p>
      )}
    </div>
  );
}

function CodeBlock({
  code,
}: {
  code: NonNullable<Message["metadata"]>["codeBlock"];
}) {
  if (!code) return null;

  return (
    <div className="mt-4 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">code</span>
          <span className="text-sm font-mono">
            {code.filename || code.language}
          </span>
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => navigator.clipboard.writeText(code.code)}
        >
          <span className="material-symbols-outlined text-sm">content_copy</span>
        </button>
      </div>
      <pre className="bg-[#1e1e1e] p-4 overflow-x-auto">
        <code className="text-sm font-mono text-gray-200">{code.code}</code>
      </pre>
    </div>
  );
}

// File Attachment Display Component
function FileAttachmentDisplay({ attachments }: { attachments: FileAttachment[] }) {
  const isImageType = (type: string) => type.startsWith("image/");
  const isPdfType = (type: string) => type === "application/pdf";
  const isTextType = (type: string) =>
    type.startsWith("text/") || type === "application/json" || type === "application/xml";

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (isImageType(type)) return "image";
    if (isPdfType(type)) return "picture_as_pdf";
    if (isTextType(type)) return "description";
    return "attach_file";
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30 max-w-xs"
        >
          {isImageType(attachment.type) && attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="w-16 h-16 object-cover rounded"
            />
          ) : (
            <div className="w-10 h-10 flex items-center justify-center rounded bg-muted">
              <span className={cn(
                "material-symbols-outlined text-xl",
                isPdfType(attachment.type) ? "text-red-400" : "text-blue-400"
              )}>
                {getFileIcon(attachment.type)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" title={attachment.name}>
              {attachment.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(attachment.size)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
