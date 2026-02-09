/**
 * Retry utility with exponential backoff
 * Inspired by: AWS SDK, Stripe API client patterns
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to delays (default: true) */
  jitter?: boolean;
  /** Errors that should trigger retry (default: all except AbortError) */
  retryOn?: (error: Error) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry" | "signal">> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryOn: (error) => {
    // Don't retry abort errors
    if (error.name === "AbortError") return false;
    // Retry network errors
    if (error.message.includes("fetch") || error.message.includes("network")) return true;
    // Retry timeout errors
    if (error.message.includes("timeout")) return true;
    // Default: retry all other errors
    return true;
  },
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  if (jitter) {
    // Add random jitter between 0-25% of the delay
    const jitterAmount = cappedDelay * Math.random() * 0.25;
    return Math.floor(cappedDelay + jitterAmount);
  }

  return cappedDelay;
}

/**
 * Sleep for specified milliseconds (with abort support)
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * Execute a function with automatic retry on failure
 *
 * @example
 * const result = await retry(
 *   () => fetch('/api/data'),
 *   { maxRetries: 3, onRetry: (attempt, error) => console.log(`Retry ${attempt}`) }
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Check if aborted before attempting
      if (opts.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry abort errors
      if (lastError.name === "AbortError") {
        throw lastError;
      }

      // Check if we should retry this error
      if (!opts.retryOn(lastError)) {
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      // Calculate delay and wait
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier,
        opts.jitter
      );

      // Call onRetry callback
      opts.onRetry?.(attempt + 1, lastError, delay);

      // Wait before retrying
      await sleep(delay, opts.signal);
    }
  }

  throw lastError!;
}

/**
 * Create a retryable version of a function
 */
export function withRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retry(() => fn(...args), options);
}

/**
 * Retry fetch with improved error handling
 */
export async function retryFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { retryOptions?: RetryOptions }
): Promise<Response> {
  const { retryOptions, ...fetchInit } = init || {};

  return retry(
    async () => {
      const response = await fetch(input, fetchInit);

      // Throw on 5xx errors to trigger retry
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      // Don't retry 4xx errors (client errors)
      return response;
    },
    {
      ...retryOptions,
      retryOn: (error) => {
        // Retry network errors and server errors
        if (error.message.includes("fetch") || error.message.includes("network")) {
          return true;
        }
        if (error.message.includes("Server error:")) {
          return true;
        }
        return false;
      },
    }
  );
}

/**
 * Preset retry configurations
 */
export const retryPresets = {
  /** Quick retry for fast operations (3 retries, 500ms initial) */
  quick: {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000,
  } as RetryOptions,

  /** Standard retry for API calls (3 retries, 1s initial) */
  standard: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
  } as RetryOptions,

  /** Aggressive retry for critical operations (5 retries, 2s initial) */
  aggressive: {
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 30000,
  } as RetryOptions,

  /** Single retry for UI operations */
  once: {
    maxRetries: 1,
    initialDelay: 500,
    maxDelay: 1000,
    jitter: false,
  } as RetryOptions,
};
