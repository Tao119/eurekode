"use client";

import { useState, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
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
});

type JoinFormData = z.infer<typeof joinSchema>;

export default function JoinPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      keySegments: ["", "", "", ""],
      displayName: "",
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
        redirect: false,
      });

      if (result?.error) {
        switch (result.error) {
          case "INVALID_KEY":
            setErrorMessage("無効なアクセスキーです");
            break;
          case "KEY_EXPIRED":
            setErrorMessage("このアクセスキーは有効期限が切れています");
            break;
          case "KEY_ALREADY_USED":
            setErrorMessage("このアクセスキーは既に使用されています");
            break;
          default:
            setErrorMessage("参加に失敗しました。もう一度お試しください。");
        }
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("参加に失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">キー入力</CardTitle>
        <CardDescription>
          管理者から発行されたアクセスキーを入力してください
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
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
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  参加中...
                </>
              ) : (
                "参加する"
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

            <div className="flex flex-col gap-2 w-full text-sm text-center">
              <p className="text-muted-foreground">
                アカウントをお持ちの方は{" "}
                <Link href="/login" className="text-primary hover:underline">
                  ログイン
                </Link>
              </p>
              <p className="text-muted-foreground">
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
