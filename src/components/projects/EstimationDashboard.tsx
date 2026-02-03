"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Task, ProjectWithStats } from "@/types/project";

interface EstimationDashboardProps {
  projects?: ProjectWithStats[];
  tasks?: Task[];
  className?: string;
}

export function EstimationDashboard({
  projects = [],
  tasks = [],
  className,
}: EstimationDashboardProps) {
  const stats = useMemo(() => {
    // Collect all completed tasks with estimation data
    const completedTasks: Task[] = [];

    // From direct tasks
    for (const task of tasks) {
      if (
        task.status === "completed" &&
        task.estimatedMinutes &&
        task.actualMinutes
      ) {
        completedTasks.push(task);
      }
    }

    // From projects
    for (const project of projects) {
      if ("tasks" in project && Array.isArray((project as unknown as { tasks: Task[] }).tasks)) {
        for (const task of (project as unknown as { tasks: Task[] }).tasks) {
          if (
            task.status === "completed" &&
            task.estimatedMinutes &&
            task.actualMinutes
          ) {
            completedTasks.push(task);
          }
        }
      }
    }

    if (completedTasks.length === 0) {
      return {
        totalTasks: 0,
        totalEstimated: 0,
        totalActual: 0,
        averageAccuracy: 0,
        overEstimateCount: 0,
        underEstimateCount: 0,
        accurateCount: 0,
        byAccuracyRange: [] as { range: string; count: number; percentage: number }[],
        trend: [] as { date: string; accuracy: number }[],
      };
    }

    const totalEstimated = completedTasks.reduce(
      (sum, t) => sum + (t.estimatedMinutes || 0),
      0
    );
    const totalActual = completedTasks.reduce(
      (sum, t) => sum + (t.actualMinutes || 0),
      0
    );

    // Calculate individual accuracies
    const accuracies = completedTasks.map((task) => {
      const estimated = task.estimatedMinutes || 0;
      const actual = task.actualMinutes || 0;
      return estimated > 0
        ? Math.max(0, 100 - Math.abs(((actual - estimated) / estimated) * 100))
        : 100;
    });

    const averageAccuracy =
      accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;

    // Categorize by accuracy range
    const ranges = [
      { min: 90, max: 100, label: "90-100%" },
      { min: 70, max: 89, label: "70-89%" },
      { min: 50, max: 69, label: "50-69%" },
      { min: 0, max: 49, label: "0-49%" },
    ];

    const byAccuracyRange = ranges.map(({ min, max, label }) => {
      const count = accuracies.filter((acc) => acc >= min && acc <= max).length;
      return {
        range: label,
        count,
        percentage: (count / accuracies.length) * 100,
      };
    });

    // Count over/under estimates
    let overEstimateCount = 0;
    let underEstimateCount = 0;
    let accurateCount = 0;

    for (const task of completedTasks) {
      const estimated = task.estimatedMinutes || 0;
      const actual = task.actualMinutes || 0;
      const diff = actual - estimated;
      const threshold = estimated * 0.1; // 10% threshold

      if (diff > threshold) {
        underEstimateCount++; // Actual > Estimated (underestimated time)
      } else if (diff < -threshold) {
        overEstimateCount++; // Actual < Estimated (overestimated time)
      } else {
        accurateCount++;
      }
    }

    // Build trend data (last 7 days)
    const trend: { date: string; accuracy: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const dayTasks = completedTasks.filter((task) => {
        if (!task.completedAt) return false;
        const taskDate = new Date(task.completedAt).toISOString().split("T")[0];
        return taskDate === dateStr;
      });

      if (dayTasks.length > 0) {
        const dayAccuracies = dayTasks.map((task) => {
          const estimated = task.estimatedMinutes || 0;
          const actual = task.actualMinutes || 0;
          return estimated > 0
            ? Math.max(0, 100 - Math.abs(((actual - estimated) / estimated) * 100))
            : 100;
        });
        const avgAcc =
          dayAccuracies.reduce((sum, acc) => sum + acc, 0) / dayAccuracies.length;
        trend.push({ date: dateStr, accuracy: Math.round(avgAcc) });
      }
    }

    return {
      totalTasks: completedTasks.length,
      totalEstimated,
      totalActual,
      averageAccuracy: Math.round(averageAccuracy),
      overEstimateCount,
      underEstimateCount,
      accurateCount,
      byAccuracyRange,
      trend,
    };
  }, [projects, tasks]);

  if (stats.totalTasks === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center",
          className
        )}
      >
        <span className="material-symbols-outlined text-4xl text-muted-foreground mb-2">
          analytics
        </span>
        <h3 className="font-medium mb-1">見積精度データなし</h3>
        <p className="text-sm text-muted-foreground">
          タスクを完了すると、見積精度の分析が表示されます
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">analytics</span>
        <h2 className="font-semibold">見積精度ダッシュボード</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon="percent"
          label="平均精度"
          value={`${stats.averageAccuracy}%`}
          color={
            stats.averageAccuracy >= 80
              ? "green"
              : stats.averageAccuracy >= 50
                ? "yellow"
                : "red"
          }
        />
        <SummaryCard
          icon="check_circle"
          label="完了タスク"
          value={stats.totalTasks.toString()}
          color="blue"
        />
        <SummaryCard
          icon="schedule"
          label="見積合計"
          value={formatMinutes(stats.totalEstimated)}
          color="purple"
        />
        <SummaryCard
          icon="timer"
          label="実績合計"
          value={formatMinutes(stats.totalActual)}
          color="orange"
        />
      </div>

      {/* Estimation Pattern */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">pattern</span>
          見積パターン
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <PatternCard
            icon="expand_less"
            label="過大見積"
            count={stats.overEstimateCount}
            total={stats.totalTasks}
            description="実績 < 見積"
            color="blue"
          />
          <PatternCard
            icon="check"
            label="正確"
            count={stats.accurateCount}
            total={stats.totalTasks}
            description="±10%以内"
            color="green"
          />
          <PatternCard
            icon="expand_more"
            label="過少見積"
            count={stats.underEstimateCount}
            total={stats.totalTasks}
            description="実績 > 見積"
            color="red"
          />
        </div>
      </div>

      {/* Accuracy Distribution */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">bar_chart</span>
          精度分布
        </h3>

        <div className="space-y-2">
          {stats.byAccuracyRange.map((range) => (
            <AccuracyBar key={range.range} {...range} />
          ))}
        </div>
      </div>

      {/* Trend */}
      {stats.trend.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">trending_up</span>
            直近の推移
          </h3>

          <div className="flex items-end gap-2 h-24">
            {stats.trend.map((point, index) => (
              <TrendBar
                key={point.date}
                date={point.date}
                accuracy={point.accuracy}
                isLatest={index === stats.trend.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="rounded-lg bg-muted/50 p-4 text-sm">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-yellow-400">
            lightbulb
          </span>
          見積改善のヒント
        </h4>
        <ul className="space-y-1 text-muted-foreground">
          {stats.underEstimateCount > stats.overEstimateCount && (
            <li>• 見積が短すぎる傾向があります。バッファを20%追加してみましょう</li>
          )}
          {stats.overEstimateCount > stats.underEstimateCount && (
            <li>• 見積が長すぎる傾向があります。自分の実力を信じましょう</li>
          )}
          {stats.averageAccuracy >= 80 && (
            <li>• 見積精度が高いです！この調子を維持しましょう</li>
          )}
          <li>• 似たようなタスクの実績時間を参考にすると精度が上がります</li>
        </ul>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: "green" | "yellow" | "red" | "blue" | "purple" | "orange";
}) {
  const colorClasses = {
    green: "bg-green-500/10 text-green-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
    red: "bg-red-500/10 text-red-400",
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
    orange: "bg-orange-500/10 text-orange-400",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            colorClasses[color]
          )}
        >
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PatternCard({
  icon,
  label,
  count,
  total,
  description,
  color,
}: {
  icon: string;
  label: string;
  count: number;
  total: number;
  description: string;
  color: "green" | "red" | "blue";
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorClasses = {
    green: "text-green-400",
    red: "text-red-400",
    blue: "text-blue-400",
  };

  return (
    <div className="text-center">
      <span className={cn("material-symbols-outlined text-2xl", colorClasses[color])}>
        {icon}
      </span>
      <div className="font-medium text-sm mt-1">{label}</div>
      <div className={cn("text-xl font-bold", colorClasses[color])}>
        {count}
        <span className="text-sm text-muted-foreground ml-0.5">
          ({percentage}%)
        </span>
      </div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

function AccuracyBar({
  range,
  count,
  percentage,
}: {
  range: string;
  count: number;
  percentage: number;
}) {
  const getColor = (range: string) => {
    if (range.startsWith("90")) return "bg-green-500";
    if (range.startsWith("70")) return "bg-blue-500";
    if (range.startsWith("50")) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16">{range}</span>
      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getColor(range))}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
    </div>
  );
}

function TrendBar({
  date,
  accuracy,
  isLatest,
}: {
  date: string;
  accuracy: number;
  isLatest: boolean;
}) {
  const height = Math.max(10, (accuracy / 100) * 100);

  const getColor = (accuracy: number) => {
    if (accuracy >= 80) return "bg-green-500";
    if (accuracy >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div className="text-xs text-muted-foreground">{accuracy}%</div>
      <div
        className={cn(
          "w-full rounded-t-sm transition-all",
          getColor(accuracy),
          isLatest && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
        style={{ height: `${height}%` }}
      />
      <div className="text-xs text-muted-foreground">
        {new Date(date).getDate()}日
      </div>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
}
