"use client";

import { signOut } from "next-auth/react";

// Error codes that should trigger automatic logout
const AUTH_ERROR_CODES = ["UNAUTHORIZED", "INVALID_SESSION", "SESSION_EXPIRED"];
const AUTH_ERROR_STATUS_CODES = [401];

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Check if the response indicates an authentication error
 */
export function isAuthError(response: Response): boolean {
  return AUTH_ERROR_STATUS_CODES.includes(response.status);
}

/**
 * Check if the error code indicates an authentication error
 */
export function isAuthErrorCode(code: string): boolean {
  return AUTH_ERROR_CODES.includes(code);
}

/**
 * Handle authentication error by logging out the user
 */
export async function handleAuthError(): Promise<void> {
  // Clear any local state if needed
  try {
    // Sign out and redirect to login page
    await signOut({ callbackUrl: "/login", redirect: true });
  } catch (error) {
    // If signOut fails, force redirect
    console.error("Failed to sign out:", error);
    window.location.href = "/login";
  }
}

/**
 * Wrapper for fetch that automatically handles authentication errors
 * Use this for API calls that require authentication
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (isAuthError(response)) {
    // Clone response to read body without consuming it
    const clonedResponse = response.clone();
    try {
      const data = await clonedResponse.json();
      if (data.error?.code && isAuthErrorCode(data.error.code)) {
        await handleAuthError();
      }
    } catch {
      // If we can't parse the response, still handle 401
      await handleAuthError();
    }
  }

  return response;
}

/**
 * Check API response and handle auth errors
 * Returns true if auth error was detected and handled
 */
export async function checkAndHandleAuthError(
  response: Response
): Promise<boolean> {
  if (isAuthError(response)) {
    await handleAuthError();
    return true;
  }
  return false;
}
