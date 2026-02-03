import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// 生成モードのアーティファクト進行状況（動的なクイズ数に対応）
const artifactProgressSchema = z.record(z.string(), z.object({
  unlockLevel: z.number().min(0), // 0から始まり、totalQuestionsまで
  totalQuestions: z.number().min(0).max(10).optional(), // 動的なクイズ数（0=即アンロック）
  currentQuiz: z.any().nullable(),
  quizHistory: z.array(z.object({
    level: z.number(),
    question: z.string(),
    userAnswer: z.string(),
    isCorrect: z.boolean(),
  })),
}));

// メタデータスキーマ
const conversationMetadataSchema = z.object({
  options: z.any().optional(),
  state: z.any().optional(),
  branchState: z.any().optional(),
  brainstormState: z.any().optional(),
  lastActiveBranchId: z.string().optional(),
  // 生成モード用の追加フィールド（動的なクイズ数に対応）
  generationState: z.object({
    phase: z.string().optional(),
    unlockLevel: z.number().min(0).optional(), // 0から始まる
    totalQuestions: z.number().min(0).max(10).optional(), // 動的なクイズ数
    artifacts: z.any().optional(),
    activeArtifactId: z.string().nullable().optional(),
    artifactProgress: artifactProgressSchema.optional(),
    quizHistory: z.array(z.any()).optional(),
  }).optional(),
}).passthrough();

const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  projectId: z.string().uuid().nullable().optional(),
  isOrganized: z.boolean().optional(),
  metadata: conversationMetadataSchema.optional(),
});

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

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "会話が見つかりません" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

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

    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// Update conversation (title, projectId, isOrganized)
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
    const parsed = updateConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

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

    // If projectId is provided, verify project ownership
    if (parsed.data.projectId !== undefined && parsed.data.projectId !== null) {
      const project = await prisma.project.findFirst({
        where: { id: parsed.data.projectId, userId: session.user.id },
      });

      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
          { status: 404 }
        );
      }
    }

    // メタデータの更新処理
    let metadataUpdate: Record<string, unknown> | undefined = undefined;
    if (parsed.data.metadata !== undefined) {
      // 既存のメタデータとマージ
      const existingMetadata = (existing.metadata as Record<string, unknown>) || {};
      metadataUpdate = {
        ...existingMetadata,
        ...parsed.data.metadata,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (parsed.data.title !== undefined) {
      updateData.title = parsed.data.title;
    }
    if (parsed.data.projectId !== undefined) {
      updateData.projectId = parsed.data.projectId;
    }
    if (parsed.data.isOrganized !== undefined) {
      updateData.isOrganized = parsed.data.isOrganized;
    }
    if (metadataUpdate !== undefined) {
      updateData.metadata = metadataUpdate;
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: updateData,
    });

    // Fetch project separately if needed
    let projectData = null;
    if (conversation.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: conversation.projectId },
        select: { id: true, title: true },
      });
      projectData = project;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: conversation.id,
        mode: conversation.mode,
        title: conversation.title,
        projectId: conversation.projectId,
        project: projectData,
        isOrganized: conversation.isOrganized,
        metadata: conversation.metadata,
        updatedAt: conversation.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Update conversation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "会話の更新に失敗しました" } },
      { status: 500 }
    );
  }
}
