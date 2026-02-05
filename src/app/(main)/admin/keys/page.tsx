"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { isAuthError, handleAuthError } from "@/lib/auth-error-handler";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/useCredits";
import { MODE_CONFIG } from "@/config/modes";
import type { ChatMode } from "@/types/chat";

interface AccessKeySettings {
  allowedModes?: ("explanation" | "generation" | "brainstorm")[];
  allowedTechStacks?: string[];
  unlockSkipAllowed?: boolean;
}

interface AccessKey {
  id: string;
  keyCode: string;
  status: "active" | "used" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  dailyTokenLimit: number;
  settings: AccessKeySettings | null;
  user: {
    id: string;
    displayName: string;
    email: string | null;
  } | null;
}

interface OrganizationPlanInfo {
  plan: string;
  name: string;
  maxCreditsPerMember: number;
  maxMembers: number | null;
}

interface CreditAllocation {
  total: number;
  allocated: number;
  remaining: number;
}

interface KeysResponse {
  keys: AccessKey[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  summary: {
    active: number;
    used: number;
    expired: number;
    revoked: number;
  };
  organizationPlan: OrganizationPlanInfo | null;
  creditAllocation: CreditAllocation | null;
}

const statusLabels: Record<AccessKey["status"], { label: string; color: string }> = {
  active: { label: "未使用", color: "bg-green-500/20 text-green-400" },
  used: { label: "使用中", color: "bg-blue-500/20 text-blue-400" },
  expired: { label: "期限切れ", color: "bg-yellow-500/20 text-yellow-400" },
  revoked: { label: "無効", color: "bg-red-500/20 text-red-400" },
};

export default function AccessKeysPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<KeysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdKeys, setCreatedKeys] = useState<string[]>([]);
  const [showCreatedDialog, setShowCreatedDialog] = useState(false);

  // Admin's own credit info
  const adminCredits = useCredits();

  // Form state for creating keys
  const [keyCount, setKeyCount] = useState(1);
  const [creditLimit, setCreditLimit] = useState(100);
  const [expiresIn, setExpiresIn] = useState<"1week" | "1month" | "3months" | "never">("1month");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<AccessKey | null>(null);
  const [editCreditLimit, setEditCreditLimit] = useState(100);
  const [editExpiresAt, setEditExpiresAt] = useState<string>("");
  const [editUnlockSkipAllowed, setEditUnlockSkipAllowed] = useState(false);
  const [editAllowedModes, setEditAllowedModes] = useState<ChatMode[]>(["explanation", "generation", "brainstorm"]);
  const [updating, setUpdating] = useState(false);

  // Re-issue state
  const [reissuing, setReissuing] = useState<string | null>(null);

  // Admin self-allocation state
  const [editingAdminAllocation, setEditingAdminAllocation] = useState(false);
  const [adminAllocationInput, setAdminAllocationInput] = useState(0);
  const [savingAdminAllocation, setSavingAdminAllocation] = useState(false);

  // Credit allocation info
  const creditAllocation = data?.creditAllocation;
  const maxCreditsPerMember = data?.organizationPlan?.maxCreditsPerMember || 10000;
  const remainingAllocatable = creditAllocation?.remaining ?? maxCreditsPerMember;

  const fetchKeys = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");

      const response = await fetch(`/api/admin/keys?${params.toString()}`);

      // Check for auth error
      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch keys:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Update default credit limit when plan info is loaded
  useEffect(() => {
    if (data?.organizationPlan?.maxCreditsPerMember) {
      const defaultCredit = Math.min(100, data.organizationPlan.maxCreditsPerMember);
      setCreditLimit(defaultCredit);
    }
  }, [data?.organizationPlan?.maxCreditsPerMember]);

  const handleGenerateKeys = async () => {
    // Validate credit limit (min 1)
    if (creditLimit < 1) {
      alert("クレジット上限は1以上を設定してください");
      return;
    }

    // Check if total requested credits exceed remaining allocatable
    const totalRequestedCredits = creditLimit * keyCount;
    if (totalRequestedCredits > remainingAllocatable) {
      alert(`クレジット上限を超えています。\n割り当て可能な残りクレジット: ${remainingAllocatable.toLocaleString()}pt\n要求したクレジット: ${totalRequestedCredits.toLocaleString()}pt`);
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: keyCount,
          dailyTokenLimit: creditLimit,
          expiresIn,
        }),
      });

      // Check for auth error
      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }

      const result = await response.json();
      if (result.success) {
        setCreatedKeys(result.data.keys.map((k: { keyCode: string }) => k.keyCode));
        setCreateDialogOpen(false);
        setShowCreatedDialog(true);
        fetchKeys();
      } else {
        // Handle credit limit exceeded error
        if (result.error?.code === "CREDIT_LIMIT_EXCEEDED") {
          alert(result.error.message);
        } else {
          console.error("Failed to create keys:", result.error);
          alert(result.error?.message || "キーの発行に失敗しました");
        }
      }
    } catch (error) {
      console.error("Failed to create keys:", error);
      alert("キーの発行に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("このキーを無効化しますか？")) return;

    try {
      const response = await fetch(`/api/admin/keys/${keyId}`, {
        method: "DELETE",
      });

      // Check for auth error
      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }

      const result = await response.json();
      if (result.success) {
        fetchKeys();
      }
    } catch (error) {
      console.error("Failed to revoke key:", error);
    }
  };

  const handleReissueKey = async (keyId: string) => {
    if (!confirm("このキーを再発行しますか？\n\n既存のユーザーは新しいメールアドレスとパスワードで再登録する必要があります。")) return;

    setReissuing(keyId);
    try {
      const response = await fetch(`/api/admin/keys/${keyId}`, {
        method: "POST",
      });

      // Check for auth error
      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }

      const result = await response.json();
      if (result.success) {
        fetchKeys();
        alert("キーを再発行しました。新しいメールアドレスとパスワードで登録できます。");
      } else {
        alert(result.error?.message || "再発行に失敗しました");
      }
    } catch (error) {
      console.error("Failed to reissue key:", error);
      alert("再発行に失敗しました");
    } finally {
      setReissuing(null);
    }
  };

  const handleSaveAdminAllocation = async () => {
    if (adminAllocationInput < 0) {
      alert("割り当てポイントは0以上を設定してください");
      return;
    }

    // 管理者の割り当て変更分を含めた上限チェック
    const currentAdminAllocation = adminCredits.allocated?.total ?? 0;
    const delta = adminAllocationInput - currentAdminAllocation;
    if (delta > 0 && delta > remainingAllocatable) {
      alert(`クレジット上限を超えています。\n追加割り当て可能: ${remainingAllocatable.toLocaleString()}pt`);
      return;
    }

    setSavingAdminAllocation(true);
    try {
      const response = await fetch("/api/billing/credits/allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: session?.user?.id,
          points: adminAllocationInput,
          note: "管理者自己割り当て",
        }),
      });

      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }

      const result = await response.json();
      if (result.allocation) {
        setEditingAdminAllocation(false);
        // Refresh both admin credits and keys data
        adminCredits.refresh();
        fetchKeys();
      } else {
        alert(result.error || "割り当ての保存に失敗しました");
      }
    } catch (error) {
      console.error("Failed to save admin allocation:", error);
      alert("割り当ての保存に失敗しました");
    } finally {
      setSavingAdminAllocation(false);
    }
  };

  const openEditDialog = (key: AccessKey) => {
    setEditingKey(key);
    setEditCreditLimit(key.dailyTokenLimit);
    setEditExpiresAt(key.expiresAt ? key.expiresAt.split("T")[0] : "");
    setEditUnlockSkipAllowed(key.settings?.unlockSkipAllowed ?? false);
    setEditAllowedModes(key.settings?.allowedModes ?? ["explanation", "generation", "brainstorm"]);
    setEditDialogOpen(true);
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;

    // Validate credit limit (min 1)
    if (editCreditLimit < 1) {
      alert("クレジット上限は1以上を設定してください");
      return;
    }

    // Calculate max allowed for this key (remaining + current key's value)
    const currentKeyCredits = editingKey.dailyTokenLimit;
    const maxForThisKey = remainingAllocatable + currentKeyCredits;
    if (editCreditLimit > maxForThisKey) {
      alert(`クレジット上限を超えています。\nこのキーに割り当て可能な上限: ${maxForThisKey.toLocaleString()}pt`);
      return;
    }

    setUpdating(true);
    try {
      const requestBody = {
        dailyTokenLimit: editCreditLimit,
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        settings: {
          unlockSkipAllowed: editUnlockSkipAllowed,
          allowedModes: editAllowedModes,
        },
      };

      const response = await fetch(`/api/admin/keys/${editingKey.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Check for auth error
      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }

      const result = await response.json();
      if (result.success) {
        setEditDialogOpen(false);
        setEditingKey(null);
        fetchKeys();
      } else {
        // Handle credit limit exceeded error
        if (result.error?.code === "CREDIT_LIMIT_EXCEEDED") {
          alert(result.error.message);
        } else {
          console.error("Failed to update key:", result.error);
          if (result.error?.details) {
            console.error("Validation details:", JSON.stringify(result.error.details, null, 2));
          }
          alert(result.error?.message || "更新に失敗しました");
        }
      }
    } catch (error) {
      console.error("Failed to update key:", error);
      alert("更新に失敗しました");
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyAllKeys = () => {
    navigator.clipboard.writeText(createdKeys.join("\n"));
  };

  const filteredKeys = data?.keys || [];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">クレジット管理</h1>
            <p className="text-muted-foreground">
              メンバー用のアクセスキーとクレジットを管理します
            </p>
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">クレジット管理</h1>
          <p className="text-muted-foreground">
            メンバー用のアクセスキーとクレジットを管理します
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 cursor-pointer">
          <span className="material-symbols-outlined text-xl">add</span>
          新しいキーを発行
        </Button>
      </div>

      {/* Organization Credit Allocation */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            組織クレジット割り振り状況
          </CardTitle>
          {data?.organizationPlan && (
            <CardDescription>
              プラン: {data.organizationPlan.name} / メンバー上限: {data.organizationPlan.maxMembers || "無制限"}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress bar */}
            {creditAllocation && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">割り当て済み</span>
                  <span className="font-medium">
                    {creditAllocation.allocated.toLocaleString()} / {creditAllocation.total.toLocaleString()} pt
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min((creditAllocation.allocated / creditAllocation.total) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>割り当て可能残り: <span className="text-primary font-medium">{creditAllocation.remaining.toLocaleString()}pt</span></span>
                  <span>{((creditAllocation.allocated / creditAllocation.total) * 100).toFixed(1)}% 使用</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin's Own Credits (like a member) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">shield_person</span>
            管理者（自分）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adminCredits.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : editingAdminAllocation ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="adminAllocation">割り当てポイント</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="adminAllocation"
                    type="number"
                    min={0}
                    max={(adminCredits.allocated?.total ?? 0) + remainingAllocatable}
                    value={adminAllocationInput}
                    onChange={(e) => {
                      const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                      setAdminAllocationInput(isNaN(value) ? 0 : value);
                    }}
                    className="max-w-[200px]"
                  />
                  <span className="text-sm text-muted-foreground">pt</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  割り当て可能な残り: <span className="font-medium text-primary">{((adminCredits.allocated?.total ?? 0) + remainingAllocatable).toLocaleString()}pt</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveAdminAllocation}
                  disabled={savingAdminAllocation}
                  className="cursor-pointer"
                >
                  {savingAdminAllocation ? "保存中..." : "保存"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingAdminAllocation(false)}
                  disabled={savingAdminAllocation}
                  className="cursor-pointer"
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {adminCredits.totalRemaining.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground ml-1">pt</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sonnet: 約{adminCredits.remainingConversations.sonnet}回 / Opus: 約{adminCredits.remainingConversations.opus}回
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                  管理者
                </span>
                <span className="text-xs text-muted-foreground">
                  上限: {(adminCredits.allocated?.total ?? 0).toLocaleString()}pt
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdminAllocationInput(adminCredits.allocated?.total ?? 0);
                    setEditingAdminAllocation(true);
                  }}
                  title="割り当てを編集"
                  className="cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => setStatusFilter("")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors cursor-pointer",
              statusFilter === "" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
            )}
          >
            <p className="text-2xl font-bold">
              {data.summary.active + data.summary.used + data.summary.expired + data.summary.revoked}
            </p>
            <p className="text-sm text-muted-foreground">総数</p>
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors cursor-pointer",
              statusFilter === "active" ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/50"
            )}
          >
            <p className="text-2xl font-bold text-green-400">{data.summary.active}</p>
            <p className="text-sm text-muted-foreground">未使用</p>
          </button>
          <button
            onClick={() => setStatusFilter("used")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors cursor-pointer",
              statusFilter === "used" ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50"
            )}
          >
            <p className="text-2xl font-bold text-blue-400">{data.summary.used}</p>
            <p className="text-sm text-muted-foreground">使用中</p>
          </button>
          <button
            onClick={() => setStatusFilter("revoked")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors cursor-pointer",
              statusFilter === "revoked" ? "border-red-500 bg-red-500/10" : "border-border hover:border-red-500/50"
            )}
          >
            <p className="text-2xl font-bold text-red-400">{data.summary.revoked}</p>
            <p className="text-sm text-muted-foreground">無効</p>
          </button>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              search
            </span>
            <Input
              type="text"
              placeholder="キーコード、ユーザー名、またはメールで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>発行済みキー</CardTitle>
          <CardDescription>
            {filteredKeys.length}件のキーが見つかりました
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile: Card Layout */}
          <div className="sm:hidden space-y-3">
            {filteredKeys.map((key) => {
              const status = statusLabels[key.status];
              return (
                <div key={key.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded truncate">
                        {key.keyCode}
                      </code>
                      <button
                        onClick={() => copyToClipboard(key.keyCode)}
                        className="p-1 hover:bg-muted rounded transition-colors cursor-pointer shrink-0"
                        title="コピー"
                      >
                        <span className="material-symbols-outlined text-sm text-muted-foreground">
                          content_copy
                        </span>
                      </button>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                        status.color
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">使用者</span>
                      <p className="font-medium truncate">
                        {key.user ? key.user.displayName : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">ポイント上限</span>
                      <p className="font-medium">{key.dailyTokenLimit.toLocaleString()}pt</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">有効期限</span>
                      <p className="font-medium">
                        {key.expiresAt
                          ? new Date(key.expiresAt).toLocaleDateString("ja-JP")
                          : "無期限"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-1 border-t">
                    {key.status !== "revoked" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(key)}
                          title="編集"
                          className="cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive cursor-pointer"
                          onClick={() => handleRevokeKey(key.id)}
                          title="無効化"
                        >
                          <span className="material-symbols-outlined text-lg">block</span>
                        </Button>
                      </>
                    )}
                    {(key.status === "used" || key.status === "revoked") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-500 hover:text-amber-400 cursor-pointer"
                        onClick={() => handleReissueKey(key.id)}
                        disabled={reissuing === key.id}
                        title="再発行"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {reissuing === key.id ? "hourglass_empty" : "refresh"}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredKeys.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                キーが見つかりません
              </p>
            )}
          </div>

          {/* Desktop: Table Layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    キーコード
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    ステータス
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    使用者
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    ポイント上限
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    有効期限
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((key) => {
                  const status = statusLabels[key.status];
                  return (
                    <tr key={key.id} className="border-b border-border last:border-0">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                            {key.keyCode}
                          </code>
                          <button
                            onClick={() => copyToClipboard(key.keyCode)}
                            className="p-1 hover:bg-muted rounded transition-colors cursor-pointer"
                            title="コピー"
                          >
                            <span className="material-symbols-outlined text-sm text-muted-foreground">
                              content_copy
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            status.color
                          )}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {key.user ? (
                          <div>
                            <p className="font-medium">{key.user.displayName}</p>
                            {key.user.email && (
                              <p className="text-xs text-muted-foreground">{key.user.email}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {key.dailyTokenLimit.toLocaleString()}pt
                      </td>
                      <td className="py-3 px-4">
                        {key.expiresAt ? (
                          new Date(key.expiresAt).toLocaleDateString("ja-JP")
                        ) : (
                          <span className="text-muted-foreground">無期限</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {key.status !== "revoked" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(key)}
                                title="編集"
                                className="cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  edit
                                </span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive cursor-pointer"
                                onClick={() => handleRevokeKey(key.id)}
                                title="無効化"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  block
                                </span>
                              </Button>
                            </>
                          )}
                          {(key.status === "used" || key.status === "revoked") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-500 hover:text-amber-400 cursor-pointer"
                              onClick={() => handleReissueKey(key.id)}
                              disabled={reissuing === key.id}
                              title="再発行"
                            >
                              <span className="material-symbols-outlined text-lg">
                                {reissuing === key.id ? "hourglass_empty" : "refresh"}
                              </span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredKeys.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      キーが見つかりません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいアクセスキーを発行</DialogTitle>
            <DialogDescription>
              メンバーに配布するアクセスキーを発行します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyCount">発行数</Label>
              <Input
                id="keyCount"
                type="number"
                min={1}
                max={100}
                value={keyCount}
                onChange={(e) => setKeyCount(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditLimit">月間ポイント上限</Label>
              <Input
                id="creditLimit"
                type="number"
                min={0}
                max={remainingAllocatable}
                value={creditLimit}
                onChange={(e) => {
                  const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                  setCreditLimit(isNaN(value) ? 0 : value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                割り当て可能な残り: <span className="font-medium text-primary">{remainingAllocatable.toLocaleString()}pt</span>
                {creditAllocation && (
                  <> / 組織上限: {creditAllocation.total.toLocaleString()}pt（割り当て済み: {creditAllocation.allocated.toLocaleString()}pt）</>
                )}
              </p>
              {creditLimit < 1 && (
                <p className="text-xs text-amber-500">※ 1以上の値を設定してください</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>有効期限</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "1week", label: "1週間" },
                  { value: "1month", label: "1ヶ月" },
                  { value: "3months", label: "3ヶ月" },
                  { value: "never", label: "無期限" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setExpiresIn(option.value as typeof expiresIn)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm transition-colors cursor-pointer",
                      expiresIn === option.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
              className="cursor-pointer"
            >
              キャンセル
            </Button>
            <Button onClick={handleGenerateKeys} disabled={creating} className="cursor-pointer">
              {creating ? "発行中..." : `${keyCount}件のキーを発行`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created Keys Dialog */}
      <Dialog open={showCreatedDialog} onOpenChange={setShowCreatedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>キーを発行しました</DialogTitle>
            <DialogDescription>
              以下のキーをメンバーに配布してください
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-64 overflow-y-auto">
            {createdKeys.map((keyCode, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-muted rounded-lg"
              >
                <code className="font-mono text-sm">{keyCode}</code>
                <button
                  onClick={() => copyToClipboard(keyCode)}
                  className="p-1 hover:bg-background rounded transition-colors cursor-pointer"
                  title="コピー"
                >
                  <span className="material-symbols-outlined text-sm">
                    content_copy
                  </span>
                </button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyAllKeys} className="cursor-pointer">
              すべてコピー
            </Button>
            <Button onClick={() => setShowCreatedDialog(false)} className="cursor-pointer">閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Key Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アクセスキーを編集</DialogTitle>
            <DialogDescription>
              {editingKey && (
                <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                  {editingKey.keyCode}
                </code>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingKey?.user && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">使用者</p>
                <p className="font-medium">{editingKey.user.displayName}</p>
                {editingKey.user.email && (
                  <p className="text-sm text-muted-foreground">{editingKey.user.email}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="editCreditLimit">月間ポイント上限</Label>
              <Input
                id="editCreditLimit"
                type="number"
                min={0}
                value={editCreditLimit}
                onChange={(e) => {
                  const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                  setEditCreditLimit(isNaN(value) ? 0 : value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                割り当て可能な上限: <span className="font-medium text-primary">{(remainingAllocatable + (editingKey?.dailyTokenLimit || 0)).toLocaleString()}pt</span>
                {creditAllocation && (
                  <> / 組織上限: {creditAllocation.total.toLocaleString()}pt</>
                )}
              </p>
              {editCreditLimit < 1 && (
                <p className="text-xs text-amber-500">※ 1以上の値を設定してください</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editExpiresAt">有効期限</Label>
              <Input
                id="editExpiresAt"
                type="date"
                value={editExpiresAt}
                onChange={(e) => setEditExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                空欄にすると無期限になります
              </p>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">利用可能なモード</Label>
              <p className="text-xs text-muted-foreground">
                このキーで利用できる学習モードを選択します
              </p>
              <div className="flex flex-wrap gap-2">
                {(["explanation", "generation", "brainstorm"] as const).map((mode) => {
                  const modeConfig = MODE_CONFIG[mode];
                  const isActive = editAllowedModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          if (editAllowedModes.length > 1) {
                            setEditAllowedModes(editAllowedModes.filter((m) => m !== mode));
                          }
                        } else {
                          setEditAllowedModes([...editAllowedModes, mode]);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors cursor-pointer",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <span className="material-symbols-outlined text-base">{modeConfig.icon}</span>
                      {modeConfig.title}
                    </button>
                  );
                })}
              </div>
              {editAllowedModes.length === 1 && (
                <p className="text-xs text-amber-500">※ 少なくとも1つのモードが必要です</p>
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <Label className="font-medium">制限解除モード</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  生成モードでヒントをスキップしてコードを直接表示できるようにします
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={editUnlockSkipAllowed}
                onClick={() => setEditUnlockSkipAllowed(!editUnlockSkipAllowed)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors shrink-0 ml-3 cursor-pointer",
                  editUnlockSkipAllowed ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                    editUnlockSkipAllowed ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={updating}
              className="cursor-pointer"
            >
              キャンセル
            </Button>
            <Button onClick={handleUpdateKey} disabled={updating} className="cursor-pointer">
              {updating ? "更新中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
