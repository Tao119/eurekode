"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";

interface TokenUsageContextValue {
  todayUsage: number;
  dailyLimit: number;
  isLoading: boolean;
  refreshUsage: () => Promise<void>;
  addUsage: (tokens: number) => void;
}

const TokenUsageContext = createContext<TokenUsageContextValue | null>(null);

export function TokenUsageProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [todayUsage, setTodayUsage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const dailyLimit = session?.user?.dailyTokenLimit || 1000;

  const refreshUsage = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/user/settings");
      const data = await response.json();
      if (data.success && data.data.tokenUsage !== undefined) {
        setTodayUsage(data.data.tokenUsage);
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

  // Initial fetch
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  return (
    <TokenUsageContext.Provider
      value={{
        todayUsage,
        dailyLimit,
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
