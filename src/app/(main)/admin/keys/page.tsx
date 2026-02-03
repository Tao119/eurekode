"use client";

import { useEffect, useState, useCallback } from "react";
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
  } | null;
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
}

const statusLabels: Record<AccessKey["status"], { label: string; color: string }> = {
  active: { label: "未使用", color: "bg-green-500/20 text-green-400" },
  used: { label: "使用中", color: "bg-blue-500/20 text-blue-400" },
  expired: { label: "期限切れ", color: "bg-yellow-500/20 text-yellow-400" },
  revoked: { label: "無効", color: "bg-red-500/20 text-red-400" },
};

export default function AccessKeysPage() {
  const [data, setData] = useState<KeysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdKeys, setCreatedKeys] = useState<string[]>([]);
  const [showCreatedDialog, setShowCreatedDialog] = useState(false);

  // Form state for creating keys
  const [keyCount, setKeyCount] = useState(1);
  const [dailyTokenLimit, setDailyTokenLimit] = useState(1000);
  const [expiresIn, setExpiresIn] = useState<"1week" | "1month" | "3months" | "never">("1month");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<AccessKey | null>(null);
  const [editDailyTokenLimit, setEditDailyTokenLimit] = useState(1000);
  const [editExpiresAt, setEditExpiresAt] = useState<string>("");
  const [editUnlockSkipAllowed, setEditUnlockSkipAllowed] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Re-issue state
  const [reissuing, setReissuing] = useState<string | null>(null);

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

  const handleGenerateKeys = async () => {
    setCreating(true);
    try {
      const response = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: keyCount,
          dailyTokenLimit,
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
        console.error("Failed to create keys:", result.error);
      }
    } catch (error) {
      console.error("Failed to create keys:", error);
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

  const openEditDialog = (key: AccessKey) => {
    setEditingKey(key);
    setEditDailyTokenLimit(key.dailyTokenLimit);
    setEditExpiresAt(key.expiresAt ? key.expiresAt.split("T")[0] : "");
    setEditUnlockSkipAllowed(key.settings?.unlockSkipAllowed ?? false);
    setEditDialogOpen(true);
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;

    setUpdating(true);
    try {
      const requestBody = {
        dailyTokenLimit: editDailyTokenLimit,
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        settings: {
          unlockSkipAllowed: editUnlockSkipAllowed,
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
        console.error("Failed to update key:", result.error);
        // Show detailed validation errors
        if (result.error?.details) {
          console.error("Validation details:", JSON.stringify(result.error.details, null, 2));
        }
      }
    } catch (error) {
      console.error("Failed to update key:", error);
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
            <h1 className="text-2xl font-bold">アクセスキー管理</h1>
            <p className="text-muted-foreground">
              メンバー用のアクセスキーを発行・管理します
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
          <h1 className="text-2xl font-bold">アクセスキー管理</h1>
          <p className="text-muted-foreground">
            メンバー用のアクセスキーを発行・管理します
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <span className="material-symbols-outlined text-xl">add</span>
          新しいキーを発行
        </Button>
      </div>

      {/* Stats */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => setStatusFilter("")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors",
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
              "p-4 rounded-lg border text-left transition-colors",
              statusFilter === "active" ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/50"
            )}
          >
            <p className="text-2xl font-bold text-green-400">{data.summary.active}</p>
            <p className="text-sm text-muted-foreground">未使用</p>
          </button>
          <button
            onClick={() => setStatusFilter("used")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors",
              statusFilter === "used" ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50"
            )}
          >
            <p className="text-2xl font-bold text-blue-400">{data.summary.used}</p>
            <p className="text-sm text-muted-foreground">使用中</p>
          </button>
          <button
            onClick={() => setStatusFilter("revoked")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors",
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
              placeholder="キーコードまたはユーザー名で検索..."
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
          <div className="overflow-x-auto">
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
                    トークン上限
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
                            className="p-1 hover:bg-muted rounded transition-colors"
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
                        {key.user?.displayName || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {key.dailyTokenLimit.toLocaleString()}/日
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
                              >
                                <span className="material-symbols-outlined text-lg">
                                  edit
                                </span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
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
                              className="text-amber-500 hover:text-amber-400"
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
              <Label htmlFor="dailyTokenLimit">1日あたりのトークン上限</Label>
              <Input
                id="dailyTokenLimit"
                type="number"
                min={100}
                max={100000}
                value={dailyTokenLimit}
                onChange={(e) => setDailyTokenLimit(parseInt(e.target.value) || 1000)}
              />
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
                      "px-3 py-2 rounded-lg border text-sm transition-colors",
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
            >
              キャンセル
            </Button>
            <Button onClick={handleGenerateKeys} disabled={creating}>
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
                  className="p-1 hover:bg-background rounded transition-colors"
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
            <Button variant="outline" onClick={copyAllKeys}>
              すべてコピー
            </Button>
            <Button onClick={() => setShowCreatedDialog(false)}>閉じる</Button>
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
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="editDailyTokenLimit">1日あたりのトークン上限</Label>
              <Input
                id="editDailyTokenLimit"
                type="number"
                min={100}
                max={100000}
                value={editDailyTokenLimit}
                onChange={(e) => setEditDailyTokenLimit(parseInt(e.target.value) || 1000)}
              />
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
                  "relative h-6 w-11 rounded-full transition-colors shrink-0 ml-3",
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
            >
              キャンセル
            </Button>
            <Button onClick={handleUpdateKey} disabled={updating}>
              {updating ? "更新中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
