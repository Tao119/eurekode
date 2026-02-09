"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { captureReactError } from "@/lib/error-monitor";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    captureReactError(error, { componentStack: error.stack });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="size-20 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-destructive text-4xl">
            error
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">エラーが発生しました</h1>
          <p className="text-muted-foreground">
            予期しないエラーが発生しました。
            <br />
            再試行するか、問題が続く場合はサポートにお問い合わせください。
          </p>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            エラーID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default">
            <span className="material-symbols-outlined text-lg mr-2">refresh</span>
            再試行
          </Button>
          <Button variant="outline" asChild>
            <a href="/home">
              <span className="material-symbols-outlined text-lg mr-2">home</span>
              ホームに戻る
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
