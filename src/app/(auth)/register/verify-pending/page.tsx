"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export default function VerifyPendingPage() {
  return (
    <Suspense fallback={<VerifyPendingSkeleton />}>
      <VerifyPendingContent />
    </Suspense>
  );
}

function VerifyPendingSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">読み込み中...</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <LoadingSpinner />
      </CardContent>
    </Card>
  );
}

function VerifyPendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email) return;

    setIsResending(true);
    setResendSuccess(false);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();

      if (result.success) {
        setResendSuccess(true);
      } else {
        setErrorMessage(result.error?.message || "再送信に失敗しました");
      }
    } catch {
      setErrorMessage("再送信中にエラーが発生しました");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-4xl text-primary">
            mail
          </span>
        </div>
        <CardTitle className="text-2xl font-bold">メールを確認してください</CardTitle>
        <CardDescription>
          確認メールを送信しました
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {email && (
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">送信先</p>
            <p className="font-medium break-all">{email}</p>
          </div>
        )}
        <div className="text-sm text-center text-muted-foreground space-y-2">
          <p>
            メール内のリンクをクリックして、アカウントを有効化してください。
          </p>
          <p className="text-xs">
            メールが届かない場合は、迷惑メールフォルダをご確認いただくか、
            以下のボタンで再送信してください。
          </p>
        </div>
        {resendSuccess && (
          <div className="p-3 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-md text-center">
            確認メールを再送信しました
          </div>
        )}
        {errorMessage && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md text-center">
            {errorMessage}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          onClick={handleResend}
          variant="outline"
          className="w-full"
          disabled={isResending || !email}
        >
          {isResending ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              送信中...
            </>
          ) : (
            "確認メールを再送信"
          )}
        </Button>
        <Button asChild className="w-full">
          <Link href="/login">ログインページへ</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
