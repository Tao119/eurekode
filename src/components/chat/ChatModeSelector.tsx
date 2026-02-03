"use client";

import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODE_CONFIG, MODE_ICON_SIZES } from "@/config/modes";
import type { ChatMode } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatModeSelectorProps {
  currentMode: ChatMode;
  conversationId?: string;
}

const MODES: ChatMode[] = ["explanation", "generation", "brainstorm"];

export function ChatModeSelector({ currentMode, conversationId }: ChatModeSelectorProps) {
  const router = useRouter();
  const config = MODE_CONFIG[currentMode];
  const iconSize = MODE_ICON_SIZES.header;

  const handleModeChange = (mode: ChatMode) => {
    if (mode === currentMode) return;
    router.push(MODE_CONFIG[mode].href);
  };

  const handleNewChat = () => {
    router.push(MODE_CONFIG[currentMode].href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-1.5 -m-1.5 transition-colors group">
          <div
            className={cn(
              "rounded-lg flex items-center justify-center",
              iconSize.container,
              config.bgColor,
              config.color
            )}
          >
            <span className={cn("material-symbols-outlined", iconSize.icon)}>
              {config.icon}
            </span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1">
              <h1 className="font-bold text-lg">{config.title}</h1>
              <span className="material-symbols-outlined text-muted-foreground text-base group-hover:text-foreground transition-colors">
                expand_more
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {config.shortDescription}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {/* New Chat Button */}
        {conversationId && (
          <>
            <DropdownMenuItem
              onClick={handleNewChat}
              className="cursor-pointer gap-3 py-2.5"
            >
              <div className={cn(
                "size-8 rounded-lg flex items-center justify-center",
                config.bgColor,
                config.color
              )}>
                <span className="material-symbols-outlined text-xl">add</span>
              </div>
              <div>
                <div className="font-medium">新しいチャット</div>
                <div className="text-xs text-muted-foreground">
                  {config.title}で新しい会話を開始
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Mode List */}
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground font-medium">モードを切り替え</p>
        </div>
        {MODES.map((mode) => {
          const modeConfig = MODE_CONFIG[mode];
          const isActive = mode === currentMode;

          return (
            <DropdownMenuItem
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={cn(
                "cursor-pointer gap-3 py-2.5",
                isActive && "bg-muted"
              )}
            >
              <div className={cn(
                "size-8 rounded-lg flex items-center justify-center",
                modeConfig.bgColor,
                modeConfig.color
              )}>
                <span className="material-symbols-outlined text-xl">{modeConfig.icon}</span>
              </div>
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {modeConfig.title}
                  {isActive && (
                    <span className="material-symbols-outlined text-primary text-base">check</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {modeConfig.shortDescription}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
