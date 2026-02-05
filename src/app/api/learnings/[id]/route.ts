import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateLearningSchema = z.object({
  content: z.string().min(1, "内容を入力してください").max(10000, "内容が長すぎます").optional(),
  tags: z.array(z.string().min(1).max(50)).max(10, "タグは10個までです").optional(),
  memo: z.string().max(5000).optional().transform((val) => val?.trim() || null),
});

export async function GET(
  _request: NextRequest,
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

    const learning = await prisma.learning.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            mode: true,
          },
        },
      },
    });

    if (!learning) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "学びが見つかりません" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...learning,
        createdAt: learning.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Get learning error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

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
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }
    const parsed = updateLearningSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "Invalid request format",
          },
        },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.learning.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "学びが見つかりません" } },
        { status: 404 }
      );
    }

    const { content, tags, memo } = parsed.data;

    const learning = await prisma.learning.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(tags !== undefined && { tags }),
        ...(memo !== undefined && { memo }),
      },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            mode: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...learning,
        createdAt: learning.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Update learning error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
    const existing = await prisma.learning.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "学びが見つかりません" } },
        { status: 404 }
      );
    }

    await prisma.learning.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error("Delete learning error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
