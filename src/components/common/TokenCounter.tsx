"use client";

import { cn } from "@/lib/utils";

interface TokenCounterProps {
  used: number;
  limit: number;
  showBar?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function TokenCounter({
  used,
  limit,
  showBar = false,
  size = "md",
  className,
}: TokenCounterProps) {
  const remaining = Math.max(0, limit - used);
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isLow = percentage >= 80;
  const isExhausted = percentage >= 100;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5",
        size === "sm" ? "text-xs" : "text-sm",
        isExhausted
          ? "border-destructive/50 bg-destructive/10"
          : isLow
            ? "border-warning/50 bg-warning/10"
            : "border-border",
        className
      )}
    >
      <span
        className={cn(
          "material-symbols-outlined",
          size === "sm" ? "text-base" : "text-lg",
          isExhausted
            ? "text-destructive"
            : isLow
              ? "text-warning animate-pulse"
              : "text-primary"
        )}
      >
        bolt
      </span>

      <div className="flex items-baseline gap-0.5">
        <span className={cn(
          "font-mono font-semibold tabular-nums",
          size === "sm" ? "text-sm" : "text-base",
          isExhausted
            ? "text-destructive"
            : isLow
              ? "text-warning"
              : "text-foreground"
        )}>
          {remaining.toLocaleString()}
        </span>
        <span className={cn(
          "font-mono text-muted-foreground",
          size === "sm" ? "text-xs" : "text-sm"
        )}>
          /{limit.toLocaleString()}
        </span>
      </div>

      {showBar && (
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              isExhausted
                ? "bg-destructive"
                : isLow
                  ? "bg-warning"
                  : "bg-primary"
            )}
            style={{ width: `${Math.min(100, 100 - percentage)}%` }}
          />
        </div>
      )}
    </div>
  );
}
