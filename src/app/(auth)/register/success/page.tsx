"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
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

export default function RegisterSuccessPage() {
  return (
    <Suspense fallback={<RegisterSuccessSkeleton />}>
      <RegisterSuccessContent />
    </Suspense>
  );
}

function RegisterSuccessSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">登録処理中...</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <LoadingSpinner />
      </CardContent>
    </Card>
  );
}

function RegisterSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "success" | "logging_in" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  useEffect(() => {
    async function verifySession() {
      if (!sessionId) {
        setStatus("error");
        setErrorMessage("セッションIDが見つかりません");
        return;
      }

      try {
        // Verify the checkout session
        const response = await fetch(`/api/auth/verify-registration?session_id=${sessionId}`);
        const result = await response.json();

        if (result.success) {
          setEmail(result.data.email);

          // ログイントークンがあれば自動ログイン
          if (result.data.loginToken && result.data.status === "completed") {
            setStatus("logging_in");
            setIsAutoLoggingIn(true);

            try {
              const signInResult = await signIn("login-token", {
                loginToken: result.data.loginToken,
                redirect: false,
              });

              if (signInResult?.ok) {
                // ログイン成功、ホームページへリダイレクト
                router.push("/");
                return;
              } else {
                // 自動ログイン失敗、手動ログインを促す
                setStatus("success");
                setIsAutoLoggingIn(false);
              }
            } catch {
              // 自動ログイン失敗、手動ログインを促す
              setStatus("success");
              setIsAutoLoggingIn(false);
            }
          } else if (result.data.status === "pending") {
            // Webhookがまだ処理中、ポーリングで再試行
            setTimeout(() => verifySession(), 2000);
          } else {
            setStatus("success");
          }
        } else {
          setStatus("error");
          setErrorMessage(result.error?.message || "登録の確認に失敗しました");
        }
      } catch {
        setStatus("error");
        setErrorMessage("登録の確認中にエラーが発生しました");
      }
    }

    verifySession();
  }, [sessionId]);

  const handleLogin = () => {
    router.push("/login");
  };

  if (status === "loading" || status === "logging_in") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            {status === "logging_in" ? "ログイン中..." : "登録を確認中..."}
          </CardTitle>
          <CardDescription>
            {status === "logging_in"
              ? "自動ログインしています。しばらくお待ちください。"
              : "決済情報を確認しています。しばらくお待ちください。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-4xl text-destructive">
              error
            </span>
          </div>
          <CardTitle className="text-2xl font-bold">登録エラー</CardTitle>
          <CardDescription>
            {errorMessage || "登録処理中にエラーが発生しました"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>
            決済が完了している場合、アカウントは自動的に作成されます。
            <br />
            数分後にログインをお試しください。
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/login">ログインページへ</Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/register">登録ページに戻る</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-4xl text-green-500">
            check_circle
          </span>
        </div>
        <CardTitle className="text-2xl font-bold">登録完了!</CardTitle>
        <CardDescription>
          アカウントの作成が完了しました
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {email && (
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">登録メールアドレス</p>
            <p className="font-medium">{email}</p>
          </div>
        )}
        <div className="text-sm text-center text-muted-foreground">
          <p>
            登録したメールアドレスとパスワードでログインできます。
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleLogin} className="w-full">
          ログインする
        </Button>
      </CardFooter>
    </Card>
  );
}
