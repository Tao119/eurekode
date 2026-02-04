"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/useCredits";

interface CreditCounterProps {
  size?: "sm" | "md";
  className?: string;
  showLink?: boolean;
}

export function CreditCounter({
  size = "md",
  className,
  showLink = true,
}: CreditCounterProps) {
  const credits = useCredits();

  if (credits.isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 animate-pulse",
          size === "sm" ? "text-xs" : "text-sm",
          className
        )}
      >
        <span className="material-symbols-outlined text-muted-foreground text-base">
          toll
        </span>
        <span className="text-muted-foreground">...</span>
      </div>
    );
  }

  const remaining = credits.totalRemaining;
  // メンバーの場合は割り当て、そうでなければプラン+購入
  const total = credits.allocated
    ? credits.allocated.total
    : credits.monthly.total + credits.purchased.balance;
  const percentage = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const isLow = credits.lowBalanceWarning;
  const isExhausted = credits.isBlocked;
  const isMember = credits.isOrganizationMember;

  const content = (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 transition-colors",
        size === "sm" ? "text-xs" : "text-sm",
        isExhausted
          ? "border-destructive/50 bg-destructive/10"
          : isLow
            ? "border-yellow-500/50 bg-yellow-500/10"
            : "border-border hover:bg-muted/50",
        showLink && "cursor-pointer",
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
              ? "text-yellow-500 animate-pulse"
              : "text-primary"
        )}
      >
        toll
      </span>

      <div className="flex items-baseline gap-0.5">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            size === "sm" ? "text-sm" : "text-base",
            isExhausted
              ? "text-destructive"
              : isLow
                ? "text-yellow-500"
                : "text-foreground"
          )}
        >
          {Math.floor(remaining)}
        </span>
        <span
          className={cn(
            "font-mono text-muted-foreground",
            size === "sm" ? "text-xs" : "text-sm"
          )}
        >
          pt
        </span>
      </div>

      {isLow && !isExhausted && (
        <span className="text-xs text-yellow-600 dark:text-yellow-400 hidden sm:inline">
          残りわずか
        </span>
      )}

      {isExhausted && (
        <span className="text-xs text-destructive hidden sm:inline">
          ポイント不足
        </span>
      )}
    </div>
  );

  // メンバーはbillingページにアクセスできないのでリンクしない
  if (showLink && !isMember) {
    return <Link href="/settings/billing">{content}</Link>;
  }

  return content;
}
