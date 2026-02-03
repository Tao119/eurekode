"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { MODE_CONFIG, MODE_ICON_SIZES } from "@/config/modes";
import type { ChatMode } from "@/types/chat";

interface ModeCardProps {
  mode: ChatMode;
  disabled?: boolean;
  className?: string;
}

export function ModeCard({ mode, disabled = false, className }: ModeCardProps) {
  const config = MODE_CONFIG[mode];
  const iconSize = MODE_ICON_SIZES.card;

  const content = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-6 transition-all duration-300",
        disabled
          ? "border-border bg-muted/50 cursor-not-allowed opacity-60"
          : "border-border bg-card hover:border-primary/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 cursor-pointer",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <span className="material-symbols-outlined text-8xl text-foreground">
          {config.icon}
        </span>
      </div>

      {/* Gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity pointer-events-none",
          !disabled && "group-hover:opacity-100",
          mode === "explanation" && "from-blue-500/5 to-transparent",
          mode === "generation" && "from-yellow-500/5 to-transparent",
          mode === "brainstorm" && "from-purple-500/5 to-transparent"
        )}
      />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <div
            className={cn(
              "rounded-lg flex items-center justify-center mb-4 transition-transform",
              iconSize.container,
              !disabled && "group-hover:scale-110",
              config.bgColor,
              config.color
            )}
          >
            <span className={cn("material-symbols-outlined", iconSize.icon)}>
              {config.icon}
            </span>
          </div>

          <h4 className="text-xl font-bold text-foreground mb-2">
            {config.title}
          </h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {config.description}
          </p>
        </div>

        <div
          className={cn(
            "mt-6 flex items-center text-sm font-bold transition-transform",
            !disabled && "group-hover:translate-x-1",
            config.color
          )}
        >
          {disabled ? "利用不可" : "開始する"}
          {!disabled && (
            <span className="material-symbols-outlined text-sm ml-1">
              arrow_forward
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (disabled) {
    return content;
  }

  return <Link href={config.href}>{content}</Link>;
}
