import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  .optional();

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  // Project-centric fields
  projectType: z.enum(["product", "learning"]).optional(),
  currentPhase: z.enum(["planning", "design", "development"]).optional(),
  planningDocUrl: z.string().url().max(500).optional(),
  managementSheet: managementSheetSchema,
  // 企画情報
  ideaSummary: z.string().max(1000).optional(),
  targetPersona: z.string().max(1000).optional(),
  competitors: z.array(z.string()).max(20).optional(),
  techStack: z.array(z.string()).max(20).optional(),
  mvpFeatures: z.array(z.string()).max(30).optional(),
  estimatedHours: z.number().int().min(0).max(10000).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
});

// Create project
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        title: data.title,
        description: data.description,
        // Project-centric fields
        projectType: data.projectType || "product",
        currentPhase: data.currentPhase,
        planningDocUrl: data.planningDocUrl,
        managementSheet: data.managementSheet,
        // 企画情報
        ideaSummary: data.ideaSummary,
        targetPersona: data.targetPersona,
        competitors: data.competitors || [],
        techStack: data.techStack || [],
        mvpFeatures: data.mvpFeatures || [],
        estimatedHours: data.estimatedHours,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: formatProject(project),
    });
  } catch (error) {
    console.error("Project creation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "プロジェクトの作成に失敗しました" } },
      { status: 500 }
    );
  }
}

// Get projects
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const statusParam = searchParams.get("status");
    const projectType = searchParams.get("projectType") as ProjectType | null;
    const search = searchParams.get("search");

    // Handle comma-separated status values
    const statusFilter = statusParam
      ? statusParam.includes(",")
        ? { in: statusParam.split(",") as ProjectStatus[] }
        : statusParam as ProjectStatus
      : undefined;

    const where = {
      userId: session.user.id,
      ...(statusFilter && { status: statusFilter }),
      ...(projectType && { projectType }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          tasks: {
            select: {
              id: true,
              status: true,
              estimatedMinutes: true,
              actualMinutes: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    // Calculate stats for each project
    const projectsWithStats = projects.map((project) => {
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

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tasks: _, ...projectWithoutTasks } = project;
      return {
        ...formatProject(projectWithoutTasks),
        taskStats,
        estimationAccuracy,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items: projectsWithStats,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get projects error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "プロジェクトの取得に失敗しました" } },
      { status: 500 }
    );
  }
}

// Helper function to format project dates
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
