import { toast } from "sonner";

type ToastType = "success" | "error" | "info" | "warning" | "loading";

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show a success toast
 */
export function showSuccess(message: string, options?: ToastOptions) {
  return toast.success(message, {
    description: options?.description,
    duration: options?.duration ?? 3000,
    action: options?.action,
  });
}

/**
 * Show an error toast
 */
export function showError(message: string, options?: ToastOptions) {
  return toast.error(message, {
    description: options?.description,
    duration: options?.duration ?? 5000,
    action: options?.action,
  });
}

/**
 * Show an info toast
 */
export function showInfo(message: string, options?: ToastOptions) {
  return toast.info(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
    action: options?.action,
  });
}

/**
 * Show a warning toast
 */
export function showWarning(message: string, options?: ToastOptions) {
  return toast.warning(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
    action: options?.action,
  });
}

/**
 * Show a loading toast (returns dismiss function)
 */
export function showLoading(message: string): string | number {
  return toast.loading(message);
}

/**
 * Dismiss a specific toast
 */
export function dismissToast(toastId: string | number) {
  toast.dismiss(toastId);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts() {
  toast.dismiss();
}

/**
 * Execute an async operation with loading/success/error toasts
 */
export async function withToast<T>(
  operation: () => Promise<T>,
  options: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: Error) => string);
  }
): Promise<T> {
  const toastId = toast.loading(options.loading);

  try {
    const result = await operation();
    const successMessage =
      typeof options.success === "function"
        ? options.success(result)
        : options.success;
    toast.success(successMessage, { id: toastId });
    return result;
  } catch (error) {
    const errorMessage =
      typeof options.error === "function"
        ? options.error(error instanceof Error ? error : new Error(String(error)))
        : options.error;
    toast.error(errorMessage, { id: toastId });
    throw error;
  }
}

/**
 * Execute an async operation with a promise toast
 * Returns the original promise result
 */
export async function promiseToast<T>(
  promise: Promise<T>,
  options: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: Error) => string);
  }
): Promise<T> {
  toast.promise(promise, {
    loading: options.loading,
    success: (data: T) =>
      typeof options.success === "function" ? options.success(data) : options.success,
    error: (err: Error) =>
      typeof options.error === "function" ? options.error(err) : options.error,
  });
  return promise;
}

/**
 * Common toast presets for typical operations
 * Inspired by: Stripe, Linear, Notion patterns
 */
export const toastPresets = {
  // Success operations
  save: () =>
    withToast(
      async () => {},
      {
        loading: "保存中...",
        success: "保存しました",
        error: "保存に失敗しました",
      }
    ),

  delete: () =>
    withToast(
      async () => {},
      {
        loading: "削除中...",
        success: "削除しました",
        error: "削除に失敗しました",
      }
    ),

  copy: (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("コピーしました");
  },

  // Network & Connection
  networkError: (onRetry?: () => void) =>
    showError("ネットワークエラーが発生しました", {
      description: "インターネット接続を確認してください",
      duration: 8000,
      action: onRetry
        ? {
            label: "再試行",
            onClick: onRetry,
          }
        : undefined,
    }),

  offline: () =>
    showWarning("オフラインです", {
      description: "一部の機能が制限されます",
      duration: 10000,
    }),

  reconnected: () =>
    showSuccess("オンラインに復帰しました", {
      duration: 3000,
    }),

  timeout: (onRetry?: () => void) =>
    showError("タイムアウトしました", {
      description: "リクエストの処理に時間がかかりすぎています",
      duration: 8000,
      action: onRetry
        ? {
            label: "再試行",
            onClick: onRetry,
          }
        : undefined,
    }),

  // Auth
  sessionExpired: () =>
    showWarning("セッションが切れました", {
      description: "再度ログインしてください",
      action: {
        label: "ログイン",
        onClick: () => (window.location.href = "/login"),
      },
    }),

  unauthorized: () =>
    showError("ログインが必要です", {
      description: "続けるにはログインしてください",
      action: {
        label: "ログイン",
        onClick: () => (window.location.href = "/login"),
      },
    }),

  forbidden: () =>
    showError("アクセスが拒否されました", {
      description: "この操作を行う権限がありません",
      duration: 5000,
    }),

  // Chat & AI
  chatError: (onRetry?: () => void) =>
    showError("メッセージの送信に失敗しました", {
      description: "もう一度お試しください",
      duration: 8000,
      action: onRetry
        ? {
            label: "再送信",
            onClick: onRetry,
          }
        : undefined,
    }),

  aiError: () =>
    showError("AI処理中にエラーが発生しました", {
      description: "しばらく経ってからお試しください",
      duration: 8000,
    }),

  streamError: (onRetry?: () => void) =>
    showError("応答の受信中にエラーが発生しました", {
      description: "接続が中断されました",
      duration: 8000,
      action: onRetry
        ? {
            label: "再接続",
            onClick: onRetry,
          }
        : undefined,
    }),

  // Rate Limiting & Credits
  rateLimited: (retryAfter?: number) =>
    showWarning("リクエスト制限に達しました", {
      description: retryAfter
        ? `${retryAfter}秒後に再度お試しください`
        : "しばらく待ってからお試しください",
      duration: 10000,
    }),

  outOfCredits: () =>
    showError("クレジットが不足しています", {
      description: "プランをアップグレードするか、クレジットを購入してください",
      duration: 10000,
      action: {
        label: "購入",
        onClick: () => (window.location.href = "/settings/billing"),
      },
    }),

  lowCredits: (remaining: number) =>
    showWarning(`クレジット残り${remaining}`, {
      description: "追加購入を検討してください",
      duration: 8000,
      action: {
        label: "確認",
        onClick: () => (window.location.href = "/settings/billing"),
      },
    }),

  // Validation
  validationError: (message?: string) =>
    showError(message || "入力内容に問題があります", {
      description: "入力を確認してください",
      duration: 5000,
    }),

  // Server Errors
  serverError: (onRetry?: () => void) =>
    showError("サーバーエラーが発生しました", {
      description: "しばらく経ってから再度お試しください",
      duration: 8000,
      action: onRetry
        ? {
            label: "再試行",
            onClick: onRetry,
          }
        : undefined,
    }),

  maintenanceMode: () =>
    showWarning("メンテナンス中です", {
      description: "しばらくお待ちください",
      duration: 15000,
    }),

  // Data operations
  loadError: (onRetry?: () => void) =>
    showError("データの読み込みに失敗しました", {
      description: "ページを更新してください",
      duration: 8000,
      action: onRetry
        ? {
            label: "再読み込み",
            onClick: onRetry,
          }
        : undefined,
    }),

  updateConflict: () =>
    showWarning("データが更新されています", {
      description: "最新のデータを取得してください",
      action: {
        label: "更新",
        onClick: () => window.location.reload(),
      },
    }),

  // User actions
  actionSuccess: (action: string) =>
    showSuccess(`${action}しました`),

  actionError: (action: string, onRetry?: () => void) =>
    showError(`${action}に失敗しました`, {
      action: onRetry
        ? {
            label: "再試行",
            onClick: onRetry,
          }
        : undefined,
    }),
};

/**
 * Create a reusable toast function for async operations
 */
export function createAsyncToast<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    loading: string;
    success: string | ((result: TResult) => string);
    error: string | ((error: Error) => string);
  }
) {
  return async (...args: TArgs): Promise<TResult> => {
    return withToast(() => fn(...args), options);
  };
}
