"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// =============================================================================
// Common Types
// =============================================================================

interface BaseStateProps {
  className?: string;
  title?: string;
  description?: string;
}

// =============================================================================
// Empty State
// =============================================================================

interface EmptyStateProps extends BaseStateProps {
  icon?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  children?: ReactNode;
}

/**
 * Empty state component for when there's no data to display
 *
 * @example
 * <EmptyState
 *   icon="folder_open"
 *   title="プロジェクトがありません"
 *   description="新しいプロジェクトを作成して始めましょう"
 *   action={{ label: "プロジェクトを作成", href: "/projects/new" }}
 * />
 */
export function EmptyState({
  className,
  icon = "inbox",
  title = "データがありません",
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-muted-foreground">
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        action.href ? (
          <Button asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
      {children}
    </div>
  );
}

// =============================================================================
// Loading Error
// =============================================================================

interface LoadingErrorProps extends BaseStateProps {
  onRetry?: () => void;
  retryLabel?: string;
  showRetry?: boolean;
}

/**
 * Error state for failed data loading
 *
 * @example
 * <LoadingError
 *   title="データの読み込みに失敗しました"
 *   onRetry={() => refetch()}
 * />
 */
export function LoadingError({
  className,
  title = "読み込みに失敗しました",
  description = "データの取得中にエラーが発生しました",
  onRetry,
  retryLabel = "再試行",
  showRetry = true,
}: LoadingErrorProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-destructive">
          error_outline
        </span>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      {showRetry && onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <span className="material-symbols-outlined text-lg mr-2">refresh</span>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Network Error
// =============================================================================

interface NetworkErrorProps extends BaseStateProps {
  onRetry?: () => void;
  isOffline?: boolean;
}

/**
 * Network/connection error state
 *
 * @example
 * <NetworkError onRetry={() => refetch()} isOffline={!isOnline} />
 */
export function NetworkError({
  className,
  onRetry,
  isOffline = false,
}: NetworkErrorProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="size-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-yellow-500">
          {isOffline ? "wifi_off" : "cloud_off"}
        </span>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">
        {isOffline ? "オフラインです" : "ネットワークエラー"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {isOffline
          ? "インターネット接続を確認してください"
          : "サーバーに接続できません。しばらく経ってからお試しください"}
      </p>
      {onRetry && !isOffline && (
        <Button variant="outline" onClick={onRetry}>
          <span className="material-symbols-outlined text-lg mr-2">refresh</span>
          再接続
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Permission Error
// =============================================================================

interface PermissionErrorProps extends BaseStateProps {
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

/**
 * Permission/authorization error state
 *
 * @example
 * <PermissionError
 *   title="アクセス権限がありません"
 *   action={{ label: "ホームに戻る", href: "/home" }}
 * />
 */
export function PermissionError({
  className,
  title = "アクセスが制限されています",
  description = "この機能にアクセスする権限がありません",
  action,
}: PermissionErrorProps) {
  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="size-16 rounded-full bg-orange-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-orange-500">
              lock
            </span>
          </div>
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
      {action && (
        <CardFooter className="justify-center">
          {action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

// =============================================================================
// Session Expired
// =============================================================================

interface SessionExpiredProps extends BaseStateProps {
  onLogin?: () => void;
}

/**
 * Session expired state
 */
export function SessionExpired({
  className,
  title = "セッションが切れました",
  description = "続けるには再度ログインしてください",
  onLogin,
}: SessionExpiredProps) {
  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    } else {
      window.location.href = "/login";
    }
  };

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="size-16 rounded-full bg-blue-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-blue-500">
              schedule
            </span>
          </div>
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button onClick={handleLogin}>
          <span className="material-symbols-outlined text-lg mr-2">login</span>
          ログイン
        </Button>
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// Credits Exhausted
// =============================================================================

interface CreditsExhaustedProps extends BaseStateProps {
  remainingCredits?: number;
  planName?: string;
}

/**
 * Out of credits state
 */
export function CreditsExhausted({
  className,
  title = "クレジットが不足しています",
  description,
  remainingCredits = 0,
  planName,
}: CreditsExhaustedProps) {
  const defaultDescription = remainingCredits <= 0
    ? "本日の利用可能クレジットを使い切りました"
    : `残り ${remainingCredits} クレジットです`;

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-destructive">
              credit_card_off
            </span>
          </div>
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground">{description || defaultDescription}</p>
        {planName && (
          <p className="text-sm text-muted-foreground">
            現在のプラン: <span className="font-medium">{planName}</span>
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href="/settings/billing">
            <span className="material-symbols-outlined text-lg mr-2">arrow_circle_up</span>
            プランをアップグレード
          </Link>
        </Button>
        <Button variant="outline" asChild className="w-full">
          <Link href="/home">
            <span className="material-symbols-outlined text-lg mr-2">home</span>
            ホームに戻る
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// Inline Error
// =============================================================================

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Compact inline error for forms or small sections
 *
 * @example
 * <InlineError message="保存に失敗しました" onRetry={() => save()} />
 */
export function InlineError({ message, onRetry, className }: InlineErrorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-3 text-sm rounded-lg",
        "bg-destructive/10 text-destructive border border-destructive/20",
        className
      )}
      role="alert"
    >
      <span className="material-symbols-outlined text-lg shrink-0">error</span>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-7 text-xs text-destructive hover:text-destructive"
        >
          再試行
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Inline Warning
// =============================================================================

interface InlineWarningProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Compact inline warning
 */
export function InlineWarning({ message, action, className }: InlineWarningProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-3 text-sm rounded-lg",
        "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20",
        className
      )}
      role="alert"
    >
      <span className="material-symbols-outlined text-lg shrink-0">warning</span>
      <span className="flex-1">{message}</span>
      {action && (
        <Button
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          className="h-7 text-xs"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export default {
  EmptyState,
  LoadingError,
  NetworkError,
  PermissionError,
  SessionExpired,
  CreditsExhausted,
  InlineError,
  InlineWarning,
};
