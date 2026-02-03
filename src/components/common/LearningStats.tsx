"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface LearningStatsData {
  consecutiveDays: number;
  monthlyInsights: number;
}

export function LearningStats() {
  const [stats, setStats] = useState<LearningStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/stats/learning");
        const data = await response.json();
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch learning stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex gap-4">
        <Card className="px-4 py-2 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-muted" />
            <div className="flex flex-col gap-1">
              <div className="h-2 w-12 bg-muted rounded" />
              <div className="h-4 w-8 bg-muted rounded" />
            </div>
          </div>
        </Card>
        <Card className="px-4 py-2 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-muted" />
            <div className="flex flex-col gap-1">
              <div className="h-2 w-16 bg-muted rounded" />
              <div className="h-4 w-8 bg-muted rounded" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <ConsecutiveDaysCard days={stats?.consecutiveDays ?? 0} />
      <MonthlyInsightsCard count={stats?.monthlyInsights ?? 0} />
    </div>
  );
}

function ConsecutiveDaysCard({ days }: { days: number }) {
  // Determine fire intensity based on streak
  const getFireColor = () => {
    if (days >= 30) return "text-red-500";
    if (days >= 14) return "text-orange-500";
    if (days >= 7) return "text-orange-400";
    if (days >= 3) return "text-yellow-500";
    return "text-orange-400";
  };

  const getFireAnimation = () => {
    if (days >= 7) return "animate-pulse";
    return "";
  };

  return (
    <Card className="px-4 py-2 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <span
          className={`material-symbols-outlined ${getFireColor()} ${getFireAnimation()}`}
        >
          local_fire_department
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
            連続学習
          </span>
          <span className="text-sm font-bold">
            {days > 0 ? `${days} 日` : "0 日"}
          </span>
        </div>
      </div>
    </Card>
  );
}

function MonthlyInsightsCard({ count }: { count: number }) {
  return (
    <Card className="px-4 py-2 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-blue-400">
          insights
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
            今月のインサイト
          </span>
          <span className="text-sm font-bold">{count} 件</span>
        </div>
      </div>
    </Card>
  );
}

// Smaller inline version for headers/compact spaces
export function LearningStatsCompact() {
  const [stats, setStats] = useState<LearningStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/stats/learning");
        const data = await response.json();
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch learning stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1 animate-pulse">
          <div className="size-4 rounded bg-muted" />
          <div className="h-3 w-8 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-1 animate-pulse">
          <div className="size-4 rounded bg-muted" />
          <div className="h-3 w-8 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const days = stats?.consecutiveDays ?? 0;
  const insights = stats?.monthlyInsights ?? 0;

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1">
        <span className="material-symbols-outlined text-orange-400 text-base">
          local_fire_department
        </span>
        <span className="font-medium">{days}日</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="material-symbols-outlined text-blue-400 text-base">
          insights
        </span>
        <span className="font-medium">{insights}件</span>
      </div>
    </div>
  );
}
