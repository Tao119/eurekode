"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { MODE_CONFIG } from "@/config/modes";
import type { ChatMode } from "@/types/chat";

interface FeatureCardProps {
  mode: ChatMode;
  className?: string;
}

const FEATURE_URLS: Record<ChatMode, string> = {
  explanation: "/features/explanation",
  generation: "/features/generation",
  brainstorm: "/features/brainstorm",
};

export function FeatureCard({ mode, className }: FeatureCardProps) {
  const config = MODE_CONFIG[mode];
  const featureUrl = FEATURE_URLS[mode];

  return (
    <Link href={featureUrl} className="block">
      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border p-6 sm:p-8 transition-all duration-500 h-full",
          "border-border/50 bg-card/50 backdrop-blur-sm",
          "hover:border-primary/30 hover:bg-card/80 cursor-pointer",
          className
        )}
      >
        {/* Subtle gradient background */}
        <div
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-500",
            "group-hover:opacity-100",
            mode === "explanation" && "bg-gradient-to-br from-blue-500/10 via-transparent to-transparent",
            mode === "generation" && "bg-gradient-to-br from-amber-500/10 via-transparent to-transparent",
            mode === "brainstorm" && "bg-gradient-to-br from-violet-500/10 via-transparent to-transparent"
          )}
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* Icon */}
          <div
            className={cn(
              "size-14 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300",
              "group-hover:scale-110",
              mode === "explanation" && "bg-blue-500/15 text-blue-400",
              mode === "generation" && "bg-amber-500/15 text-amber-400",
              mode === "brainstorm" && "bg-violet-500/15 text-violet-400"
            )}
          >
            <span className="material-symbols-outlined text-3xl">
              {config.icon}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-foreground mb-3">
            {config.title}
          </h3>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed flex-1">
            {config.description}
          </p>

          {/* CTA */}
          <div
            className={cn(
              "mt-5 flex items-center text-sm font-medium transition-transform duration-300",
              "group-hover:translate-x-1",
              mode === "explanation" && "text-blue-400",
              mode === "generation" && "text-amber-400",
              mode === "brainstorm" && "text-violet-400"
            )}
          >
            詳しく見る
            <span className="material-symbols-outlined text-lg ml-1">
              arrow_forward
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
