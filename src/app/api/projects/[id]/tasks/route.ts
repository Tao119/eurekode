import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTaskSchema = z.object({
  parentTaskId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  estimatedMinutes: z.number().int().min(0).max(99999).optional(),
  dueDate: z.string().datetime().optional(),
  isMilestone: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

const bulkCreateTasksSchema = z.object({
  tasks: z.array(createTaskSchema).min(1).max(50),
});

// Create task
export async function POST(
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

    const { id: projectId } = await params;

    // Check project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Check if bulk create
    if (body.tasks) {
      const parsed = bulkCreateTasksSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
          { status: 400 }
        );
      }

      // Get max order
      const maxOrder = await prisma.task.aggregate({
        where: { projectId, parentTaskId: null },
        _max: { order: true },
      });

      let currentOrder = (maxOrder._max.order ?? -1) + 1;

      const tasks = await prisma.task.createMany({
        data: parsed.data.tasks.map((task) => ({
          projectId,
          parentTaskId: task.parentTaskId,
          title: task.title,
          description: task.description,
          priority: task.priority || "medium",
          estimatedMinutes: task.estimatedMinutes,
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          isMilestone: task.isMilestone || false,
          order: task.order ?? currentOrder++,
        })),
      });

      return NextResponse.json({
        success: true,
        data: { count: tasks.count },
      });
    }

    // Single task create
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Get max order for positioning
    const maxOrder = await prisma.task.aggregate({
      where: { projectId, parentTaskId: data.parentTaskId ?? null },
      _max: { order: true },
    });

    const task = await prisma.task.create({
      data: {
        projectId,
        parentTaskId: data.parentTaskId,
        title: data.title,
        description: data.description,
        priority: data.priority || "medium",
        estimatedMinutes: data.estimatedMinutes,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isMilestone: data.isMilestone || false,
        order: data.order ?? (maxOrder._max.order ?? -1) + 1,
      },
    });

    return NextResponse.json({
      success: true,
      data: formatTask(task),
    });
  } catch (error) {
    console.error("Task creation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "タスクの作成に失敗しました" } },
      { status: 500 }
    );
  }
}

// Get tasks for project
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

    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const parentTaskId = searchParams.get("parentTaskId");
    const topLevelOnly = searchParams.get("topLevelOnly") === "true";

    // Check project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
        { status: 404 }
      );
    }

    const where = {
      projectId,
      ...(status && { status: status as "pending" | "in_progress" | "completed" | "blocked" }),
      ...(priority && { priority: priority as "low" | "medium" | "high" | "urgent" }),
      ...(topLevelOnly && { parentTaskId: null }),
      ...(parentTaskId && { parentTaskId }),
    };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        subtasks: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        items: tasks.map(formatTask),
        total: tasks.length,
      },
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "タスクの取得に失敗しました" } },
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
