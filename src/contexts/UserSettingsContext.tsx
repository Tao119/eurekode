"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/types/user";

interface UserSettingsContextValue {
  settings: UserSettings;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  refetch: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

interface UserSettingsProviderProps {
  children: ReactNode;
}

export function UserSettingsProvider({ children }: UserSettingsProviderProps) {
  const { status } = useSession();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    if (status !== "authenticated") return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/settings");
      const data = await response.json();

      if (data.success) {
        setSettings(data.data);
      } else {
        throw new Error(data.error?.message || "設定の取得に失敗しました");
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("設定の取得に失敗しました"));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    // Optimistic update
    const previousSettings = settings;
    setSettings((prev) => ({ ...prev, ...updates }));

    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!data.success) {
        // Rollback on failure
        setSettings(previousSettings);
        throw new Error(data.error?.message || "設定の保存に失敗しました");
      }

      // Update with server response
      setSettings(data.data);
    } catch (err) {
      // Rollback on error
      setSettings(previousSettings);
      throw err;
    }
  }, [settings]);

  // Fetch settings when authenticated
  useEffect(() => {
    if (status === "authenticated") {
      fetchSettings();
    }
  }, [status, fetchSettings]);

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        isLoading,
        error,
        updateSettings,
        refetch: fetchSettings,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextValue {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error("useUserSettings must be used within a UserSettingsProvider");
  }
  return context;
}

// Hook for optional access (doesn't throw if outside provider)
export function useUserSettingsOptional(): UserSettingsContextValue | null {
  return useContext(UserSettingsContext);
}
