"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  displayName: string;
  email: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
  tokensUsedToday: number;
  dailyTokenLimit: number;
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

interface MemberDetail {
  id: string;
  displayName: string;
  email: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
  tokensUsedToday: number;
  dailyTokenLimit: number;
  accessKey: {
    id: string;
    keyCode: string;
    status: string;
    expiresAt: string | null;
  } | null;
  statistics: {
    totalConversations: number;
    totalLearnings: number;
    totalTokensUsed: number;
  };
  recentConversations: {
    id: string;
    title: string;
    mode: string;
    messagesCount: number;
    createdAt: string;
    updatedAt: string;
  }[];
  tokenHistory: {
    date: string;
    tokensUsed: number;
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
    todayTotalTokens: number;
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
                  {(data?.summary.todayTotalTokens || 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">今日の総トークン</p>
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
                    参加日
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    最終アクティブ
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    トークン使用量
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
                  const usagePercent =
                    (member.tokensUsedToday / member.dailyTokenLimit) * 100;
                  return (
                    <tr
                      key={member.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
                            {member.displayName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-medium">{member.displayName}</span>
                            <p className="text-xs text-muted-foreground">
                              会話: {member.stats.totalConversations} | 学び: {member.stats.totalLearnings}
                            </p>
                          </div>
                        </div>
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
                            {member.tokensUsedToday}/{member.dailyTokenLimit}
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
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
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
        <DialogContent className="max-w-2xl">
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
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                  {selectedMember.displayName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedMember.displayName}</h3>
                  <p className="text-muted-foreground">
                    参加日: {new Date(selectedMember.joinedAt).toLocaleDateString("ja-JP")}
                  </p>
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
                  <p className="text-2xl font-bold">{selectedMember.statistics.totalTokensUsed.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">総トークン</p>
                </div>
              </div>

              {/* Access Key */}
              {selectedMember.accessKey && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">アクセスキー</h4>
                  <div className="flex items-center gap-4">
                    <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                      {selectedMember.accessKey.keyCode}
                    </code>
                    <span
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        selectedMember.accessKey.status === "used"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-500/20 text-gray-400"
                      )}
                    >
                      {selectedMember.accessKey.status}
                    </span>
                  </div>
                </div>
              )}

              {/* Token History */}
              {selectedMember.tokenHistory.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">直近7日間のトークン使用量</h4>
                  <div className="flex items-end gap-1 h-16">
                    {selectedMember.tokenHistory.map((day, index) => {
                      const maxTokens = Math.max(...selectedMember.tokenHistory.map(d => d.tokensUsed), 1);
                      const heightPercent = (day.tokensUsed / maxTokens) * 100;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-primary/60 rounded-t"
                            style={{ height: `${Math.max(heightPercent, 2)}%` }}
                            title={`${day.date}: ${day.tokensUsed}トークン`}
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
                            {conv.mode} | {conv.messagesCount}メッセージ
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
    </div>
  );
}
