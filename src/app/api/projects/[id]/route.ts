import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import type { ProjectStatus, ProjectType, ProjectPhase } from "@/generated/prisma/client";

const managementSheetSchema = z
  .object({
    milestones: z
      .array(
        z.object({
          title: z.string(),
          dueDate: z.string().optional(),
          status: z.enum(["pending", "completed"]),
        })
      )
      .optional(),
    risks: z
      .array(
        z.object({
          description: z.string(),
          impact: z.enum(["low", "medium", "high"]),
          mitigation: z.string().optional(),
        })
      )
      .optional(),
    notes: z.string().optional(),
  })
  .optional()
  .nullable();

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["planning", "in_progress", "completed", "archived"]).optional(),
  // Project-centric fields
  projectType: z.enum(["product", "learning"]).optional(),
  currentPhase: z.enum(["planning", "design", "development"]).optional().nullable(),
  planningDocUrl: z.string().url().max(500).optional().nullable(),
  managementSheet: managementSheetSchema,
  // 企画情報
  ideaSummary: z.string().max(1000).optional().nullable(),
  targetPersona: z.string().max(1000).optional().nullable(),
  competitors: z.array(z.string()).max(20).optional(),
  techStack: z.array(z.string()).max(20).optional(),
  mvpFeatures: z.array(z.string()).max(30).optional(),
  estimatedHours: z.number().int().min(0).max(10000).optional().nullable(),
  actualHours: z.number().int().min(0).max(10000).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

// Get single project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        tasks: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: {
            subtasks: {
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
        { status: 404 }
      );
    }

    // Calculate task stats
    const taskStats = {
      total: project.tasks.length,
      completed: project.tasks.filter((t) => t.status === "completed").length,
      inProgress: project.tasks.filter((t) => t.status === "in_progress").length,
      pending: project.tasks.filter((t) => t.status === "pending").length,
      blocked: project.tasks.filter((t) => t.status === "blocked").length,
    };

    // Calculate estimation accuracy
    const completedTasks = project.tasks.filter(
      (t) => t.status === "completed" && t.estimatedMinutes && t.actualMinutes
    );
    let estimationAccuracy: number | undefined;

    if (completedTasks.length > 0) {
      const totalEstimated = completedTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
      const totalActual = completedTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
      if (totalEstimated > 0) {
        estimationAccuracy = Math.round((1 - Math.abs(totalActual - totalEstimated) / totalEstimated) * 100);
        estimationAccuracy = Math.max(0, Math.min(100, estimationAccuracy));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...formatProject(project),
        tasks: project.tasks.map(formatTask),
        taskStats,
        estimationAccuracy,
      },
    });
  } catch (error) {
    console.error("Get project error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "プロジェクトの取得に失敗しました" } },
      { status: 500 }
    );
  }
}

// Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    // Check ownership
    const existing = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
        { status: 404 }
      );
    }

    const data = parsed.data;

    // Handle status change to completed
    const completedAt =
      data.status === "completed" && existing.status !== "completed"
        ? new Date()
        : data.status !== "completed"
          ? null
          : existing.completedAt;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        // Project-centric fields
        ...(data.projectType !== undefined && { projectType: data.projectType }),
        ...(data.currentPhase !== undefined && { currentPhase: data.currentPhase }),
        ...(data.planningDocUrl !== undefined && { planningDocUrl: data.planningDocUrl }),
        ...(data.managementSheet !== undefined && {
          managementSheet: data.managementSheet === null ? Prisma.JsonNull : data.managementSheet,
        }),
        // 企画情報
        ...(data.ideaSummary !== undefined && { ideaSummary: data.ideaSummary }),
        ...(data.targetPersona !== undefined && { targetPersona: data.targetPersona }),
        ...(data.competitors !== undefined && { competitors: data.competitors }),
        ...(data.techStack !== undefined && { techStack: data.techStack }),
        ...(data.mvpFeatures !== undefined && { mvpFeatures: data.mvpFeatures }),
        ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
        ...(data.actualHours !== undefined && { actualHours: data.actualHours }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        completedAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: formatProject(project),
    });
  } catch (error) {
    console.error("Update project error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "プロジェクトの更新に失敗しました" } },
      { status: 500 }
    );
  }
}

// Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check ownership
    const existing = await prisma.project.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
        { status: 404 }
      );
    }

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "プロジェクトの削除に失敗しました" } },
      { status: 500 }
    );
  }
}

// Helper function to format project
function formatProject(project: {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  // Project-centric fields
  projectType: ProjectType;
  currentPhase: ProjectPhase | null;
  planningDocUrl: string | null;
  managementSheet: unknown;
  // 企画情報
  ideaSummary: string | null;
  targetPersona: string | null;
  competitors: string[];
  techStack: string[];
  mvpFeatures: string[];
  estimatedHours: number | null;
  actualHours: number | null;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...project,
    startDate: project.startDate?.toISOString() || null,
    dueDate: project.dueDate?.toISOString() || null,
    completedAt: project.completedAt?.toISOString() || null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

// Helper type for task input
interface TaskInput {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  order: number;
  isMilestone: boolean;
  dueDate: Date | null;
  notes: string | null;
  retrospective: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  subtasks?: TaskInput[];
}

// Helper type for formatted task output
interface FormattedTask {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  startedAt: string | null;
  completedAt: string | null;
  order: number;
  isMilestone: boolean;
  dueDate: string | null;
  notes: string | null;
  retrospective: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  subtasks: FormattedTask[];
}

// Helper function to format task
function formatTask(task: TaskInput): FormattedTask {
  return {
    ...task,
    startedAt: task.startedAt?.toISOString() || null,
    completedAt: task.completedAt?.toISOString() || null,
    dueDate: task.dueDate?.toISOString() || null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    subtasks: task.subtasks?.map((st) => formatTask(st)) || [],
  };
}
