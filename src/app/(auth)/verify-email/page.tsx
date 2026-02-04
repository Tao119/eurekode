"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailSkeleton />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">確認中...</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <LoadingSpinner />
      </CardContent>
    </Card>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "expired">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState(email || "");
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    async function verifyEmail() {
      if (!token || !email) {
        setStatus("error");
        setErrorMessage("無効な認証リンクです。");
        return;
      }

      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        });
        const result = await response.json();

        if (result.success) {
          setStatus("success");
        } else {
          if (result.error?.code === "TOKEN_EXPIRED") {
            setStatus("expired");
            setErrorMessage(result.error.message);
          } else {
            setStatus("error");
            setErrorMessage(result.error?.message || "認証に失敗しました");
          }
        }
      } catch {
        setStatus("error");
        setErrorMessage("認証中にエラーが発生しました");
      }
    }

    verifyEmail();
  }, [token, email]);

  const handleResend = async () => {
    if (!resendEmail) return;

    setIsResending(true);
    setResendSuccess(false);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const result = await response.json();

      if (result.success) {
        setResendSuccess(true);
        if (result.data?.alreadyVerified) {
          setStatus("success");
        }
      } else {
        setErrorMessage(result.error?.message || "再送信に失敗しました");
      }
    } catch {
      setErrorMessage("再送信中にエラーが発生しました");
    } finally {
      setIsResending(false);
    }
  };

  const handleLogin = () => {
    router.push("/login");
  };

  if (status === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">メールアドレスを確認中...</CardTitle>
          <CardDescription>
            しばらくお待ちください
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-4xl text-green-500">
              check_circle
            </span>
          </div>
          <CardTitle className="text-2xl font-bold">確認完了!</CardTitle>
          <CardDescription>
            メールアドレスの確認が完了しました
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>
            これでログインできるようになりました。
            <br />
            登録したメールアドレスとパスワードでログインしてください。
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleLogin} className="w-full">
            ログインする
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (status === "expired") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-4xl text-amber-500">
              schedule
            </span>
          </div>
          <CardTitle className="text-2xl font-bold">リンクの有効期限切れ</CardTitle>
          <CardDescription>
            認証リンクの有効期限が切れています
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            新しい確認メールを送信して、もう一度お試しください。
          </p>
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="メールアドレス"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              disabled={isResending}
            />
            {resendSuccess && (
              <p className="text-sm text-green-600">
                確認メールを送信しました。メールをご確認ください。
              </p>
            )}
            {errorMessage && !resendSuccess && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={handleResend}
            className="w-full"
            disabled={isResending || !resendEmail}
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
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">ログインページへ</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Error state
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-4xl text-destructive">
            error
          </span>
        </div>
        <CardTitle className="text-2xl font-bold">確認エラー</CardTitle>
        <CardDescription>
          {errorMessage || "メールアドレスの確認に失敗しました"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-center text-muted-foreground">
          確認メールを再送信するか、ログインページからお試しください。
        </p>
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="メールアドレス"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            disabled={isResending}
          />
          {resendSuccess && (
            <p className="text-sm text-green-600">
              確認メールを送信しました。メールをご確認ください。
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          onClick={handleResend}
          className="w-full"
          disabled={isResending || !resendEmail}
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
        <Button variant="outline" asChild className="w-full">
          <Link href="/login">ログインページへ</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
