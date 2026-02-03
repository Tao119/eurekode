import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const organizeRequestSchema = z.union([
  // 既存プロジェクトに紐づける
  z.object({
    projectId: z.string(),
    createProject: z.undefined().optional(),
    convertToLearning: z.undefined().optional(),
  }),
  // 新規プロジェクトを作成して紐づける
  z.object({
    projectId: z.undefined().optional(),
    createProject: z.object({
      name: z.string().min(1).max(200),
      projectType: z.enum(["product", "learning"]),
      description: z.string().max(2000).optional(),
    }),
    convertToLearning: z.undefined().optional(),
  }),
  // 会話を学びに変換（プロジェクトなし）
  z.object({
    projectId: z.undefined().optional(),
    createProject: z.undefined().optional(),
    convertToLearning: z.literal(true),
  }),
]);

// PUT: 会話をプロジェクトに紐づけ/整理
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
    const parsed = organizeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // 会話の所有権を確認
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "会話が見つかりません" } },
        { status: 404 }
      );
    }

    const data = parsed.data;

    // 既存プロジェクトに紐づける
    if ("projectId" in data && data.projectId) {
      // プロジェクトの所有権を確認
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId },
      });

      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
          { status: 404 }
        );
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: {
          projectId: data.projectId,
          isOrganized: true,
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
        data: {
          id: updated.id,
          projectId: updated.projectId,
          isOrganized: updated.isOrganized,
          project: updated.project,
        },
      });
    }

    // 新規プロジェクトを作成して紐づける
    if ("createProject" in data && data.createProject) {
      const { name, projectType, description } = data.createProject;

      // トランザクションでプロジェクト作成と会話更新を同時に行う
      const result = await prisma.$transaction(async (tx) => {
        const newProject = await tx.project.create({
          data: {
            userId,
            title: name,
            description: description || null,
            projectType,
            currentPhase: projectType === "product" ? "planning" : null,
            status: "planning",
          },
        });

        const updatedConversation = await tx.conversation.update({
          where: { id },
          data: {
            projectId: newProject.id,
            isOrganized: true,
          },
        });

        return {
          project: newProject,
          conversation: updatedConversation,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          id: result.conversation.id,
          projectId: result.project.id,
          isOrganized: true,
          project: {
            id: result.project.id,
            title: result.project.title,
            projectType: result.project.projectType,
          },
          createdProject: true,
        },
      });
    }

    // 学びに変換（プロジェクトなしで整理済みにする）
    if ("convertToLearning" in data && data.convertToLearning) {
      // 会話から学びを抽出してLearningテーブルに保存
      const messages = conversation.messages as Array<{
        role: "user" | "assistant";
        content: string;
      }> | null;

      if (messages && messages.length > 0) {
        // アシスタントの回答を学びとして保存
        const assistantMessages = messages.filter((m) => m.role === "assistant");

        if (assistantMessages.length > 0) {
          // 最初のアシスタント回答を要約として保存
          const learningContent = assistantMessages[0].content.slice(0, 1000);

          await prisma.learning.create({
            data: {
              userId,
              conversationId: id,
              content: learningContent,
              type: "reflection",
              tags: [conversation.mode],
            },
          });
        }
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: {
          isOrganized: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          projectId: null,
          isOrganized: true,
          convertedToLearning: true,
        },
      });
    }

    // ここには到達しないはず
    return NextResponse.json(
      { success: false, error: { code: "INVALID_REQUEST", message: "無効なリクエストです" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Organize conversation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "会話の整理に失敗しました" } },
      { status: 500 }
    );
  }
}

// DELETE: 会話のプロジェクト紐づけを解除
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
    const userId = session.user.id;

    // 会話の所有権を確認
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "会話が見つかりません" } },
        { status: 404 }
      );
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        projectId: null,
        isOrganized: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        projectId: null,
        isOrganized: false,
      },
    });
  } catch (error) {
    console.error("Unlink conversation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "紐づけの解除に失敗しました" } },
      { status: 500 }
    );
  }
}
