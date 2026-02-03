import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ArtifactType } from "@/generated/prisma/client";

// Validation schema for creating/upserting an artifact
const createArtifactSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["code", "component", "config"]).optional().default("code"),
  title: z.string().min(1).max(200),
  content: z.string().max(500000), // Allow large code files
  language: z.string().max(50).optional(),
  totalQuestions: z.number().int().min(0).max(10).optional().default(0),
});

// Format artifact for API response
function formatArtifact(artifact: {
  id: string;
  conversationId: string;
  userId: string;
  type: ArtifactType;
  title: string;
  content: string;
  language: string | null;
  version: number;
  unlockLevel: number;
  totalQuestions: number;
  quizHistory: unknown;
  currentQuiz: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: artifact.id,
    conversationId: artifact.conversationId,
    type: artifact.type,
    title: artifact.title,
    content: artifact.content,
    language: artifact.language,
    version: artifact.version,
    unlockLevel: artifact.unlockLevel,
    totalQuestions: artifact.totalQuestions,
    quizHistory: artifact.quizHistory || [],
    currentQuiz: artifact.currentQuiz,
    isUnlocked: artifact.totalQuestions === 0 || artifact.unlockLevel >= artifact.totalQuestions,
    createdAt: artifact.createdAt.toISOString(),
    updatedAt: artifact.updatedAt.toISOString(),
  };
}

// GET /api/conversations/[id]/artifacts - List all artifacts for a conversation
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

    const { id: conversationId } = await params;

    // Verify conversation ownership
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "会話が見つかりません" } },
        { status: 404 }
      );
    }

    // Get all artifacts for this conversation
    const artifacts = await prisma.artifact.findMany({
      where: {
        conversationId,
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Get activeArtifactId from conversation metadata if available
    const metadata = conversation.metadata as { generationState?: { activeArtifactId?: string | null } } | null;
    const activeArtifactId = metadata?.generationState?.activeArtifactId || null;

    return NextResponse.json({
      success: true,
      data: {
        items: artifacts.map(formatArtifact),
        total: artifacts.length,
        activeArtifactId,
      },
    });
  } catch (error) {
    console.error("Get artifacts error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "アーティファクトの取得に失敗しました" } },
      { status: 500 }
    );
  }
}

// POST /api/conversations/[id]/artifacts - Create or update (upsert) an artifact
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

    const { id: conversationId } = await params;

    // Verify conversation ownership
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "会話が見つかりません" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createArtifactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "入力形式が正しくありません", details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if artifact already exists
    const existing = await prisma.artifact.findFirst({
      where: {
        id: data.id,
        conversationId,
      },
    });

    let artifact;

    if (existing) {
      // Update existing artifact - increment version
      artifact = await prisma.artifact.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          content: data.content,
          language: data.language,
          type: data.type,
          version: { increment: 1 },
          // Don't update totalQuestions if artifact exists (preserve progress)
        },
      });
    } else {
      // Create new artifact
      artifact = await prisma.artifact.create({
        data: {
          id: data.id,
          conversationId,
          userId: session.user.id,
          type: data.type,
          title: data.title,
          content: data.content,
          language: data.language,
          totalQuestions: data.totalQuestions,
          unlockLevel: 0,
          quizHistory: [],
          currentQuiz: Prisma.JsonNull,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: formatArtifact(artifact),
    });
  } catch (error) {
    console.error("Create/update artifact error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "アーティファクトの保存に失敗しました" } },
      { status: 500 }
    );
  }
}
