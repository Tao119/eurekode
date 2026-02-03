"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      <UserSettingsProvider>{children}</UserSettingsProvider>
    </NextAuthSessionProvider>
  );
}
