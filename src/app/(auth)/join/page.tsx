"use client";

import { Suspense, useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
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

const joinSchema = z.object({
  keySegments: z.array(z.string().length(5)).length(4),
  displayName: z
    .string()
    .min(1, "表示名を入力してください")
    .max(100, "表示名は100文字以内で入力してください"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("正しいメールアドレスを入力してください"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .regex(/[a-zA-Z]/, "パスワードには英字を含めてください")
    .regex(/[0-9]/, "パスワードには数字を含めてください"),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "パスワードが一致しません",
  path: ["passwordConfirm"],
});

type JoinFormData = z.infer<typeof joinSchema>;

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinFormSkeleton />}>
      <JoinForm />
    </Suspense>
  );
}

function JoinFormSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">person_add</span>
          招待キーで参加
        </CardTitle>
        <CardDescription>
          管理者から発行されたアクセスキーを入力し、アカウントを作成してください
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

function JoinForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    const error = searchParams.get("error");
    if (error === "INVALID_KEY") return "無効なアクセスキーです。";
    if (error === "KEY_EXPIRED") return "アクセスキーの有効期限が切れています。";
    if (error === "EMAIL_ALREADY_EXISTS") return "このメールアドレスは既に使用されています。";
    return null;
  });
  const [showPassword, setShowPassword] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect authenticated users to home
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/home");
    }
  }, [status, router]);

  const form = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      keySegments: ["", "", "", ""],
      displayName: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  const handleKeyInput = (
    index: number,
    value: string,
    onChange: (value: string[]) => void,
    currentSegments: string[]
  ) => {
    // Convert to uppercase and remove non-alphanumeric characters
    const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Update the segment
    const newSegments = [...currentSegments];
    newSegments[index] = cleanValue.slice(0, 5);
    onChange(newSegments);

    // Auto-focus next input when current is filled
    if (cleanValue.length >= 5 && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    index: number,
    currentSegments: string[]
  ) => {
    // Move to previous input on backspace when current is empty
    if (
      e.key === "Backspace" &&
      currentSegments[index] === "" &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (
    e: ClipboardEvent<HTMLInputElement>,
    onChange: (value: string[]) => void
  ) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");

    // Try to parse as full key (XXXXX-XXXXX-XXXXX-XXXXX)
    const cleanText = pastedText.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const segments = cleanText.split("-").filter((s) => s.length > 0);

    if (segments.length === 4) {
      // Full key pasted
      onChange(segments.map((s) => s.slice(0, 5)));
      inputRefs.current[3]?.focus();
    } else {
      // Single segment pasted
      const singleSegment = cleanText.replace(/-/g, "").slice(0, 5);
      const currentIndex = inputRefs.current.findIndex(
        (ref) => ref === document.activeElement
      );
      if (currentIndex !== -1) {
        const newSegments = form.getValues("keySegments");
        newSegments[currentIndex] = singleSegment;
        onChange(newSegments);
        if (singleSegment.length >= 5 && currentIndex < 3) {
          inputRefs.current[currentIndex + 1]?.focus();
        }
      }
    }
  };

  const onSubmit = async (data: JoinFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    const keyCode = data.keySegments.join("-");

    try {
      const result = await signIn("access-key", {
        keyCode,
        displayName: data.displayName,
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        switch (result.error) {
          // アクセスキー関連エラー
          case "INVALID_KEY":
            setErrorMessage("無効なアクセスキーです。キーが正しく入力されているか確認してください。");
            break;
          case "KEY_EXPIRED":
            setErrorMessage("このアクセスキーは有効期限が切れています。管理者に新しいキーの発行を依頼してください。");
            break;
          case "KEY_ALREADY_REGISTERED":
            setErrorMessage("このアクセスキーは既に登録済みです。メールアドレスとパスワードでログインしてください。");
            break;
          // メールアドレス関連エラー
          case "EMAIL_ALREADY_EXISTS":
            setErrorMessage("このメールアドレスは既に別のアカウントで使用されています。別のメールアドレスを使用するか、ログインしてください。");
            break;
          case "EMAIL_PASSWORD_REQUIRED":
            setErrorMessage("メールアドレスとパスワードを入力してください。");
            break;
          // 認証・サーバーエラー
          case "CredentialsSignin":
            setErrorMessage("認証に失敗しました。入力内容を確認してください。");
            break;
          case "Configuration":
            setErrorMessage("サーバー設定エラーが発生しました。しばらく経ってから再度お試しください。");
            break;
          default:
            // 詳細なエラー情報を表示
            setErrorMessage(`参加に失敗しました（${result.error}）。しばらく経ってから再度お試しください。`);
        }
        return;
      }

      router.push("/home");
      router.refresh();
    } catch (error) {
      // ネットワークエラーやサーバーエラーの詳細を表示
      if (error instanceof Error) {
        if (error.message.includes("fetch") || error.message.includes("network")) {
          setErrorMessage("ネットワークエラーが発生しました。インターネット接続を確認してください。");
        } else {
          setErrorMessage(`サーバーエラーが発生しました: ${error.message}`);
        }
      } else {
        setErrorMessage("予期しないエラーが発生しました。しばらく経ってから再度お試しください。");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    const keySegments = form.getValues("keySegments");
    const keyCode = keySegments.join("-");

    // Validate key format
    if (keySegments.some((s) => s.length !== 5)) {
      setErrorMessage("アクセスキーを正しく入力してください");
      return;
    }

    setIsGoogleLoading(true);
    setErrorMessage(null);

    try {
      // Verify access key and save to cookie
      const response = await fetch("/api/auth/verify-access-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyCode }),
      });

      const result = await response.json();

      if (!result.success) {
        setErrorMessage(result.error?.message || "アクセスキーの検証に失敗しました");
        return;
      }

      // Start Google OAuth (cookie is set by API)
      await signIn("google", { callbackUrl: "/home" });
    } catch {
      setErrorMessage("エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">person_add</span>
          招待キーで参加
        </CardTitle>
        <CardDescription>
          管理者から発行されたアクセスキーを入力し、アカウントを作成してください
        </CardDescription>
      </CardHeader>

      {/* 初回のみの説明 */}
      <div className="mx-6 mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-blue-500 text-lg shrink-0">info</span>
          <div className="text-sm">
            <p className="font-medium text-blue-500">招待キーは初回登録時のみ使用します</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              アカウント作成後は、メールアドレスとパスワードでログインしてください。
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <CardContent className="space-y-6">
            {errorMessage && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {errorMessage}
              </div>
            )}

            <FormField
              control={form.control}
              name="keySegments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>アクセスキー</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            ref={(el) => {
                              inputRefs.current[index] = el;
                            }}
                            type="text"
                            maxLength={5}
                            value={field.value[index]}
                            onChange={(e) =>
                              handleKeyInput(
                                index,
                                e.target.value,
                                field.onChange,
                                field.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, index, field.value)
                            }
                            onPaste={(e) => handlePaste(e, field.onChange)}
                            disabled={isLoading}
                            className="w-[70px] text-center font-mono uppercase tracking-wider"
                            placeholder="XXXXX"
                          />
                          {index < 3 && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Google登録オプション */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  登録方法を選択
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={isLoading || isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                {isGoogleLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Googleで登録
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">
                    または
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                メールアドレスとパスワードでアカウントを作成します。2回目以降はメールアドレスとパスワードでログインしてください。
              </p>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>表示名</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="山田 太郎"
                          autoComplete="name"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        この名前は管理者や他のメンバーに表示されます
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>メールアドレス</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="example@email.com"
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
                            placeholder="8文字以上（英字・数字を含む）"
                            autoComplete="new-password"
                            disabled={isLoading}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <span className="material-symbols-outlined text-xl">
                              {showPassword ? "visibility_off" : "visibility"}
                            </span>
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passwordConfirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>パスワード（確認）</FormLabel>
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="パスワードを再入力"
                          autoComplete="new-password"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-6">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  アカウント作成中...
                </>
              ) : (
                "アカウントを作成して参加"
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

            <div className="flex flex-col gap-3 w-full text-sm">
              {/* 既存ユーザー向け */}
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-muted-foreground mb-1">
                  <span className="material-symbols-outlined text-base align-middle mr-1">login</span>
                  既にアカウントをお持ちの方
                </p>
                <Link href="/login" className="text-primary hover:underline font-medium">
                  メールアドレスでログイン
                </Link>
              </div>

              <p className="text-muted-foreground text-center">
                個人で始める方は{" "}
                <Link href="/register" className="text-primary hover:underline">
                  新規登録
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
