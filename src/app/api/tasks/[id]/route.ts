import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "blocked"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  estimatedMinutes: z.number().int().min(0).max(99999).optional().nullable(),
  actualMinutes: z.number().int().min(0).max(99999).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  isMilestone: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  notes: z.string().max(5000).optional().nullable(),
  retrospective: z.string().max(2000).optional().nullable(),
});

// Get single task
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

    const task = await prisma.task.findFirst({
      where: { id },
      include: {
        project: {
          select: { userId: true, title: true },
        },
        subtasks: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!task || task.project.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "タスクが見つかりません" } },
        { status: 404 }
      );
    }

    // Calculate estimation accuracy if completed
    let estimationAccuracy: number | undefined;
    if (task.status === "completed" && task.estimatedMinutes && task.actualMinutes) {
      estimationAccuracy = Math.round(
        (1 - Math.abs(task.actualMinutes - task.estimatedMinutes) / task.estimatedMinutes) * 100
      );
      estimationAccuracy = Math.max(0, Math.min(100, estimationAccuracy));
    }

    return NextResponse.json({
      success: true,
      data: {
        ...formatTask(task),
        projectTitle: task.project.title,
        estimationAccuracy,
      },
    });
  } catch (error) {
    console.error("Get task error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "タスクの取得に失敗しました" } },
      { status: 500 }
    );
  }
}

// Update task
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
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    // Check ownership
    const existing = await prisma.task.findFirst({
      where: { id },
      include: {
        project: { select: { userId: true } },
      },
    });

    if (!existing || existing.project.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "タスクが見つかりません" } },
        { status: 404 }
      );
    }

    const data = parsed.data;

    // Handle status changes
    let startedAt = existing.startedAt;
    let completedAt = existing.completedAt;

    if (data.status === "in_progress" && existing.status === "pending") {
      startedAt = new Date();
    }

    if (data.status === "completed" && existing.status !== "completed") {
      completedAt = new Date();
      // Auto-calculate actual time if not provided
      if (!data.actualMinutes && startedAt) {
        const elapsedMs = completedAt.getTime() - startedAt.getTime();
        data.actualMinutes = Math.round(elapsedMs / 60000);
      }
    } else if (data.status && data.status !== "completed") {
      completedAt = null;
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.estimatedMinutes !== undefined && { estimatedMinutes: data.estimatedMinutes }),
        ...(data.actualMinutes !== undefined && { actualMinutes: data.actualMinutes }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.isMilestone !== undefined && { isMilestone: data.isMilestone }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.retrospective !== undefined && { retrospective: data.retrospective }),
        startedAt,
        completedAt,
      },
      include: {
        subtasks: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: formatTask(task),
    });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "タスクの更新に失敗しました" } },
      { status: 500 }
    );
  }
}

// Delete task
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
    const existing = await prisma.task.findFirst({
      where: { id },
      include: {
        project: { select: { userId: true } },
      },
    });

    if (!existing || existing.project.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "タスクが見つかりません" } },
        { status: 404 }
      );
    }

    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "タスクの削除に失敗しました" } },
      { status: 500 }
    );
  }
}

// Start task timer
export async function PUT(
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
    const action = body.action as "start" | "stop";

    // Check ownership
    const existing = await prisma.task.findFirst({
      where: { id },
      include: {
        project: { select: { userId: true } },
      },
    });

    if (!existing || existing.project.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "タスクが見つかりません" } },
        { status: 404 }
      );
    }

    if (action === "start") {
      const task = await prisma.task.update({
        where: { id },
        data: {
          status: "in_progress",
          startedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: formatTask(task),
      });
    } else if (action === "stop") {
      const now = new Date();
      let actualMinutes = existing.actualMinutes || 0;

      if (existing.startedAt) {
        const elapsedMs = now.getTime() - existing.startedAt.getTime();
        actualMinutes += Math.round(elapsedMs / 60000);
      }

      const task = await prisma.task.update({
        where: { id },
        data: {
          actualMinutes,
          // Don't change status, just record time
        },
      });

      return NextResponse.json({
        success: true,
        data: formatTask(task),
      });
    }

    return NextResponse.json(
      { success: false, error: { code: "INVALID_ACTION", message: "無効なアクションです" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Task timer error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "タスクの操作に失敗しました" } },
      { status: 500 }
    );
  }
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
