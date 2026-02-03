"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string;
  className?: string;
}

const sizes = {
  sm: {
    icon: "size-6",
    iconText: "text-xs",
    text: "text-base",
  },
  md: {
    icon: "size-8",
    iconText: "text-sm",
    text: "text-lg",
  },
  lg: {
    icon: "size-10",
    iconText: "text-base",
    text: "text-xl",
  },
};

export function Logo({
  size = "md",
  showText = true,
  href = "/",
  className,
}: LogoProps) {
  const sizeClasses = sizes[size];

  const content = (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          sizeClasses.icon,
          "rounded-lg bg-primary/20 text-primary flex items-center justify-center"
        )}
      >
        <span className={cn("material-symbols-outlined", sizeClasses.iconText)}>
          terminal
        </span>
      </div>
      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight text-foreground",
            sizeClasses.text
          )}
        >
          Eurecode
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
