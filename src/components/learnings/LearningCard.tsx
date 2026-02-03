"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Learning } from "@/types/learning";

interface LearningCardProps {
  learning: Learning;
  variant?: "compact" | "full";
  onClick?: () => void;
  onDelete?: () => void;
  className?: string;
}

const typeConfig: Record<
  "insight" | "reflection",
  {
    icon: string;
    label: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  insight: {
    icon: "lightbulb",
    label: "インサイト",
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-600",
    borderColor: "border-yellow-500/20",
  },
  reflection: {
    icon: "psychology",
    label: "振り返り",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-600",
    borderColor: "border-purple-500/20",
  },
};

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
  return date.toLocaleDateString("ja-JP");
}

function getContentPreview(content: string, maxLength: number = 80): string {
  // Remove title line if present (first line before double newline)
  const lines = content.split("\n\n");
  const previewText = lines.length > 1 ? lines.slice(1).join(" ") : content;

  if (previewText.length <= maxLength) return previewText;
  return previewText.substring(0, maxLength) + "...";
}

function getTitle(content: string): string {
  // First line is typically the title
  const firstLine = content.split("\n")[0];
  return firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine;
}

export function LearningCard({
  learning,
  variant = "compact",
  onClick,
  onDelete,
  className,
}: LearningCardProps) {
  const config = typeConfig[learning.type];
  const title = getTitle(learning.content);
  const preview = getContentPreview(learning.content);

  if (variant === "compact") {
    return (
      <Card
        className={cn(
          "cursor-pointer hover:bg-muted/50 transition-colors group",
          className
        )}
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "size-6 rounded-md flex items-center justify-center",
                  config.bgColor
                )}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-sm",
                    config.textColor
                  )}
                >
                  {config.icon}
                </span>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  config.bgColor,
                  config.textColor
                )}
              >
                {config.label}
              </span>
            </div>
            <span className="text-muted-foreground text-xs">
              {formatRelativeDate(learning.createdAt)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="font-medium text-sm mb-1 line-clamp-1">{title}</h3>
          <p className="text-muted-foreground text-xs line-clamp-2">{preview}</p>
          {learning.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {learning.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary"
                >
                  {tag}
                </span>
              ))}
              {learning.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{learning.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full variant
  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors group",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
              config.bgColor
            )}
          >
            <span className={cn("material-symbols-outlined", config.textColor)}>
              {config.icon}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  config.bgColor,
                  config.textColor
                )}
              >
                {config.label}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatRelativeDate(learning.createdAt)}
              </span>
            </div>

            <h3 className="font-medium mb-1 line-clamp-1">{title}</h3>
            <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
              {preview}
            </p>

            {learning.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {learning.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {learning.conversation && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <span className="material-symbols-outlined text-sm">
                  chat_bubble_outline
                </span>
                <span className="truncate">{learning.conversation.title}</span>
              </div>
            )}
          </div>

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
