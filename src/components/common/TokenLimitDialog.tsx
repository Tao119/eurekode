"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TokenLimitDialogProps {
  open: boolean;
  onClose: () => void;
  currentUsage: number;
  dailyLimit: number;
  remaining: number;
  required?: number;
}

export function TokenLimitDialog({
  open,
  onClose,
  currentUsage,
  dailyLimit,
  remaining,
  required,
}: TokenLimitDialogProps) {
  const usagePercent = Math.min(100, (currentUsage / dailyLimit) * 100);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-12 rounded-full bg-warning/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-warning text-2xl">
                token
              </span>
            </div>
            <DialogTitle className="text-xl">
              トークン上限に達しました
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            本日のトークン使用量が上限に達したため、この操作を実行できません。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Usage Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">本日の使用量</span>
              <span className="font-medium">
                {currentUsage.toLocaleString()} / {dailyLimit.toLocaleString()} トークン
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-warning transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          {/* Details */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">残りトークン</span>
              <span className="font-medium text-warning">{remaining.toLocaleString()}</span>
            </div>
            {required !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">必要トークン</span>
                <span className="font-medium">{required.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="material-symbols-outlined text-lg mt-0.5">info</span>
            <p>
              トークンは毎日0時にリセットされます。
              より多くのトークンが必要な場合は、プランのアップグレードをご検討ください。
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            閉じる
          </Button>
          <Button asChild className="flex-1">
            <Link href="/settings">
              <span className="material-symbols-outlined mr-2 text-lg">upgrade</span>
              プランを確認
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for easy usage
interface TokenLimitError {
  code: string;
  message: string;
  details?: {
    currentUsage: number;
    dailyLimit: number;
    remaining: number;
    required: number;
  };
}

export function useTokenLimitDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<TokenLimitError["details"] | null>(null);

  const showTokenLimitError = (error: TokenLimitError) => {
    if (error.code === "TOKEN_LIMIT_EXCEEDED" && error.details) {
      setErrorDetails(error.details);
      setIsOpen(true);
      return true;
    }
    return false;
  };

  const closeDialog = () => {
    setIsOpen(false);
    setErrorDetails(null);
  };

  const TokenLimitDialogComponent = () =>
    errorDetails ? (
      <TokenLimitDialog
        open={isOpen}
        onClose={closeDialog}
        currentUsage={errorDetails.currentUsage}
        dailyLimit={errorDetails.dailyLimit}
        remaining={errorDetails.remaining}
        required={errorDetails.required}
      />
    ) : null;

  return {
    showTokenLimitError,
    closeDialog,
    TokenLimitDialog: TokenLimitDialogComponent,
    isOpen,
  };
}
