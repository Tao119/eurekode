"use client";

import { useState, useEffect, Suspense } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  INDIVIDUAL_PLANS,
  ORGANIZATION_PLANS,
  formatPrice,
  getAllIndividualPlans,
  getAllOrganizationPlans,
  type IndividualPlan,
  type OrganizationPlan,
} from "@/config/plans";

const registerSchema = z
  .object({
    userType: z.enum(["individual", "admin"]),
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z
      .string()
      .min(8, "パスワードは8文字以上で入力してください")
      .regex(
        /^(?=.*[a-zA-Z])(?=.*\d)/,
        "パスワードは英字と数字を含める必要があります"
      ),
    confirmPassword: z.string(),
    displayName: z
      .string()
      .min(1, "表示名を入力してください")
      .max(100, "表示名は100文字以内で入力してください"),
    organizationName: z.string().optional(),
    agreeTerms: z.boolean().refine((val) => val, {
      message: "利用規約に同意してください",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => data.userType !== "admin" || (data.organizationName && data.organizationName.length > 0),
    {
      message: "組織名を入力してください",
      path: ["organizationName"],
    }
  );

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFormSkeleton />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterFormSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">新規登録</CardTitle>
        <CardDescription>
          アカウントを作成して学習を始めましょう
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

function RegisterForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect authenticated users to home
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/home");
    }
  }, [status, router]);

  // Get plan and type from URL parameters
  const initialPlan = searchParams.get("plan");
  const selectedType = searchParams.get("type"); // "admin" for organization
  const cancelled = searchParams.get("cancelled");

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    cancelled === "true" ? "決済がキャンセルされました。再度お試しください。" : null
  );
  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlan || "free");

  // Get available plans based on account type
  const individualPlans = getAllIndividualPlans();
  const organizationPlans = getAllOrganizationPlans().filter(p => p.id !== "enterprise"); // Exclude enterprise for self-service

  // Get current plan info for display
  const getPlanInfo = (plan: string, isOrg: boolean) => {
    if (isOrg) {
      return ORGANIZATION_PLANS[plan as OrganizationPlan];
    }
    return INDIVIDUAL_PLANS[plan as IndividualPlan];
  };

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      userType: selectedType === "admin" ? "admin" : "individual",
      email: "",
      password: "",
      confirmPassword: "",
      displayName: "",
      organizationName: "",
      agreeTerms: false,
    },
  });

  // Update userType when URL param changes
  useEffect(() => {
    if (selectedType === "admin") {
      form.setValue("userType", "admin");
    }
  }, [selectedType, form]);

  // Reset plan to free when switching account type (since plans are different)
  const userType = form.watch("userType");
  useEffect(() => {
    setSelectedPlan("free");
  }, [userType]);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // For paid plans, redirect to Stripe Checkout first
      if (selectedPlan !== "free") {
        const checkoutResponse = await fetch("/api/auth/register-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            displayName: data.displayName,
            userType: data.userType,
            organizationName: data.organizationName,
            plan: selectedPlan,
            billingInterval: "monthly",
          }),
        });

        const checkoutResult = await checkoutResponse.json();

        if (!checkoutResult.success) {
          setErrorMessage(checkoutResult.error.message);
          return;
        }

        // Redirect to Stripe Checkout
        window.location.href = checkoutResult.data.checkoutUrl;
        return;
      }

      // For free plan, use existing registration flow
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          displayName: data.displayName,
          userType: data.userType,
          organizationName: data.organizationName,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setErrorMessage(result.error.message);
        return;
      }

      // Email verification is disabled - redirect to login
      router.push(`/login?registered=true`);
    } catch {
      setErrorMessage("登録に失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">新規登録</CardTitle>
        <CardDescription>
          アカウントを作成して学習を始めましょう
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {errorMessage}
              </div>
            )}

            {/* Account Type Selection */}
            <FormField
              control={form.control}
              name="userType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>アカウントタイプ</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => field.onChange("individual")}
                        className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                          field.value === "individual"
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        {field.value === "individual" && (
                          <span className="absolute top-2 right-2 material-symbols-outlined text-primary text-lg">
                            check_circle
                          </span>
                        )}
                        <span className={`material-symbols-outlined text-2xl mb-2 block ${
                          field.value === "individual" ? "text-primary" : "text-muted-foreground"
                        }`}>
                          person
                        </span>
                        <span className="font-medium block">自分用</span>
                        <span className="text-xs text-muted-foreground">
                          個人で学習
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("admin")}
                        className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                          field.value === "admin"
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        {field.value === "admin" && (
                          <span className="absolute top-2 right-2 material-symbols-outlined text-primary text-lg">
                            check_circle
                          </span>
                        )}
                        <span className={`material-symbols-outlined text-2xl mb-2 block ${
                          field.value === "admin" ? "text-primary" : "text-muted-foreground"
                        }`}>
                          groups
                        </span>
                        <span className="font-medium block">管理者</span>
                        <span className="text-xs text-muted-foreground">
                          組織で利用
                        </span>
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Plan Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">プラン</label>
              <Select
                value={selectedPlan}
                onValueChange={setSelectedPlan}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="プランを選択" />
                </SelectTrigger>
                <SelectContent>
                  {userType === "admin" ? (
                    organizationPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{plan.nameJa}</span>
                          <span className="text-muted-foreground">
                            {formatPrice(plan.priceMonthly)}/月
                          </span>
                          {plan.maxMembers && (
                            <span className="text-xs text-muted-foreground">
                              (最大{plan.maxMembers}名)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    individualPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{plan.nameJa}</span>
                          <span className="text-muted-foreground">
                            {formatPrice(plan.priceMonthly)}/月
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedPlan !== "free" && (
                <p className="text-xs text-muted-foreground">
                  ※登録後にプランの支払い画面に移動します
                </p>
              )}
            </div>

            {userType === "admin" && (
              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>組織名</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="株式会社○○"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                        placeholder="8文字以上、英字と数字を含む"
                        autoComplete="new-password"
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

            <FormField
              control={form.control}
              name="confirmPassword"
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

            <FormField
              control={form.control}
              name="agreeTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                      className="mt-1 shrink-0"
                    />
                  </FormControl>
                  <div className="flex-1">
                    <FormLabel className="text-sm font-normal cursor-pointer leading-relaxed">
                      <Link href="/terms" target="_blank" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>利用規約</Link>
                      {" "}および{" "}
                      <Link href="/privacy" target="_blank" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>プライバシーポリシー</Link>
                      {" "}に同意します
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-6">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  登録中...
                </>
              ) : (
                "アカウントを作成"
              )}
            </Button>

            {userType === "individual" && (
              <>
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

                <GoogleLoginButton callbackUrl="/home" mode="register" />
              </>
            )}

            <div className="flex flex-col gap-2 text-sm text-center">
              <p className="text-muted-foreground">
                既にアカウントをお持ちの方は{" "}
                <Link href="/login" className="text-primary hover:underline">
                  ログイン
                </Link>
              </p>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                料金プランを見る →
              </Link>
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
