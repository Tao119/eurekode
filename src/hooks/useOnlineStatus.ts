"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface OnlineStatusOptions {
  /** Check URL for connectivity test (default: /api/health) */
  pingUrl?: string;
  /** Interval for periodic connectivity checks in ms (default: 30000) */
  pingInterval?: number;
  /** Timeout for ping requests in ms (default: 5000) */
  pingTimeout?: number;
  /** Enable periodic ping checks (default: false) */
  enablePing?: boolean;
  /** Callback when going online */
  onOnline?: () => void;
  /** Callback when going offline */
  onOffline?: () => void;
}

interface OnlineStatus {
  /** Whether the browser reports being online */
  isOnline: boolean;
  /** Whether the last ping was successful (null if not checked) */
  isConnected: boolean | null;
  /** Whether currently checking connectivity */
  isChecking: boolean;
  /** Time since last successful connection check */
  lastChecked: Date | null;
  /** Manually trigger a connectivity check */
  checkConnection: () => Promise<boolean>;
}

/**
 * Hook to monitor online/offline status with optional ping checks
 *
 * @example
 * const { isOnline, isConnected, checkConnection } = useOnlineStatus({
 *   enablePing: true,
 *   onOffline: () => toast.warning("インターネット接続が切断されました"),
 *   onOnline: () => toast.success("オンラインに復帰しました"),
 * });
 */
export function useOnlineStatus(options: OnlineStatusOptions = {}): OnlineStatus {
  const {
    pingUrl = "/api/health",
    pingInterval = 30000,
    pingTimeout = 5000,
    enablePing = false,
    onOnline,
    onOffline,
  } = options;

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const wasOnlineRef = useRef(isOnline);

  // Ping check function
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), pingTimeout);

      const response = await fetch(pingUrl, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const connected = response.ok;
      setIsConnected(connected);
      setLastChecked(new Date());
      return connected;
    } catch {
      setIsConnected(false);
      setLastChecked(new Date());
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [pingUrl, pingTimeout]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!wasOnlineRef.current) {
        onOnline?.();
        // Verify actual connectivity when going online
        checkConnection();
      }
      wasOnlineRef.current = true;
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
      if (wasOnlineRef.current) {
        onOffline?.();
      }
      wasOnlineRef.current = false;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkConnection, onOnline, onOffline]);

  // Periodic ping checks
  useEffect(() => {
    if (!enablePing || !isOnline) return;

    // Initial check
    checkConnection();

    // Set up interval
    const intervalId = setInterval(checkConnection, pingInterval);

    return () => clearInterval(intervalId);
  }, [enablePing, isOnline, pingInterval, checkConnection]);

  return {
    isOnline,
    isConnected,
    isChecking,
    lastChecked,
    checkConnection,
  };
}

/**
 * Simple hook that just returns online status
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export default useOnlineStatus;
