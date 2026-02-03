"use client";

import { useState, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import type { Message, InteractiveQuestion, InteractiveQuizForm, ChatMode } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { InteractiveQuiz } from "./InteractiveQuiz";
import { LockedCodeBlock } from "./LockedCodeBlock";
import { useUserSettingsOptional } from "@/contexts/UserSettingsContext";

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
}

// Detect n-choice options from AI response (A) B) C) format)
interface DetectedOptions {
  contentWithoutOptions: string;
  options: { label: string; text: string }[];
}

function detectOptions(content: string): DetectedOptions | null {
  // Skip if the message asks for a reason (free-form input expected)
  const reasonPatterns = [
    /なぜ.{0,20}(思|考|判断|選)/,
    /どうして.{0,20}(思|考|判断|選)/,
    /理由.{0,10}(教|聞|説明)/,
    /そう(思|考|判断).{0,10}(まし|のか|のです)/,
    /その理由/,
    /なぜですか/,
    /どうしてですか/,
  ];

  for (const pattern of reasonPatterns) {
    if (pattern.test(content)) {
      return null;
    }
  }

  // Patterns for n-choice options - try multiple formats
  const optionPatterns = [
    // Standard format: A) text, A. text, A: text, A） text
    /^[\s\-\•\*]*([A-D])[)）.\:：]\s*(.+)$/gm,
    // With parentheses: (A) text
    /^[\s\-\•\*]*\(([A-D])\)\s*(.+)$/gm,
    // Japanese format: Ａ） text (full-width)
    /^[\s\-\•\*]*([Ａ-Ｄ])[)）]\s*(.+)$/gm,
  ];

  for (const optionPattern of optionPatterns) {
    const matches = [...content.matchAll(optionPattern)];

    if (matches.length >= 2 && matches.length <= 4) {
      const options = matches.map(m => ({
        // Normalize full-width to half-width
        label: m[1].replace(/[Ａ-Ｄ]/g, (c) =>
          String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
        ),
        text: m[2].trim(),
      }));

      // Remove options from content
      let contentWithoutOptions = content;
      for (const match of matches) {
        contentWithoutOptions = contentWithoutOptions.replace(match[0], "");
      }

      // Clean up extra newlines
      contentWithoutOptions = contentWithoutOptions.replace(/\n{3,}/g, "\n\n").trim();

      return { contentWithoutOptions, options };
    }
  }

  return null;
}

// Detect interactive quiz with multiple question types (choice + fill + text)
function detectInteractiveQuiz(content: string): InteractiveQuizForm | null {
  const questions: InteractiveQuestion[] = [];
  let questionId = 0;

  // Check for fill-in-the-blank patterns (????, ???, or similar)
  const fillPattern = /([^\n]*?)(\?{3,}|＿{3,}|_{3,})([^\n]*)/g;
  const fillMatches = [...content.matchAll(fillPattern)];

  // Check for n-choice patterns
  const choicePattern = /^[\s\-\•\*]*([A-D])[)）.\:：]\s*(.+)$/gm;
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

export function ChatMessage({
  message,
  isStreaming = false,
  onOptionSelect,
  onFork,
  showForkButton = false,
  onRegenerate,
  showRegenerateButton = false,
  mode,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  // Get user settings to check if quiz is enabled
  const userSettingsContext = useUserSettingsOptional();
  const quizEnabled = userSettingsContext?.settings.quizEnabled ?? true;

  // In generation mode, lock code blocks until user completes quiz
  const shouldLockCode = mode === "generation" && isAssistant && !isStreaming;

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
        "group relative flex w-full gap-4 px-4 py-6",
        isUser ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className="flex-shrink-0">
        <div
          className={cn(
            "size-8 rounded-full flex items-center justify-center text-sm font-medium",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
          )}
        >
          {isUser ? (
            <span className="material-symbols-outlined text-lg">person</span>
          ) : (
            <span className="material-symbols-outlined text-lg">smart_toy</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {isUser ? "あなた" : "Eurekode"}
          </span>
          {isStreaming && (
            <span className="text-xs text-muted-foreground animate-pulse">
              入力中...
            </span>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <CodeBlockContext.Provider value={{ mode, shouldLockCode }}>
            <MessageContent content={displayContent} isUser={isUser} />
          </CodeBlockContext.Provider>
        </div>

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

      {/* Action Buttons - shown on hover */}
      {(showForkButton || showRegenerateButton) && (
        <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
          {showRegenerateButton && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-card border border-border hover:bg-muted/80 hover:border-primary/50 transition-all shadow-sm"
              title="この回答を再生成"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              <span>再生成</span>
            </button>
          )}
          {showForkButton && onFork && (
            <button
              onClick={onFork}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-card border border-border hover:bg-muted/80 hover:border-primary/50 transition-all shadow-sm"
              title="この時点から会話を分岐"
            >
              <span className="material-symbols-outlined text-base">fork_right</span>
              <span>分岐</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Option buttons component
function OptionButtons({
  options,
  onSelect,
}: {
  options: { label: string; text: string }[];
  onSelect?: (option: string) => void;
}) {
  const isDisabled = !onSelect;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          "material-symbols-outlined text-lg",
          isDisabled ? "text-muted-foreground" : "text-primary"
        )}>
          {isDisabled ? "check_circle" : "touch_app"}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {isDisabled ? "回答済み" : "選択肢をクリックして回答"}
        </span>
      </div>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option.label}
            onClick={() => onSelect?.(`${option.label}) ${option.text}`)}
            disabled={isDisabled}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all",
              isDisabled
                ? "border-border/50 bg-muted/30 cursor-not-allowed opacity-60"
                : "border-border bg-card hover:bg-primary/10 hover:border-primary/50 group"
            )}
          >
            <span className="inline-flex items-center gap-3">
              <span className={cn(
                "flex-shrink-0 size-7 rounded-full font-bold flex items-center justify-center text-sm transition-colors",
                isDisabled
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
              )}>
                {option.label}
              </span>
              <span className={isDisabled ? "text-muted-foreground" : "text-foreground/90"}>
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
  const isInline = !className;
  const codeString = String(children).replace(/\n$/, "");

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

  return (
    <SyntaxHighlighter
      style={oneDark}
      language={language}
      PreTag="div"
      customStyle={{
        margin: 0,
        padding: "1rem",
        borderRadius: "0.5rem",
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
  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
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

// Detect if a block of text looks like code
function looksLikeCode(text: string): boolean {
  const codePatterns = [
    /^(import|export|from|const|let|var|function|class|interface|type|async|await|return|if|else|for|while|switch|case|try|catch|throw)\s/m,
    /^(def|class|import|from|return|if|elif|else|for|while|try|except|raise|with|async|await)\s/m,
    /^(package|import|public|private|protected|class|interface|void|int|string|boolean|return|if|else|for|while|switch|case|try|catch|throw)\s/m,
    /[{}\[\]();].*[{}\[\]();]/,
    /^\s*(\/\/|#|\/\*|\*|<!--)/m,
    /=>\s*[{(]/,
    /\(\s*\)\s*=>/,
    /\.\w+\(/,
    /<\w+(\s+\w+="[^"]*")*\s*\/?>/,
  ];

  const lines = text.trim().split("\n");
  if (lines.length < 2) return false;

  let codeScore = 0;
  for (const pattern of codePatterns) {
    if (pattern.test(text)) codeScore++;
  }

  const hasMultipleLines = lines.length >= 2;
  const hasIndentation = lines.some((line) => /^\s{2,}/.test(line));
  const hasCodeChars = (text.match(/[{}\[\]();=><]/g) || []).length > 3;

  return codeScore >= 2 || (hasMultipleLines && hasIndentation && hasCodeChars);
}

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

    // Check if this line looks like code
    const isCodeLine =
      /^(import|export|from|const|let|var|function|class|interface|type|async|await|return|if|else|for|while|switch|case|try|catch|throw|def|elif|except|raise|with|package|public|private|protected|void|int|boolean)\s/.test(trimmedLine) ||
      /^(\/\/|#|\/\*|\*\s)/.test(trimmedLine) ||
      /^\s*[{}[\]();]/.test(line) ||
      /[{}\[\]();]\s*$/.test(trimmedLine) ||
      /^\s{2,}\S/.test(line) && codeBuffer.length > 0 || // Indented line following code
      /=>\s*[{(]/.test(trimmedLine) ||
      /\)\s*{/.test(trimmedLine) ||
      /<\w+[^>]*>/.test(trimmedLine) && /<\/\w+>/.test(trimmedLine);

    if (isCodeLine) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeStartIndex = i;
      }
      codeBuffer.push(line);
    } else {
      if (inCodeBlock && codeBuffer.length >= 2) {
        // We have a code block, flush it
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
  if (codeBuffer.length >= 2) {
    flushCodeBuffer();
  } else {
    result.push(...codeBuffer);
  }

  return result.join("\n");
}

// Preprocess content to wrap unformatted code in code blocks
function preprocessContent(content: string): string {
  // If content already has code blocks, return as-is
  if (/```[\s\S]*```/.test(content)) {
    return content;
  }

  // Check if the entire content looks like code
  if (looksLikeCode(content)) {
    const language = detectLanguage(content);
    return "```" + language + "\n" + content + "\n```";
  }

  // Try to find code blocks within mixed content
  return findCodeBlocksInText(content);
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
