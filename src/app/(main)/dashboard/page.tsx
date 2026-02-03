"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FullPageLoading } from "@/components/common/LoadingSpinner";

type PeriodType = "week" | "month" | "all";

interface DashboardData {
  summary: {
    totalLearningMinutes: number;
    totalConversations: number;
    totalLearnings: number;
    thisMonthLearnings: number;
    selfSolveRate: number;
  };
  learningTimeData: Array<{ date: string; minutes: number }>;
  understandingData: Array<{ subject: string; value: number; fullMark: number }>;
  estimationAccuracyData: Array<{ date: string; predicted: number; actual: number }>;
  modeUsage: Record<string, number>;
  period: PeriodType;
}

const periodLabels: Record<PeriodType, string> = {
  week: "週",
  month: "月",
  all: "全期間",
};

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function StatCard({
  icon,
  iconColor,
  label,
  value,
  subValue,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg bg-${iconColor}/10`}>
            <span className={`material-symbols-outlined text-2xl text-${iconColor}`}>
              {icon}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LearningTimeChart({ data }: { data: Array<{ date: string; minutes: number }> }) {
  const chartData = data.map((item) => ({
    ...item,
    name: formatDateLabel(item.date),
  }));

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">schedule</span>
          学習時間推移
        </CardTitle>
        <CardDescription>日別の学習時間（分）</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  unit="分"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar
                  dataKey="minutes"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  name="学習時間"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2">bar_chart</span>
                <p>データがありません</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UnderstandingRadarChart({
  data,
}: {
  data: Array<{ subject: string; value: number; fullMark: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">radar</span>
          理解度レーダー
        </CardTitle>
        <CardDescription>トピック別の理解度</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {data.length > 0 && data.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                <PolarGrid className="stroke-muted" />
                <PolarAngleAxis
                  dataKey="subject"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <Radar
                  name="理解度"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2">radar</span>
                <p>学習データを蓄積中</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EstimationAccuracyChart({
  data,
}: {
  data: Array<{ date: string; predicted: number; actual: number }>;
}) {
  const chartData = data.map((item) => ({
    ...item,
    name: formatDateLabel(item.date),
  }));

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">trending_up</span>
          見積もり精度
        </CardTitle>
        <CardDescription>予測時間 vs 実際の時間（分）</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  unit="分"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                  name="予測"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="hsl(142.1 76.2% 36.3%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(142.1 76.2% 36.3%)" }}
                  name="実績"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2">timeline</span>
                <p>見積もりデータがありません</p>
                <p className="text-xs mt-1">生成モードで見積もり訓練を行うと表示されます</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SelfSolveRateCard({ rate }: { rate: number }) {
  const getColor = (r: number) => {
    if (r >= 70) return "text-green-500";
    if (r >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">psychology</span>
          自力解決率
        </CardTitle>
        <CardDescription>ヒントなしで解決できた割合</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-4">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="hsl(var(--muted))"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="hsl(var(--primary))"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${rate * 3.52} 352`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${getColor(rate)}`}>{rate}%</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            {rate >= 70
              ? "素晴らしい！自走力が身についています"
              : rate >= 40
                ? "着実に成長しています"
                : "ヒントを活用しながら学習を続けましょう"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodType>("week");
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (selectedPeriod: PeriodType) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dashboard?period=${selectedPeriod}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || "データの取得に失敗しました");
      }
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchDashboardData(period);
    }
  }, [session?.user?.id, period, fetchDashboardData]);

  if (status === "loading" || (status === "authenticated" && isLoading && !data)) {
    return <FullPageLoading />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">insights</span>
            成長ダッシュボード
          </h1>
          <p className="text-muted-foreground mt-1">
            あなたの学習進捗を可視化します
          </p>
        </div>

        <div className="flex gap-2 bg-muted p-1 rounded-lg">
          {(["week", "month", "all"] as PeriodType[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
              className="min-w-[60px]"
            >
              {periodLabels[p]}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="mb-8 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive flex items-center gap-2">
              <span className="material-symbols-outlined">error</span>
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon="schedule"
              iconColor="primary"
              label="総学習時間"
              value={`${data.summary.totalLearningMinutes}分`}
              subValue={`${Math.floor(data.summary.totalLearningMinutes / 60)}時間${data.summary.totalLearningMinutes % 60}分`}
            />
            <StatCard
              icon="chat"
              iconColor="blue-500"
              label="対話回数"
              value={data.summary.totalConversations}
              subValue={`${periodLabels[period]}間`}
            />
            <StatCard
              icon="lightbulb"
              iconColor="yellow-500"
              label="気づきカード"
              value={data.summary.totalLearnings}
              subValue={`今月 +${data.summary.thisMonthLearnings}件`}
            />
            <StatCard
              icon="psychology"
              iconColor="green-500"
              label="自力解決率"
              value={`${data.summary.selfSolveRate}%`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <LearningTimeChart data={data.learningTimeData} />
            <UnderstandingRadarChart data={data.understandingData} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <EstimationAccuracyChart data={data.estimationAccuracyData} />
            <SelfSolveRateCard rate={data.summary.selfSolveRate} />
          </div>
        </>
      )}
    </div>
  );
}
