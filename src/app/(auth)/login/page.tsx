"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFormSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">ログイン</CardTitle>
        <CardDescription>
          メールアドレスとパスワードでログインしてください
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </CardContent>
    </Card>
  );
}

function LoginForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/home";
  const error = searchParams.get("error");

  // Redirect authenticated users to home
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/home");
    }
  }, [status, router]);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (error === "CredentialsSignin") {
      return "メールアドレスまたはパスワードが正しくありません";
    }
    if (error === "OAuthAccountNotLinked") {
      return "このメールアドレスは別の方法で登録されています。元の方法でログインしてください。";
    }
    if (error === "OAuthSignin" || error === "OAuthCallback") {
      return "Google認証に失敗しました。もう一度お試しください。";
    }
    return null;
  });
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);
    setShowResendVerification(false);
    setResendSuccess(false);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "EMAIL_NOT_VERIFIED") {
          setErrorMessage(
            "メールアドレスの確認が完了していません。メールをご確認ください。"
          );
          setShowResendVerification(true);
        } else if (result.error === "ACCOUNT_DISABLED") {
          setErrorMessage(
            "このアカウントは無効化されています。管理者にお問い合わせください。"
          );
        } else {
          setErrorMessage(
            "メールアドレスまたはパスワードが正しくありません"
          );
        }
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setErrorMessage("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const email = form.getValues("email");
    if (!email) {
      setErrorMessage("メールアドレスを入力してください");
      return;
    }

    setIsResending(true);
    setResendSuccess(false);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();

      if (result.success) {
        setResendSuccess(true);
        setErrorMessage(null);
        if (result.data?.alreadyVerified) {
          setShowResendVerification(false);
          setErrorMessage("メールアドレスは既に確認済みです。ログインしてください。");
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

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">ログイン</CardTitle>
        <CardDescription>
          メールアドレスとパスワードでログインしてください
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            {resendSuccess && (
              <div className="p-3 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-md">
                確認メールを送信しました。メールをご確認ください。
              </div>
            )}
            {errorMessage && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                <p>{errorMessage}</p>
                {showResendVerification && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="mt-2 text-primary hover:underline disabled:opacity-50"
                  >
                    {isResending ? "送信中..." : "確認メールを再送信"}
                  </button>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メールアドレス</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      autoComplete="email"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>パスワード</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={isLoading}
                        {...field}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                パスワードをお忘れですか？
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  ログイン中...
                </>
              ) : (
                "ログイン"
              )}
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  または
                </span>
              </div>
            </div>

            <GoogleLoginButton callbackUrl={callbackUrl} mode="login" />

            <div className="flex flex-col gap-2 w-full text-sm text-center">
              <p className="text-muted-foreground">
                アカウントをお持ちでない方は{" "}
                <Link href="/register" className="text-primary hover:underline">
                  新規登録
                </Link>
              </p>
              <p className="text-muted-foreground">
                アクセスキーをお持ちの方は{" "}
                <Link href="/join" className="text-primary hover:underline">
                  キー入力
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
