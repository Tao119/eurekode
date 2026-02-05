"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface OrganizationData {
  organization: {
    id: string;
    name: string;
    plan: string;
    createdAt: string;
  };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  statistics: {
    totalMembers: number;
    activeMembers: number;
    totalKeys: number;
    keysByStatus: {
      active: number;
      used: number;
      expired: number;
      revoked: number;
    };
    monthlyTokenUsage: number;
    totalConversations: number;
  };
  alerts: {
    inactiveMembers: { id: string; displayName: string }[];
    lowTokenMembers: { id: string; displayName: string }[];
  };
}

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/admin/organization");
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error?.message || "データの取得に失敗しました");
        }
      } catch {
        setError("データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    async function fetchPendingRequests() {
      try {
        const response = await fetch("/api/billing/credits/allocation/request");
        const result = await response.json();
        if (result.requests) {
          const count = result.requests.filter(
            (r: { status: string }) => r.status === "pending"
          ).length;
          setPendingRequestCount(count);
        }
      } catch {
        // Silently ignore
      }
    }
    fetchData();
    fetchPendingRequests();
  }, []);

  const stats = data
    ? [
        {
          title: "アクティブメンバー",
          value: `${data.statistics.activeMembers}/${data.statistics.totalMembers}`,
          icon: "group",
          color: "text-blue-400",
          bgColor: "bg-blue-500/20",
        },
        {
          title: "発行キー数",
          value: data.statistics.totalKeys.toString(),
          subText: `未使用: ${data.statistics.keysByStatus.active}`,
          icon: "key",
          color: "text-green-400",
          bgColor: "bg-green-500/20",
        },
        {
          title: "今月のポイント使用量",
          value: data.statistics.monthlyTokenUsage.toLocaleString(),
          icon: "toll",
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/20",
        },
        {
          title: "総会話数",
          value: data.statistics.totalConversations.toLocaleString(),
          icon: "chat",
          color: "text-purple-400",
          bgColor: "bg-purple-500/20",
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">管理者ダッシュボード</h1>
          <p className="text-muted-foreground">組織の利用状況を確認できます</p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="size-12 rounded-lg" />
                  <div>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">管理者ダッシュボード</h1>
          <p className="text-muted-foreground">組織の利用状況を確認できます</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <span className="material-symbols-outlined text-4xl text-destructive mb-2">
              error
            </span>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">管理者ダッシュボード</h1>
        <p className="text-muted-foreground">組織の利用状況を確認できます</p>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined">business</span>
            組織情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">組織名</p>
              <p className="font-medium">{data?.organization.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">プラン</p>
              <p className="font-medium capitalize">
                {data?.subscription?.plan || data?.organization.plan || "team"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">管理者</p>
              <p className="font-medium">{session?.user.displayName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">メールアドレス</p>
              <p className="font-medium">{session?.user.email || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div
                  className={`size-12 rounded-lg flex items-center justify-center ${stat.bgColor}`}
                >
                  <span className={`material-symbols-outlined text-2xl ${stat.color}`}>
                    {stat.icon}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  {"subText" in stat && stat.subText && (
                    <p className="text-xs text-muted-foreground">{stat.subText}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Requests Alert */}
      {pendingRequestCount > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl text-yellow-500">
                    inbox
                  </span>
                </div>
                <div>
                  <p className="font-medium">
                    {pendingRequestCount}件のポイントリクエスト
                  </p>
                  <p className="text-sm text-muted-foreground">
                    メンバーからのポイント割り当てリクエストがあります
                  </p>
                </div>
              </div>
              <a
                href="/admin/requests"
                className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 text-sm font-medium transition-colors text-center sm:text-left shrink-0"
              >
                確認する
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {data && (data.alerts.inactiveMembers.length > 0 || data.alerts.lowTokenMembers.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-400">warning</span>
              アラート
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.alerts.inactiveMembers.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">7日以上非アクティブなメンバー</p>
                <div className="flex flex-wrap gap-2">
                  {data.alerts.inactiveMembers.map((member) => (
                    <span
                      key={member.id}
                      className="px-2 py-1 bg-muted rounded text-sm"
                    >
                      {member.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.alerts.lowTokenMembers.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">ポイント残量が少ないメンバー（80%以上消費）</p>
                <div className="flex flex-wrap gap-2">
                  {data.alerts.lowTokenMembers.map((member) => (
                    <span
                      key={member.id}
                      className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm"
                    >
                      {member.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>クイックアクション</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickActionButton
              href="/admin/keys"
              icon="add"
              label="新しいキーを発行"
              description="メンバー用のアクセスキーを作成"
            />
            <QuickActionButton
              href="/admin/members"
              icon="person_search"
              label="メンバーを管理"
              description="メンバーの一覧と設定"
            />
            <QuickActionButton
              href="/admin/settings"
              icon="settings"
              label="組織設定"
              description="利用制限やモード設定"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickActionButton({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: string;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all"
    >
      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </a>
  );
}
