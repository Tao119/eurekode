"use client";

import { useEffect, useState } from "react";
import { useIsOnline } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  className?: string;
  position?: "top" | "bottom";
  showWhenOnline?: boolean;
}

/**
 * Offline indicator banner
 * Shows when the user loses internet connection
 */
export function OfflineIndicator({
  className,
  position = "top",
  showWhenOnline = false,
}: OfflineIndicatorProps) {
  const isOnline = useIsOnline();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      // Show reconnected message briefly
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Don't show anything when online (unless showWhenOnline is true or reconnected)
  if (isOnline && !showReconnected && !showWhenOnline) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300",
        position === "top" ? "top-14" : "bottom-0",
        isOnline && showReconnected
          ? "bg-green-500 text-white"
          : "bg-yellow-500 text-yellow-950",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {isOnline && showReconnected ? (
        <>
          <span className="material-symbols-outlined text-lg">wifi</span>
          <span>インターネットに再接続しました</span>
        </>
      ) : (
        <>
          <span className="material-symbols-outlined text-lg animate-pulse">wifi_off</span>
          <span>オフラインです。一部の機能が制限されます</span>
        </>
      )}
    </div>
  );
}

/**
 * Simple offline badge for use in headers or other components
 */
export function OfflineBadge({ className }: { className?: string }) {
  const isOnline = useIsOnline();

  if (isOnline) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
        "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
        className
      )}
    >
      <span className="material-symbols-outlined text-sm">wifi_off</span>
      オフライン
    </span>
  );
}

export default OfflineIndicator;
