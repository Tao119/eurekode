export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Token related
export interface TokenUsageResponse {
  used: number;
  limit: number;
  remaining: number;
  breakdown: TokenBreakdown;
}

export interface TokenBreakdown {
  explanation: number;
  generation: number;
  brainstorm: number;
}

// Chat API types
export interface ChatRequest {
  message: string;
  conversationId?: string;
  options?: Record<string, unknown>;
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  tokensUsed: number;
  metadata?: Record<string, unknown>;
}

// Auth API types
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  userType: "individual" | "admin";
  organizationName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JoinWithKeyRequest {
  keyCode: string;
  displayName: string;
}

// Admin API types
export interface CreateKeyRequest {
  expiresIn?: "1week" | "1month" | "3months" | "unlimited";
  allowedModes?: ("explanation" | "generation" | "brainstorm")[];
  dailyTokenLimit?: number;
  unlockSkipAllowed?: boolean;
  allowedTechStacks?: string[];
}

export interface BulkCreateKeyRequest {
  count: number;
  settings: CreateKeyRequest;
}

export const API_ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  USER_EXISTS: "USER_EXISTS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  INVALID_KEY: "INVALID_KEY",
  KEY_EXPIRED: "KEY_EXPIRED",
  KEY_ALREADY_USED: "KEY_ALREADY_USED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",

  // Token/Credit errors
  TOKEN_LIMIT_EXCEEDED: "TOKEN_LIMIT_EXCEEDED",
  INSUFFICIENT_TOKENS: "INSUFFICIENT_TOKENS",
  OUT_OF_CREDITS: "OUT_OF_CREDITS",

  // Authorization errors
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Network errors
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",

  // AI/Chat errors
  AI_ERROR: "AI_ERROR",
  CHAT_ERROR: "CHAT_ERROR",
  STREAM_ERROR: "STREAM_ERROR",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;
