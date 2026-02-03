"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

interface TokenUsageContextValue {
  todayUsage: number;
  dailyLimit: number;
  organizationName: string | null;
  isLoading: boolean;
  refreshUsage: () => Promise<void>;
  addUsage: (tokens: number) => void;
}

const TokenUsageContext = createContext<TokenUsageContextValue | null>(null);

const DEFAULT_DAILY_LIMIT = 10000;

export function TokenUsageProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [todayUsage, setTodayUsage] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  const refreshUsage = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/user/settings");
      const data = await response.json();
      if (data.success) {
        if (data.data.tokenUsage !== undefined) {
          setTodayUsage(data.data.tokenUsage);
        }
        if (data.data.dailyTokenLimit !== undefined) {
          setDailyLimit(data.data.dailyTokenLimit);
        }
        if (data.data.organizationName !== undefined) {
          setOrganizationName(data.data.organizationName);
        }
      }
    } catch (error) {
      console.error("Failed to fetch token usage:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Add usage locally (optimistic update)
  const addUsage = useCallback((tokens: number) => {
    setTodayUsage((prev) => prev + tokens);
  }, []);

  // Initial fetch when session becomes authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refreshUsage();
    }
    // Reset when user logs out
    if (status === "unauthenticated") {
      hasFetchedRef.current = false;
      setTodayUsage(0);
      setDailyLimit(DEFAULT_DAILY_LIMIT);
      setOrganizationName(null);
    }
  }, [status, session?.user?.id, refreshUsage]);

  return (
    <TokenUsageContext.Provider
      value={{
        todayUsage,
        dailyLimit,
        organizationName,
        isLoading,
        refreshUsage,
        addUsage,
      }}
    >
      {children}
    </TokenUsageContext.Provider>
  );
}

export function useTokenUsage() {
  const context = useContext(TokenUsageContext);
  if (!context) {
    throw new Error("useTokenUsage must be used within TokenUsageProvider");
  }
  return context;
}

export function useTokenUsageOptional() {
  return useContext(TokenUsageContext);
}
