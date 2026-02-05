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
import { useUserSettingsOptional } from "@/contexts/UserSettingsContext";

interface ChatModeSelectorProps {
  currentMode: ChatMode;
  conversationId?: string;
}

const ALL_MODES: ChatMode[] = ["explanation", "generation", "brainstorm"];

export function ChatModeSelector({ currentMode, conversationId }: ChatModeSelectorProps) {
  const router = useRouter();
  const config = MODE_CONFIG[currentMode];
  const iconSize = MODE_ICON_SIZES.header;
  const userSettings = useUserSettingsOptional();
  const allowedModes = userSettings?.allowedModes ?? ALL_MODES;

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
        <button className="flex items-center gap-2 sm:gap-3 hover:bg-muted/50 active:scale-[0.98] rounded-lg p-1.5 -m-1.5 transition-all group whitespace-nowrap">
          <div
            className={cn(
              "rounded-lg flex items-center justify-center",
              "size-8 sm:size-9",
              config.bgColor,
              config.color
            )}
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">
              {config.icon}
            </span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1">
              <h1 className="font-bold text-base sm:text-lg">{config.title}</h1>
              <span className="material-symbols-outlined text-muted-foreground text-sm sm:text-base group-hover:text-foreground transition-colors">
                expand_more
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              {config.shortDescription}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 sm:w-72">
        {/* New Chat Button */}
        {conversationId && (
          <>
            <DropdownMenuItem
              onClick={handleNewChat}
              className="cursor-pointer gap-2.5 sm:gap-3 py-2.5 active:scale-[0.98]"
            >
              <div className={cn(
                "size-7 sm:size-8 rounded-lg flex items-center justify-center",
                config.bgColor,
                config.color
              )}>
                <span className="material-symbols-outlined text-lg sm:text-xl">add</span>
              </div>
              <div>
                <div className="font-medium text-sm sm:text-base">新しいチャット</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">
                  {config.title}で新規開始
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Mode List */}
        <div className="px-2 py-1.5">
          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">モードを切り替え</p>
        </div>
        {ALL_MODES.filter((mode) => allowedModes.includes(mode)).map((mode) => {
          const modeConfig = MODE_CONFIG[mode];
          const isActive = mode === currentMode;

          return (
            <DropdownMenuItem
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={cn(
                "cursor-pointer gap-2.5 sm:gap-3 py-2.5 active:scale-[0.98]",
                isActive && "bg-muted"
              )}
            >
              <div className={cn(
                "size-7 sm:size-8 rounded-lg flex items-center justify-center",
                modeConfig.bgColor,
                modeConfig.color
              )}>
                <span className="material-symbols-outlined text-lg sm:text-xl">{modeConfig.icon}</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm sm:text-base flex items-center gap-2">
                  {modeConfig.title}
                  {isActive && (
                    <span className="material-symbols-outlined text-primary text-sm sm:text-base">check</span>
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">
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
