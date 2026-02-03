import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { ProjectPhase, ProjectType } from "@/generated/prisma/client";

const updatePhaseSchema = z.object({
  phase: z.enum(["planning", "design", "development"]),
});

// フェーズの順序
const PHASE_ORDER: ProjectPhase[] = ["planning", "design", "development"];

// フェーズ遷移の検証
function validatePhaseTransition(
  currentPhase: ProjectPhase | null,
  targetPhase: ProjectPhase,
  projectType: ProjectType
): { valid: boolean; message?: string } {
  // 学習プロジェクトはフェーズ管理なし
  if (projectType === "learning") {
    return { valid: false, message: "学習プロジェクトにはフェーズ管理がありません" };
  }

  // 最初のフェーズ設定は常に許可
  if (currentPhase === null) {
    return { valid: true };
  }

  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  const targetIndex = PHASE_ORDER.indexOf(targetPhase);

  // 同じフェーズへの遷移は許可
  if (currentIndex === targetIndex) {
    return { valid: true };
  }

  // 前のフェーズへの遷移は許可（やり直し）
  if (targetIndex < currentIndex) {
    return { valid: true };
  }

  // 1つ先のフェーズへの遷移のみ許可
  if (targetIndex === currentIndex + 1) {
    return { valid: true };
  }

  return {
    valid: false,
    message: `フェーズは順番に進める必要があります（現在: ${currentPhase} → 次: ${PHASE_ORDER[currentIndex + 1]}）`,
  };
}

// GET: 現在のフェーズ情報を取得
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
      select: {
        id: true,
        projectType: true,
        currentPhase: true,
        ideaSummary: true,
        targetPersona: true,
        techStack: true,
        mvpFeatures: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
        { status: 404 }
      );
    }

    // 学習プロジェクトはフェーズ管理なし
    if (project.projectType === "learning") {
      return NextResponse.json({
        success: true,
        data: {
          projectType: project.projectType,
          currentPhase: null,
          phaseInfo: null,
        },
      });
    }

    // 各フェーズの完了条件をチェック
    const phaseStatus = {
      planning: {
        completed: !!(project.ideaSummary && project.targetPersona),
        requirements: ["ideaSummary", "targetPersona"],
        missing: [
          ...(!project.ideaSummary ? ["ideaSummary（アイデア概要）"] : []),
          ...(!project.targetPersona ? ["targetPersona（ターゲットペルソナ）"] : []),
        ],
      },
      design: {
        completed: !!(project.techStack.length > 0 && project.mvpFeatures.length > 0),
        requirements: ["techStack", "mvpFeatures"],
        missing: [
          ...(project.techStack.length === 0 ? ["techStack（技術スタック）"] : []),
          ...(project.mvpFeatures.length === 0 ? ["mvpFeatures（MVP機能）"] : []),
        ],
      },
      development: {
        completed: false, // 開発フェーズは手動で完了
        requirements: [],
        missing: [],
      },
    };

    const currentIndex = project.currentPhase ? PHASE_ORDER.indexOf(project.currentPhase) : -1;
    const nextPhase = currentIndex < PHASE_ORDER.length - 1 ? PHASE_ORDER[currentIndex + 1] : null;
    const canAdvance = nextPhase ? phaseStatus[project.currentPhase!]?.completed ?? false : false;

    return NextResponse.json({
      success: true,
      data: {
        projectType: project.projectType,
        currentPhase: project.currentPhase,
        phaseInfo: {
          phases: PHASE_ORDER,
          status: phaseStatus,
          currentIndex,
          nextPhase,
          canAdvance,
        },
      },
    });
  } catch (error) {
    console.error("Get project phase error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "フェーズ情報の取得に失敗しました" } },
      { status: 500 }
    );
  }
}

// PUT: フェーズを更新
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
    const parsed = updatePhaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { phase } = parsed.data;

    // プロジェクトを取得
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } },
        { status: 404 }
      );
    }

    // フェーズ遷移の検証
    const validation = validatePhaseTransition(project.currentPhase, phase, project.projectType);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_PHASE_TRANSITION", message: validation.message } },
        { status: 400 }
      );
    }

    // フェーズを更新
    const updated = await prisma.project.update({
      where: { id },
      data: {
        currentPhase: phase,
        // 開発フェーズに進んだらステータスをin_progressに
        ...(phase === "development" && project.status === "planning" && { status: "in_progress" }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        currentPhase: updated.currentPhase,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Update project phase error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "フェーズの更新に失敗しました" } },
      { status: 500 }
    );
  }
}
