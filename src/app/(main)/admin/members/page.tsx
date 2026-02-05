"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

interface Member {
  id: string;
  displayName: string;
  email: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
  allocatedPoints: number;
  usedPoints: number;
  remainingPoints: number;
  status: "active" | "inactive";
  accessKey: {
    id: string;
    keyCode: string;
    status: string;
  } | null;
  stats: {
    totalConversations: number;
    totalLearnings: number;
  };
}

type ChatMode = "explanation" | "generation" | "brainstorm";

interface MemberDetail {
  member: {
    id: string;
    displayName: string;
    email: string | null;
    joinedAt: string;
    lastActiveAt: string | null;
    status: string;
    skipAllowed: boolean;
    isEnabled: boolean;
    allowedModes: ChatMode[];
  };
  accessKey: {
    id: string;
    keyCode: string;
    dailyTokenLimit: number;
    status: string;
    expiresAt: string | null;
    usedAt: string | null;
  } | null;
  tokenAllocation: {
    monthlyLimit: number;
    usedPoints: number;
    remaining: number;
    organizationMonthlyLimit: number;
    organizationTotalAllocated: number;
    availableForAllocation: number;
  };
  statistics: {
    tokensUsedToday: number;
    tokensUsedWeek: number;
    tokensUsedMonth: number;
    totalConversations: number;
    totalLearnings: number;
    modeBreakdown: Record<string, number>;
  };
  tokenHistory: {
    date: string;
    tokensUsed: number;
    breakdown: Record<string, number> | null;
  }[];
  recentConversations: {
    id: string;
    title: string;
    mode: string;
    tokensConsumed: number;
    createdAt: string;
    updatedAt: string;
  }[];
  recentLearnings: {
    id: string;
    type: string;
    content: string;
    tags: string[];
    createdAt: string;
  }[];
}

interface MembersResponse {
  members: Member[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  summary: {
    totalMembers: number;
    activeMembers: number;
    monthlyPointsUsed: number;
  };
}

export default function MembersPage() {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Password reset state
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // Delete member state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Key regeneration state
  const [showRegenerateKeyDialog, setShowRegenerateKeyDialog] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [newKeyCode, setNewKeyCode] = useState<string | null>(null);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);

  // Token limit adjustment state
  const [showTokenLimitDialog, setShowTokenLimitDialog] = useState(false);
  const [newTokenLimit, setNewTokenLimit] = useState<string>("");
  const [isUpdatingTokenLimit, setIsUpdatingTokenLimit] = useState(false);

  const handleToggleSkipAllowed = async (memberId: string, newValue: boolean) => {
    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipAllowed: newValue }),
      });
      const result = await response.json();
      if (result.success && selectedMember) {
        startTransition(() => {
          setSelectedMember({
            ...selectedMember,
            member: { ...selectedMember.member, skipAllowed: newValue },
          });
        });
      }
    } catch (error) {
      console.error("Failed to update skip allowed:", error);
    }
  };

  const handleToggleEnabled = async (memberId: string, newValue: boolean) => {
    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: newValue }),
      });
      const result = await response.json();
      if (result.success && selectedMember) {
        startTransition(() => {
          setSelectedMember({
            ...selectedMember,
            member: { ...selectedMember.member, isEnabled: newValue },
          });
        });
        toast.success(newValue ? "メンバーを有効にしました" : "メンバーを無効にしました");
      }
    } catch (error) {
      console.error("Failed to update enabled status:", error);
      toast.error("更新に失敗しました");
    }
  };

  const handleToggleMode = async (memberId: string, mode: ChatMode, currentModes: ChatMode[]) => {
    const newModes = currentModes.includes(mode)
      ? currentModes.filter(m => m !== mode)
      : [...currentModes, mode];

    // Must have at least one mode
    if (newModes.length === 0) {
      toast.error("少なくとも1つのモードを許可してください");
      return;
    }

    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedModes: newModes }),
      });
      const result = await response.json();
      if (result.success && selectedMember) {
        startTransition(() => {
          setSelectedMember({
            ...selectedMember,
            member: { ...selectedMember.member, allowedModes: newModes },
          });
        });
      }
    } catch (error) {
      console.error("Failed to update allowed modes:", error);
      toast.error("更新に失敗しました");
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/members/${selectedMember.member.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        toast.success("メンバーを削除しました");
        setShowDeleteDialog(false);
        setShowDetailDialog(false);
        setSelectedMember(null);
        fetchMembers();
      } else {
        toast.error(result.error?.message || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to delete member:", error);
      toast.error("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!selectedMember) return;

    setIsRegeneratingKey(true);
    try {
      const response = await fetch(`/api/admin/members/${selectedMember.member.id}/regenerate-key`, {
        method: "POST",
      });
      const result = await response.json();
      if (result.success) {
        setNewKeyCode(result.data.keyCode);
        setShowRegenerateKeyDialog(false);
        setShowNewKeyDialog(true);
        // Refresh member data
        const detailResponse = await fetch(`/api/admin/members/${selectedMember.member.id}`);
        const detailResult = await detailResponse.json();
        if (detailResult.success) {
          setSelectedMember(detailResult.data);
        }
      } else {
        toast.error(result.error?.message || "キーの再発行に失敗しました");
      }
    } catch (error) {
      console.error("Failed to regenerate key:", error);
      toast.error("キーの再発行に失敗しました");
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (!newKeyCode) return;
    try {
      await navigator.clipboard.writeText(newKeyCode);
      toast.success("キーをコピーしました");
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const handleUpdateTokenLimit = async () => {
    if (!selectedMember) return;

    const limit = parseInt(newTokenLimit, 10);
    if (isNaN(limit) || limit < 0) {
      toast.error("有効な数値を入力してください");
      return;
    }

    setIsUpdatingTokenLimit(true);
    try {
      const response = await fetch(`/api/admin/members/${selectedMember.member.id}/token-limit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyTokenLimit: limit }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("ポイント上限を更新しました");
        setShowTokenLimitDialog(false);
        setNewTokenLimit("");
        // Refresh member data
        const detailResponse = await fetch(`/api/admin/members/${selectedMember.member.id}`);
        const detailResult = await detailResponse.json();
        if (detailResult.success) {
          setSelectedMember(detailResult.data);
        }
      } else {
        toast.error(result.error?.message || "ポイント上限の更新に失敗しました");
      }
    } catch (error) {
      console.error("Failed to update token limit:", error);
      toast.error("ポイント上限の更新に失敗しました");
    } finally {
      setIsUpdatingTokenLimit(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedMember) return;

    if (newPassword !== confirmPassword) {
      toast.error("パスワードが一致しません");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("パスワードは8文字以上で入力してください");
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword)) {
      toast.error("パスワードには英字を含めてください");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      toast.error("パスワードには数字を含めてください");
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedMember.member.id,
          newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("パスワードをリセットしました");
        setShowPasswordResetDialog(false);
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswords(false);
      } else {
        toast.error(data.error?.message || "パスワードのリセットに失敗しました");
      }
    } catch {
      toast.error("パスワードのリセットに失敗しました");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const fetchMembers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");

      const response = await fetch(`/api/admin/members?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleViewMember = async (memberId: string) => {
    setDetailLoading(true);
    setShowDetailDialog(true);
    try {
      const response = await fetch(`/api/admin/members/${memberId}`);
      const result = await response.json();
      if (result.success) {
        setSelectedMember(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch member details:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const members = data?.members || [];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">メンバー管理</h1>
          <p className="text-muted-foreground">
            組織に参加しているメンバーを管理します
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
      <div>
        <h1 className="text-2xl font-bold">メンバー管理</h1>
        <p className="text-muted-foreground">
          組織に参加しているメンバーを管理します
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-400">group</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.summary.totalMembers || 0}</p>
                <p className="text-sm text-muted-foreground">総メンバー数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-400">
                  person_check
                </span>
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.summary.activeMembers || 0}</p>
                <p className="text-sm text-muted-foreground">アクティブ</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-yellow-400">toll</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {(data?.summary.monthlyPointsUsed || 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">今月の総ポイント消費</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Card className="flex-1">
          <CardContent className="pt-6">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                search
              </span>
              <Input
                type="text"
                placeholder="メンバー名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter("")}
            className={cn(
              "px-4 py-2 rounded-lg border text-sm transition-colors",
              statusFilter === "" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
            )}
          >
            すべて
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={cn(
              "px-4 py-2 rounded-lg border text-sm transition-colors",
              statusFilter === "active" ? "border-green-500 bg-green-500/10 text-green-400" : "border-border hover:border-green-500/50"
            )}
          >
            アクティブ
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={cn(
              "px-4 py-2 rounded-lg border text-sm transition-colors",
              statusFilter === "inactive" ? "border-gray-500 bg-gray-500/10 text-gray-400" : "border-border hover:border-gray-500/50"
            )}
          >
            非アクティブ
          </button>
        </div>
      </div>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>メンバー一覧</CardTitle>
          <CardDescription>
            {members.length}人のメンバーが見つかりました
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    メンバー
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    メール
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    参加日
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    最終アクティブ
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    ポイント使用量
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    ステータス
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const usagePercent = member.allocatedPoints > 0
                    ? (member.usedPoints / member.allocatedPoints) * 100
                    : 0;
                  return (
                    <tr
                      key={member.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
                            {member.displayName?.charAt(0) || "?"}
                          </div>
                          <div>
                            <span className="font-medium">{member.displayName || "名前未設定"}</span>
                            <p className="text-xs text-muted-foreground">
                              会話: {member.stats.totalConversations} | 学び: {member.stats.totalLearnings}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {member.email || "-"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(member.joinedAt).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {member.lastActiveAt
                          ? new Date(member.lastActiveAt).toLocaleDateString("ja-JP")
                          : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                usagePercent > 80
                                  ? "bg-red-500"
                                  : usagePercent > 50
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              )}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {member.usedPoints.toLocaleString()}/{member.allocatedPoints.toLocaleString()}pt
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            member.status === "active"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-gray-500/20 text-gray-400"
                          )}
                        >
                          {member.status === "active" ? "アクティブ" : "非アクティブ"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewMember(member.id)}
                        >
                          <span className="material-symbols-outlined text-lg">
                            visibility
                          </span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      メンバーが見つかりません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Member Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>メンバー詳細</DialogTitle>
            <DialogDescription>
              メンバーの詳細情報と利用状況
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : selectedMember ? (
            <div className="space-y-6 py-4 overflow-y-auto flex-1">
              {/* Basic Info */}
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                  {selectedMember.member.displayName?.charAt(0) || "?"}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedMember.member.displayName || "名前未設定"}</h3>
                  {selectedMember.member.email && (
                    <p className="text-sm text-muted-foreground">{selectedMember.member.email}</p>
                  )}
                  <p className="text-muted-foreground text-sm">
                    参加日: {new Date(selectedMember.member.joinedAt).toLocaleDateString("ja-JP")}
                  </p>
                </div>
              </div>

              {/* Account Status */}
              <div className="p-4 border rounded-lg space-y-4">
                <h4 className="font-medium">アカウント状態</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">アカウント有効</p>
                    <p className="text-xs text-muted-foreground">
                      無効にするとメンバーはログインできなくなります
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleEnabled(selectedMember.member.id, !selectedMember.member.isEnabled)}
                    disabled={isPending}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      selectedMember.member.isEnabled ? "bg-green-500" : "bg-muted",
                      isPending && "opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        selectedMember.member.isEnabled ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Feature Settings */}
              <div className="p-4 border rounded-lg space-y-4">
                <h4 className="font-medium">機能設定</h4>

                {/* Allowed Modes */}
                <div>
                  <p className="font-medium text-sm mb-2">利用可能なモード</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "explanation" as ChatMode, label: "解説モード", icon: "school" },
                      { value: "generation" as ChatMode, label: "生成モード", icon: "code" },
                      { value: "brainstorm" as ChatMode, label: "壁打ちモード", icon: "lightbulb" },
                    ].map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => handleToggleMode(selectedMember.member.id, mode.value, selectedMember.member.allowedModes)}
                        disabled={isPending}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                          selectedMember.member.allowedModes.includes(mode.value)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50",
                          isPending && "opacity-50"
                        )}
                      >
                        <span className="material-symbols-outlined text-lg">{mode.icon}</span>
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    選択されたモードのみ利用できます
                  </p>
                </div>

                {/* Skip Allowed */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div>
                    <p className="font-medium text-sm">コードスキップを許可</p>
                    <p className="text-xs text-muted-foreground">
                      クイズをスキップしてコードを直接コピーできるようにします
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleSkipAllowed(selectedMember.member.id, !selectedMember.member.skipAllowed)}
                    disabled={isPending}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      selectedMember.member.skipAllowed ? "bg-primary" : "bg-muted",
                      isPending && "opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        selectedMember.member.skipAllowed ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>

                {/* Password Reset */}
                {selectedMember.member.email && (
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div>
                      <p className="font-medium text-sm">パスワードリセット</p>
                      <p className="text-xs text-muted-foreground">
                        メンバーのパスワードを新しいものに変更します
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordResetDialog(true)}
                    >
                      リセット
                    </Button>
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="p-4 border border-destructive/50 rounded-lg">
                <h4 className="font-medium text-destructive mb-3">危険な操作</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">メンバーを削除</p>
                    <p className="text-xs text-muted-foreground">
                      メンバーとすべてのデータを完全に削除します
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    削除
                  </Button>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{selectedMember.statistics.totalConversations}</p>
                  <p className="text-sm text-muted-foreground">会話数</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{selectedMember.statistics.totalLearnings}</p>
                  <p className="text-sm text-muted-foreground">学び数</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{selectedMember.statistics.tokensUsedMonth.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">月間ポイント</p>
                </div>
              </div>

              {/* Token Allocation */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">月間ポイント上限</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewTokenLimit(String(selectedMember.tokenAllocation.monthlyLimit));
                      setShowTokenLimitDialog(true);
                    }}
                  >
                    <span className="material-symbols-outlined text-lg mr-1">edit</span>
                    調整
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">割り当て上限</span>
                    <span className="font-medium">{selectedMember.tokenAllocation.monthlyLimit.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">使用済み</span>
                    <span className="font-medium">{selectedMember.tokenAllocation.usedPoints.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">残り</span>
                    <span className={cn(
                      "font-medium",
                      selectedMember.tokenAllocation.remaining <= 0 ? "text-destructive" : ""
                    )}>
                      {selectedMember.tokenAllocation.remaining.toLocaleString()}
                    </span>
                  </div>
                  {selectedMember.tokenAllocation.monthlyLimit > 0 && (
                    <div className="pt-2">
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            selectedMember.tokenAllocation.usedPoints / selectedMember.tokenAllocation.monthlyLimit > 0.9
                              ? "bg-destructive"
                              : selectedMember.tokenAllocation.usedPoints / selectedMember.tokenAllocation.monthlyLimit > 0.7
                              ? "bg-yellow-500"
                              : "bg-primary"
                          )}
                          style={{
                            width: `${Math.min(100, (selectedMember.tokenAllocation.usedPoints / selectedMember.tokenAllocation.monthlyLimit) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    組織全体: {selectedMember.tokenAllocation.organizationTotalAllocated.toLocaleString()} / {selectedMember.tokenAllocation.organizationMonthlyLimit.toLocaleString()} 割り当て済み
                  </div>
                </div>
              </div>

              {/* Access Key */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">アクセスキー</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {selectedMember.accessKey ? (
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          selectedMember.accessKey.status === "used"
                            ? "bg-blue-500/20 text-blue-400"
                            : selectedMember.accessKey.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        )}
                      >
                        {selectedMember.accessKey.status === "used" ? "使用中" :
                         selectedMember.accessKey.status === "active" ? "未使用" :
                         selectedMember.accessKey.status}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">キーなし</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRegenerateKeyDialog(true)}
                  >
                    <span className="material-symbols-outlined text-lg mr-1">vpn_key</span>
                    キー再発行
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  再発行すると新しいキーが生成され、一度だけ表示されます
                </p>
              </div>

              {/* Token History */}
              {selectedMember.tokenHistory.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">直近7日間のポイント使用量</h4>
                  <div className="flex items-end gap-1 h-16">
                    {selectedMember.tokenHistory.slice(0, 7).map((day, index) => {
                      const maxTokens = Math.max(...selectedMember.tokenHistory.slice(0, 7).map(d => d.tokensUsed), 1);
                      const heightPercent = (day.tokensUsed / maxTokens) * 100;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-primary/60 rounded-t"
                            style={{ height: `${Math.max(heightPercent, 2)}%` }}
                            title={`${day.date}: ${day.tokensUsed}pt`}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(day.date).getDate()}日
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Conversations */}
              {selectedMember.recentConversations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">最近の会話</h4>
                  <div className="space-y-2">
                    {selectedMember.recentConversations.slice(0, 5).map((conv) => (
                      <div
                        key={conv.id}
                        className="p-3 border rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm">{conv.title || "無題の会話"}</p>
                          <p className="text-xs text-muted-foreground">
                            {conv.mode} | {conv.tokensConsumed.toLocaleString()}pt
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(conv.updatedAt).toLocaleDateString("ja-JP")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              データの読み込みに失敗しました
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordResetDialog} onOpenChange={(open) => {
        setShowPasswordResetDialog(open);
        if (!open) {
          setNewPassword("");
          setConfirmPassword("");
          setShowPasswords(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスワードをリセット</DialogTitle>
            <DialogDescription>
              {selectedMember?.member.displayName}さんの新しいパスワードを設定します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">新しいパスワード</Label>
              <Input
                id="newPassword"
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8文字以上（英字・数字を含む）"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
              <Input
                id="confirmPassword"
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="新しいパスワードを再入力"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">
                  {showPasswords ? "visibility_off" : "visibility"}
                </span>
                {showPasswords ? "パスワードを隠す" : "パスワードを表示"}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordResetDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handlePasswordReset}
              disabled={isResettingPassword || !newPassword || !confirmPassword}
            >
              {isResettingPassword ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  リセット中...
                </>
              ) : (
                "リセットする"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">メンバーを削除</DialogTitle>
            <DialogDescription>
              {selectedMember?.member.displayName}さんを削除しますか？
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm font-medium text-destructive">削除される内容:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>・ アカウント情報</li>
                <li>・ すべての会話履歴</li>
                <li>・ すべての学び（インサイト）</li>
                <li>・ ポイント使用履歴</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                ※ アクセスキーは無効化され、再利用できなくなります
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMember}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  削除中...
                </>
              ) : (
                "削除する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Key Confirmation Dialog */}
      <Dialog open={showRegenerateKeyDialog} onOpenChange={setShowRegenerateKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>キーを再発行</DialogTitle>
            <DialogDescription>
              {selectedMember?.member.displayName}さんのアクセスキーを再発行しますか？
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-sm font-medium text-yellow-400">注意事項:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>・ 現在のキーは無効になります</li>
                <li>・ 新しいキーは一度だけ表示されます</li>
                <li>・ メンバーに新しいキーを共有してください</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateKeyDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleRegenerateKey}
              disabled={isRegeneratingKey}
            >
              {isRegeneratingKey ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  再発行中...
                </>
              ) : (
                "再発行する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={(open) => {
        if (!open) {
          setNewKeyCode(null);
        }
        setShowNewKeyDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいアクセスキー</DialogTitle>
            <DialogDescription>
              このキーは一度だけ表示されます。必ずコピーして安全に保管してください。
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground mb-2 block">アクセスキー</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-lg bg-background px-3 py-2 rounded border select-all">
                  {newKeyCode}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyKey}
                  title="コピー"
                >
                  <span className="material-symbols-outlined">content_copy</span>
                </Button>
              </div>
            </div>
            <p className="text-xs text-destructive mt-3">
              ※ ダイアログを閉じるとこのキーは二度と表示されません
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => {
              setShowNewKeyDialog(false);
              setNewKeyCode(null);
            }}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Limit Adjustment Dialog */}
      <Dialog open={showTokenLimitDialog} onOpenChange={(open) => {
        if (!open) {
          setNewTokenLimit("");
        }
        setShowTokenLimitDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月間ポイント上限を調整</DialogTitle>
            <DialogDescription>
              {selectedMember?.member.displayName}さんの月間ポイント上限を設定します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {selectedMember && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">組織の月間上限</span>
                  <span>{selectedMember.tokenAllocation.organizationMonthlyLimit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">他メンバーへの割り当て済み</span>
                  <span>{(selectedMember.tokenAllocation.organizationTotalAllocated - selectedMember.tokenAllocation.monthlyLimit).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">割り当て可能な上限</span>
                  <span className="text-primary">{selectedMember.tokenAllocation.availableForAllocation.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tokenLimit">新しい月間ポイント上限</Label>
              <Input
                id="tokenLimit"
                type="number"
                min="0"
                max={selectedMember?.tokenAllocation.availableForAllocation}
                value={newTokenLimit}
                onChange={(e) => setNewTokenLimit(e.target.value)}
                placeholder="例: 5000"
              />
              <p className="text-xs text-muted-foreground">
                0を設定すると、このメンバーは今月ポイントを使用できなくなります
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTokenLimitDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleUpdateTokenLimit}
              disabled={isUpdatingTokenLimit || !newTokenLimit}
            >
              {isUpdatingTokenLimit ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  更新中...
                </>
              ) : (
                "更新する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
