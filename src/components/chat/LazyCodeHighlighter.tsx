"use client";

import { Suspense, lazy, useState, useEffect, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load the syntax highlighter
const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter").then((mod) => ({
    default: mod.Prism,
  }))
);

// Lazy load the theme
const loadTheme = () =>
  import("react-syntax-highlighter/dist/cjs/styles/prism").then(
    (mod) => mod.oneDark
  );

// Cache the theme once loaded
let cachedTheme: Record<string, React.CSSProperties> | null = null;
const getTheme = async () => {
  if (!cachedTheme) {
    cachedTheme = await loadTheme();
  }
  return cachedTheme;
};

interface LazyCodeHighlighterProps {
  children: string;
  language?: string;
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  wrapLongLines?: boolean;
  customStyle?: React.CSSProperties;
  codeTagProps?: ComponentProps<"code">;
  lineProps?: ComponentProps<"span"> | ((lineNumber: number) => ComponentProps<"span">);
  className?: string;
}

function CodeSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="rounded-lg bg-zinc-900 p-4 space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 bg-zinc-700"
          style={{ width: `${Math.random() * 40 + 40}%` }}
        />
      ))}
    </div>
  );
}

// Inner component that actually loads the highlighter
function LazyCodeHighlighterInner({
  children,
  language,
  showLineNumbers,
  wrapLines,
  wrapLongLines,
  customStyle,
  codeTagProps,
  lineProps,
  className,
}: LazyCodeHighlighterProps) {
  const [theme, setTheme] = useState<Record<string, React.CSSProperties> | null>(null);

  useEffect(() => {
    getTheme().then(setTheme);
  }, []);

  if (!theme) {
    return <CodeSkeleton lines={Math.min(children.split("\n").length, 10)} />;
  }

  return (
    <SyntaxHighlighter
      language={language}
      style={theme}
      showLineNumbers={showLineNumbers}
      wrapLines={wrapLines}
      wrapLongLines={wrapLongLines}
      customStyle={{
        margin: 0,
        borderRadius: "0.5rem",
        fontSize: "0.875rem",
        ...customStyle,
      }}
      codeTagProps={codeTagProps}
      lineProps={lineProps}
      className={className}
    >
      {children}
    </SyntaxHighlighter>
  );
}

export function LazyCodeHighlighter({
  children,
  language = "text",
  showLineNumbers = false,
  wrapLines = true,
  wrapLongLines = true,
  customStyle,
  codeTagProps,
  lineProps,
  className,
}: LazyCodeHighlighterProps) {
  // Estimate line count for skeleton
  const lineCount = Math.min(children.split("\n").length, 10);

  return (
    <Suspense fallback={<CodeSkeleton lines={lineCount} />}>
      <LazyCodeHighlighterInner
        language={language}
        showLineNumbers={showLineNumbers}
        wrapLines={wrapLines}
        wrapLongLines={wrapLongLines}
        customStyle={customStyle}
        codeTagProps={codeTagProps}
        lineProps={lineProps}
        className={className}
      >
        {children}
      </LazyCodeHighlighterInner>
    </Suspense>
  );
}

// Re-export for convenience
export { CodeSkeleton };
