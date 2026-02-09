"use client";

import { ReactNode, useEffect } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { OfflineIndicator } from "./OfflineIndicator";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { toastPresets } from "@/lib/toast-utils";

interface ClientErrorHandlerProps {
  children: ReactNode;
}

/**
 * Client-side error handler wrapper
 * Provides:
 * - Global error boundary
 * - Offline detection with toast notifications
 * - Network status indicator
 */
export function ClientErrorHandler({ children }: ClientErrorHandlerProps) {
  // Online status with toast notifications
  useOnlineStatus({
    onOffline: () => toastPresets.offline(),
    onOnline: () => toastPresets.reconnected(),
  });

  return (
    <ErrorBoundary level="page" showDetails={process.env.NODE_ENV === "development"}>
      <OfflineIndicator position="top" />
      {children}
    </ErrorBoundary>
  );
}

/**
 * Hook to handle API response errors with standardized toasts
 */
export function useApiErrorHandler() {
  const handleError = (error: unknown, onRetry?: () => void) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network errors
      if (message.includes("fetch") || message.includes("network")) {
        toastPresets.networkError(onRetry);
        return;
      }

      // Timeout
      if (message.includes("timeout")) {
        toastPresets.timeout(onRetry);
        return;
      }
    }

    // Check for API error codes
    if (typeof error === "object" && error !== null && "code" in error) {
      const apiError = error as { code: string; message?: string };

      switch (apiError.code) {
        case "UNAUTHORIZED":
        case "SESSION_EXPIRED":
          toastPresets.sessionExpired();
          return;
        case "FORBIDDEN":
          toastPresets.forbidden();
          return;
        case "RATE_LIMITED":
        case "TOO_MANY_REQUESTS":
          toastPresets.rateLimited();
          return;
        case "OUT_OF_CREDITS":
        case "INSUFFICIENT_TOKENS":
          toastPresets.outOfCredits();
          return;
        case "VALIDATION_ERROR":
          toastPresets.validationError(apiError.message);
          return;
        default:
          toastPresets.serverError(onRetry);
          return;
      }
    }

    // Generic server error
    toastPresets.serverError(onRetry);
  };

  return { handleError };
}

export default ClientErrorHandler;
