"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface OrganizationSettings {
  allowedModes: ("explanation" | "generation" | "brainstorm")[];
  allowedTechStacks: string[];
  unlockSkipAllowed: boolean;
  reflectionRequired: boolean;
  defaultDailyTokenLimit: number;
}

interface SettingsData {
  organizationId: string;
  organizationName: string;
  plan: string;
  settings: OrganizationSettings;
}

const modeLabels: Record<string, { label: string; description: string; icon: string }> = {
  explanation: {
    label: "解説モード",
    description: "コードの解説と理解を深める",
    icon: "school",
  },
  generation: {
    label: "生成モード",
    description: "段階的ヒントでコード生成",
    icon: "code",
  },
  brainstorm: {
    label: "ブレストモード",
    description: "設計とアイデアの議論",
    icon: "lightbulb",
  },
};

export default function OrganizationSettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [organizationName, setOrganizationName] = useState("");
  const [allowedModes, setAllowedModes] = useState<("explanation" | "generation" | "brainstorm")[]>([]);
  const [unlockSkipAllowed, setUnlockSkipAllowed] = useState(false);
  const [reflectionRequired, setReflectionRequired] = useState(false);
  const [defaultDailyTokenLimit, setDefaultDailyTokenLimit] = useState(1000);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/admin/settings");
        const result = await response.json();
        if (result.success) {
          setData(result.data);
          setOrganizationName(result.data.organizationName);
          setAllowedModes(result.data.settings.allowedModes);
          setUnlockSkipAllowed(result.data.settings.unlockSkipAllowed);
          setReflectionRequired(result.data.settings.reflectionRequired);
          setDefaultDailyTokenLimit(result.data.settings.defaultDailyTokenLimit);
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          settings: {
            allowedModes,
            unlockSkipAllowed,
            reflectionRequired,
            defaultDailyTokenLimit,
          },
        }),
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleMode = (mode: "explanation" | "generation" | "brainstorm") => {
    if (allowedModes.includes(mode)) {
      // Don't allow removing the last mode
      if (allowedModes.length > 1) {
        setAllowedModes(allowedModes.filter((m) => m !== mode));
      }
    } else {
      setAllowedModes([...allowedModes, mode]);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">組織設定</h1>
          <p className="text-muted-foreground">組織全体の利用設定を管理します</p>
        </div>
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">組織設定</h1>
          <p className="text-muted-foreground">組織全体の利用設定を管理します</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="text-green-400 text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              保存しました
            </span>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "設定を保存"}
          </Button>
        </div>
      </div>

      {/* Organization Name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">business</span>
            組織情報
          </CardTitle>
          <CardDescription>組織の基本情報を設定します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">組織名</Label>
            <Input
              id="orgName"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="組織名を入力"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="material-symbols-outlined text-lg">workspace_premium</span>
            プラン: <span className="capitalize font-medium">{data?.plan}</span>
          </div>
        </CardContent>
      </Card>

      {/* Allowed Modes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">tune</span>
            利用可能なモード
          </CardTitle>
          <CardDescription>
            メンバーが利用できるモードを制限します。最低1つは有効にしてください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["explanation", "generation", "brainstorm"] as const).map((mode) => {
              const isEnabled = allowedModes.includes(mode);
              const config = modeLabels[mode];
              return (
                <button
                  key={mode}
                  onClick={() => toggleMode(mode)}
                  className={cn(
                    "p-4 rounded-lg border text-left transition-all",
                    isEnabled
                      ? "border-primary bg-primary/10"
                      : "border-border opacity-50 hover:opacity-75"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        "size-10 rounded-lg flex items-center justify-center",
                        isEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span className="material-symbols-outlined">{config.icon}</span>
                    </div>
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <div
                      className={cn(
                        "w-8 h-5 rounded-full transition-colors relative",
                        isEnabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
                          isEnabled ? "translate-x-3.5" : "translate-x-0.5"
                        )}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Learning Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">psychology</span>
            学習設定
          </CardTitle>
          <CardDescription>
            メンバーの学習体験に関する設定を行います
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingToggle
            label="アンロックスキップを許可"
            description="生成モードでヒントをスキップしてコードを表示することを許可します"
            icon="fast_forward"
            enabled={unlockSkipAllowed}
            onChange={setUnlockSkipAllowed}
          />
          <SettingToggle
            label="振り返りを必須にする"
            description="会話終了時に学びの振り返りを必須にします"
            icon="edit_note"
            enabled={reflectionRequired}
            onChange={setReflectionRequired}
          />
        </CardContent>
      </Card>

      {/* Point Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">toll</span>
            ポイント設定
          </CardTitle>
          <CardDescription>
            新規発行キーのデフォルトポイント上限を設定します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tokenLimit">デフォルトの月間ポイント上限</Label>
            <div className="flex items-center gap-4">
              <Input
                id="tokenLimit"
                type="number"
                min={100}
                max={100000}
                value={defaultDailyTokenLimit}
                onChange={(e) => setDefaultDailyTokenLimit(parseInt(e.target.value) || 1000)}
                className="w-32"
              />
              <span className="text-muted-foreground">pt/月</span>
            </div>
            <p className="text-sm text-muted-foreground">
              新しいアクセスキーを発行する際のデフォルト値です。個別のキーで上書きできます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[500, 1000, 2000, 5000, 10000].map((limit) => (
              <button
                key={limit}
                onClick={() => setDefaultDailyTokenLimit(limit)}
                className={cn(
                  "px-3 py-1 rounded-lg border text-sm transition-colors",
                  defaultDailyTokenLimit === limit
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                {limit.toLocaleString()}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  icon,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
          <span className="material-symbols-outlined text-muted-foreground">{icon}</span>
        </div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div
        className={cn(
          "w-10 h-6 rounded-full transition-colors relative shrink-0",
          enabled ? "bg-primary" : "bg-muted"
        )}
      >
        <div
          className={cn(
            "absolute top-1 size-4 rounded-full bg-white transition-transform",
            enabled ? "translate-x-5" : "translate-x-1"
          )}
        />
      </div>
    </button>
  );
}
