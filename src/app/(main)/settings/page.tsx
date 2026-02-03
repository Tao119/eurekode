"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUserSettings } from "@/contexts/UserSettingsContext";
import type { UserSettings } from "@/types/user";

type LearningSettingKey = "quizEnabled" | "estimationTraining" | "unlockSkipAllowed";
type HintSpeedValue = UserSettings["hintSpeed"];

interface OrganizationInfo {
  userType: string;
  organization: {
    id: string;
    name: string;
    plan: string;
  } | null;
  accessKey: {
    keyCode: string;
    dailyTokenLimit: number;
    expiresAt: string | null;
  } | null;
}

export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const { settings, isLoading: isLoadingSettings, updateSettings } = useUserSettings();
  const [displayName, setDisplayName] = useState(session?.user.displayName || "");
  const [isLoading, setIsLoading] = useState(false);

  // Organization management state
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [accessKeyInput, setAccessKeyInput] = useState(["", "", "", ""]);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Token usage state
  const [todayTokenUsage, setTodayTokenUsage] = useState(0);
  const [isLoadingTokenUsage, setIsLoadingTokenUsage] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/settings");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user.displayName) {
      setDisplayName(session.user.displayName);
    }
  }, [session?.user.displayName]);

  // Fetch organization info
  const fetchOrgInfo = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoadingOrg(true);
    try {
      const response = await fetch("/api/user/organization");
      const data = await response.json();
      if (data.success) {
        setOrgInfo(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch organization info:", error);
    } finally {
      setIsLoadingOrg(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchOrgInfo();
  }, [fetchOrgInfo]);

  // Fetch token usage
  const fetchTokenUsage = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoadingTokenUsage(true);
    try {
      const response = await fetch("/api/user/settings");
      const data = await response.json();
      if (data.success && data.data.tokenUsage !== undefined) {
        setTodayTokenUsage(data.data.tokenUsage);
      }
    } catch (error) {
      console.error("Failed to fetch token usage:", error);
    } finally {
      setIsLoadingTokenUsage(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchTokenUsage();
  }, [fetchTokenUsage]);

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement save API for display name
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("設定を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingToggle = async (key: LearningSettingKey, value: boolean) => {
    try {
      await updateSettings({ [key]: value });
      toast.success("設定を更新しました");
    } catch {
      toast.error("設定の更新に失敗しました");
    }
  };

  const handleHintSpeedChange = async (value: HintSpeedValue) => {
    try {
      await updateSettings({ hintSpeed: value });
      toast.success("設定を更新しました");
    } catch {
      toast.error("設定の更新に失敗しました");
    }
  };

  // Access key input handlers
  const handleAccessKeyChange = (index: number, value: string) => {
    // Only allow alphanumeric characters
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    const newKeys = [...accessKeyInput];
    newKeys[index] = sanitized;
    setAccessKeyInput(newKeys);

    // Auto-focus next input when current is filled
    if (sanitized.length === 5 && index < 3) {
      const nextInput = document.getElementById(`key-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleAccessKeyPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").toUpperCase();
    const parts = pastedText.split("-");

    if (parts.length === 4) {
      setAccessKeyInput(parts.map(p => p.slice(0, 5)));
    } else {
      // Try to split by length
      const cleaned = pastedText.replace(/[^A-Z0-9]/g, "");
      if (cleaned.length >= 20) {
        setAccessKeyInput([
          cleaned.slice(0, 5),
          cleaned.slice(5, 10),
          cleaned.slice(10, 15),
          cleaned.slice(15, 20),
        ]);
      }
    }
  };

  const handleJoinOrganization = async () => {
    const keyCode = accessKeyInput.join("-");
    if (keyCode.length !== 23) {
      toast.error("アクセスキーを正しく入力してください");
      return;
    }

    setIsJoining(true);
    try {
      const response = await fetch("/api/user/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyCode }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.data.message);
        setShowJoinDialog(false);
        setAccessKeyInput(["", "", "", ""]);
        // Refresh session and org info
        await updateSession();
        await fetchOrgInfo();
      } else {
        toast.error(data.error.message);
      }
    } catch {
      toast.error("組織への参加に失敗しました");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveOrganization = async () => {
    setIsLeaving(true);
    try {
      const response = await fetch("/api/user/organization", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.data.message);
        setShowLeaveDialog(false);
        // Refresh session and org info
        await updateSession();
        await fetchOrgInfo();
      } else {
        toast.error(data.error.message);
      }
    } catch {
      toast.error("組織からの退出に失敗しました");
    } finally {
      setIsLeaving(false);
    }
  };

  const isIndividual = session?.user.userType === "individual";
  const isMember = session?.user.userType === "member";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-muted-foreground">アカウント設定を管理します</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">person</span>
            プロフィール
          </CardTitle>
          <CardDescription>
            表示名やアカウント情報を変更できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="displayName">表示名</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名を入力"
            />
          </div>

          {session?.user.email && (
            <div className="space-y-2">
              <Label>メールアドレス</Label>
              <Input value={session.user.email} disabled />
              <p className="text-xs text-muted-foreground">
                メールアドレスは変更できません
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>アカウントタイプ</Label>
            <Input
              value={
                session?.user.userType === "admin"
                  ? "管理者"
                  : session?.user.userType === "member"
                  ? "メンバー"
                  : "個人"
              }
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label>プラン</Label>
            <Input value={session?.user.plan || "free"} disabled className="capitalize" />
          </div>

          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "保存中..." : "保存"}
          </Button>
        </CardContent>
      </Card>

      {/* Organization Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">groups</span>
            組織設定
          </CardTitle>
          <CardDescription>
            組織への参加・退出を管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingOrg ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="sm" />
            </div>
          ) : isIndividual ? (
            // Individual user - show option to join organization
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">個人利用</p>
                  <p className="text-sm text-muted-foreground">
                    現在、個人としてEurekodeを利用しています
                  </p>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mt-0.5">
                    <span className="material-symbols-outlined">vpn_key</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">組織に参加する</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      アクセスキーをお持ちの場合、組織に参加できます。
                      組織のトークン上限や設定が適用されます。
                    </p>
                    <Button onClick={() => setShowJoinDialog(true)} variant="outline">
                      <span className="material-symbols-outlined mr-2 text-lg">add</span>
                      アクセスキーで参加
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : isMember ? (
            // Member user - show organization info and option to leave
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">groups</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{orgInfo?.organization?.name || "組織"}</p>
                  <p className="text-sm text-muted-foreground">
                    {orgInfo?.organization?.plan === "school" && "スクールプラン"}
                    {orgInfo?.organization?.plan === "team" && "チームプラン"}
                    {orgInfo?.organization?.plan === "enterprise" && "エンタープライズプラン"}
                    {!orgInfo?.organization?.plan && "組織プラン"}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                  参加中
                </span>
              </div>

              {orgInfo?.accessKey && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">アクセスキー</p>
                    <p className="font-mono">{orgInfo.accessKey.keyCode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">1日のトークン上限</p>
                    <p className="font-medium">{orgInfo.accessKey.dailyTokenLimit.toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive mt-0.5">
                    <span className="material-symbols-outlined">logout</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">組織から退出する</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      {session?.user.email
                        ? "個人利用に切り替えます。組織のトークン上限は適用されなくなります。"
                        : "メールアドレスが登録されていないため、退出できません。"}
                    </p>
                    <Button
                      onClick={() => setShowLeaveDialog(true)}
                      variant="outline"
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                      disabled={!session?.user.email}
                    >
                      <span className="material-symbols-outlined mr-2 text-lg">exit_to_app</span>
                      組織から退出
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Admin user - show info only
            <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
              <div className="size-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-orange-500">admin_panel_settings</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">{orgInfo?.organization?.name || "組織"} - 管理者</p>
                <p className="text-sm text-muted-foreground">
                  組織の管理者として設定されています
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Learning Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">school</span>
            学習設定
          </CardTitle>
          <CardDescription>
            学習モードの動作をカスタマイズできます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingSettings ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <>
              <SettingToggle
                icon="quiz"
                title="確認クイズ"
                description="解説モードで理解度を確認するクイズを表示"
                enabled={settings.quizEnabled}
                onChange={(value) => handleSettingToggle("quizEnabled", value)}
              />
              <SettingSelect
                icon="psychology"
                title="段階的ヒント"
                description="生成モードでヒントを表示するタイミング"
                value={settings.hintSpeed}
                options={[
                  { value: "immediate", label: "即座に表示" },
                  { value: "30sec", label: "30秒後に表示" },
                  { value: "none", label: "表示しない" },
                ]}
                onChange={(value) => handleHintSpeedChange(value as HintSpeedValue)}
              />
              <SettingToggle
                icon="timer"
                title="時間見積もりトレーニング"
                description="実装時間の見積もり練習を有効化"
                enabled={settings.estimationTraining}
                onChange={(value) => handleSettingToggle("estimationTraining", value)}
              />
              {/* Show unlock skip setting only for individual users */}
              {isIndividual && (
                <SettingToggle
                  icon="fast_forward"
                  title="制限解除モード"
                  description="生成モードでヒントをスキップしてコードを直接表示できるようにします"
                  enabled={settings.unlockSkipAllowed}
                  onChange={(value) => handleSettingToggle("unlockSkipAllowed", value)}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Token Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">toll</span>
            トークン使用量
          </CardTitle>
          <CardDescription>今日のトークン使用状況</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTokenUsage ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">使用量</span>
                <span className="font-bold">
                  {todayTokenUsage.toLocaleString()} / {session?.user.dailyTokenLimit?.toLocaleString() || "1,000"}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${Math.min((todayTokenUsage / (session?.user.dailyTokenLimit || 1000)) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                毎日0時にリセットされます
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <span className="material-symbols-outlined">warning</span>
            危険な操作
          </CardTitle>
          <CardDescription>
            これらの操作は取り消すことができません
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">会話履歴を削除</p>
              <p className="text-sm text-muted-foreground">
                すべての会話履歴を削除します
              </p>
            </div>
            <Button variant="outline" className="border-destructive text-destructive">
              削除
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">アカウントを削除</p>
              <p className="text-sm text-muted-foreground">
                アカウントとすべてのデータを完全に削除します
              </p>
            </div>
            <Button variant="destructive">削除</Button>
          </div>
        </CardContent>
      </Card>

      {/* Join Organization Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>組織に参加</DialogTitle>
            <DialogDescription>
              組織から発行されたアクセスキーを入力してください
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label className="mb-3 block">アクセスキー</Label>
            <div className="flex gap-2 items-center justify-center">
              {accessKeyInput.map((value, index) => (
                <div key={index} className="flex items-center">
                  <Input
                    id={`key-${index}`}
                    value={value}
                    onChange={(e) => handleAccessKeyChange(index, e.target.value)}
                    onPaste={index === 0 ? handleAccessKeyPaste : undefined}
                    placeholder="XXXXX"
                    className="w-20 text-center font-mono tracking-wider uppercase"
                    maxLength={5}
                  />
                  {index < 3 && <span className="mx-1 text-muted-foreground">-</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              例: AB1C2-DE3F4-GH5I6-JK7L8
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleJoinOrganization} disabled={isJoining}>
              {isJoining ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  参加中...
                </>
              ) : (
                "参加する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Organization Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>組織から退出しますか？</DialogTitle>
            <DialogDescription>
              組織から退出すると、以下の変更が適用されます：
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg mt-0.5">check</span>
              <p className="text-sm">個人アカウントに切り替わります</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg mt-0.5">check</span>
              <p className="text-sm">組織のトークン上限が適用されなくなります</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg mt-0.5">check</span>
              <p className="text-sm">アクセスキーは無効化されます</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-orange-500 text-lg mt-0.5">info</span>
              <p className="text-sm text-muted-foreground">
                学習履歴やインサイトは保持されます
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleLeaveOrganization} disabled={isLeaving}>
              {isLeaving ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  退出中...
                </>
              ) : (
                "退出する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingToggle({
  icon,
  title,
  description,
  enabled,
  onChange,
}: {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground mt-0.5">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SettingSelect({
  icon,
  title,
  description,
  value,
  options,
  onChange,
}: {
  icon: string;
  title: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground mt-0.5">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
