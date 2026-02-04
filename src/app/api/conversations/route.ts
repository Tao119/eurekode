import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRetentionCutoffDate } from "@/lib/retention";
import { z } from "zod";

// メッセージスキーマ（メタデータを含む）
const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string().optional(),
  metadata: z.any().optional(),
});

// メタデータスキーマ（分岐・brainstorm状態を含む）
const conversationMetadataSchema = z.object({
  options: z.any().optional(),
  state: z.any().optional(),
  branchState: z.object({
    branches: z.array(z.object({
      id: z.string(),
      name: z.string(),
      parentBranchId: z.string().optional(),
      forkPointIndex: z.number(),
      createdAt: z.string(),
    })),
    currentBranchId: z.string(),
    messagesByBranch: z.record(z.string(), z.array(messageSchema)),
  }).optional(),
  brainstormState: z.object({
    currentPhase: z.string(),
    completedPhases: z.array(z.string()),
    ideaSummary: z.string().nullable(),
    persona: z.string().nullable(),
    competitors: z.array(z.string()),
    techStack: z.array(z.string()),
    mvpFeatures: z.array(z.string()),
    planSteps: z.array(z.any()),
    insights: z.array(z.string()),
  }).optional(),
  lastActiveBranchId: z.string().optional(),
}).optional();

const createConversationSchema = z.object({
  mode: z.enum(["explanation", "generation", "brainstorm"]),
  messages: z.array(messageSchema),
  title: z.string().optional(),
  metadata: conversationMetadataSchema,
  // Project-centric fields
  projectId: z.string().uuid().optional(),
});

const updateConversationSchema = z.object({
  id: z.string(),
  messages: z.array(messageSchema),
  title: z.string().optional(),
  metadata: conversationMetadataSchema,
  // Project-centric fields
  projectId: z.string().uuid().optional().nullable(),
  isOrganized: z.boolean().optional(),
});

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
    const mode = searchParams.get("mode");
    const projectId = searchParams.get("projectId");
    const isOrganized = searchParams.get("isOrganized");
    const unorganizedOnly = searchParams.get("unorganizedOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Calculate retention cutoff date (future: pass user's plan)
    const retentionCutoff = getRetentionCutoffDate();

    const where = {
      userId: session.user.id,
      // Only show conversations within retention period
      createdAt: { gte: retentionCutoff },
      ...(mode && { mode: mode as "explanation" | "generation" | "brainstorm" }),
      ...(projectId && { projectId }),
      ...(isOrganized !== null && isOrganized !== undefined && { isOrganized: isOrganized === "true" }),
      ...(unorganizedOnly && { isOrganized: false, projectId: null }),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          mode: true,
          title: true,
          projectId: true,
          isOrganized: true,
          createdAt: true,
          updatedAt: true,
          tokensConsumed: true,
          project: {
            select: {
              id: true,
              title: true,
              projectType: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: conversations,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

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
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request format" } },
        { status: 400 }
      );
    }

    const { mode, messages, title, metadata, projectId } = parsed.data;

    // Verify project ownership if projectId is provided
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: session.user.id },
      });
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
          { status: 404 }
        );
      }
    }

    // Generate title from first user message if not provided
    const generatedTitle = title || messages.find((m) => m.role === "user")?.content.slice(0, 50) || "新しい会話";

    const conversation = await prisma.conversation.create({
      data: {
        userId: session.user.id,
        mode,
        messages,
        metadata: metadata || undefined,
        title: generatedTitle,
        tokensConsumed: 0,
        projectId,
        isOrganized: !!projectId,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            projectType: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request format" } },
        { status: 400 }
      );
    }

    const { id, messages, title, metadata, projectId, isOrganized } = parsed.data;

    // Verify ownership
    const existing = await prisma.conversation.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "会話が見つかりません" } },
        { status: 404 }
      );
    }

    // Verify project ownership if projectId is provided
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: session.user.id },
      });
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
          { status: 404 }
        );
      }
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        messages,
        ...(metadata !== undefined && { metadata }),
        ...(title && { title }),
        ...(projectId !== undefined && { projectId }),
        ...(isOrganized !== undefined && { isOrganized }),
        // Auto-set isOrganized when projectId is set
        ...(projectId && { isOrganized: true }),
        updatedAt: new Date(),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            projectType: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Update conversation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
