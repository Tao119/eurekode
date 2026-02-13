import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

// Validation schema for dialogue evaluation
const evaluateDialogueSchema = z.object({
  question: z.string().min(1),
  userAnswer: z.string().min(1),
  codeSnippet: z.string().optional(),
  codeLanguage: z.string().optional(),
});

// POST /api/artifacts/[id]/dialogue - Evaluate user's dialogue answer
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

    const { id: artifactId } = await params;
    const body = await request.json();
    const validated = evaluateDialogueSchema.parse(body);

    // Find the artifact
    const artifact = await prisma.artifact.findFirst({
      where: {
        id: artifactId,
        userId: session.user.id,
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "アーティファクトが見つかりません" } },
        { status: 404 }
      );
    }

    // Evaluate the user's answer using Claude
    const client = new Anthropic();
    const evaluationPrompt = `あなたはプログラミング教育の専門家です。ユーザーの回答がコードの理解を示しているか評価してください。

【質問】
${validated.question}

${validated.codeSnippet ? `【参照コード】
\`\`\`${validated.codeLanguage || ""}
${validated.codeSnippet}
\`\`\`` : ""}

【ユーザーの回答】
${validated.userAnswer}

【評価基準】
- コードの目的や動作を理解しているか
- 「なぜ」その実装になっているかを説明できているか
- 技術的に正確な理解を示しているか

【出力形式】
以下のJSON形式で出力してください。JSONのみを出力し、他のテキストは含めないでください。

{
  "isCorrect": true/false,
  "feedback": "フィードバックメッセージ（50文字以内）",
  "explanation": "詳細な解説（必要に応じて）"
}

【重要】
- 完璧な回答を求めない。大まかな理解が示されていればtrueとする
- 曖昧な回答や的外れな回答はfalseとする
- フィードバックは励ましの言葉を含め、具体的な改善点を示す`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: evaluationPrompt }],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { success: false, error: { code: "EVALUATION_FAILED", message: "評価に失敗しました" } },
        { status: 500 }
      );
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: { code: "PARSE_ERROR", message: "評価結果の解析に失敗しました" } },
        { status: 500 }
      );
    }

    const evaluation = JSON.parse(jsonMatch[0]) as {
      isCorrect: boolean;
      feedback: string;
      explanation?: string;
    };

    // If correct, update the artifact progress
    if (evaluation.isCorrect) {
      const newUnlockLevel = artifact.unlockLevel + 1;
      const isFullyUnlocked = newUnlockLevel >= artifact.totalQuestions;

      await prisma.artifact.update({
        where: { id: artifactId },
        data: {
          unlockLevel: newUnlockLevel,
          quizHistory: {
            push: {
              level: artifact.unlockLevel,
              question: validated.question,
              userAnswer: validated.userAnswer,
              isCorrect: true,
              type: "dialogue",
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          isCorrect: true,
          feedback: evaluation.feedback,
          explanation: evaluation.explanation,
          unlockLevel: newUnlockLevel,
          isFullyUnlocked,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        isCorrect: false,
        feedback: evaluation.feedback,
        explanation: evaluation.explanation,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "入力が不正です" } },
        { status: 400 }
      );
    }

    console.error("Dialogue evaluation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "評価に失敗しました" } },
      { status: 500 }
    );
  }
}

// GET /api/artifacts/[id]/dialogue - Get dialogue question for artifact
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

    const { id: artifactId } = await params;

    // Find the artifact
    const artifact = await prisma.artifact.findFirst({
      where: {
        id: artifactId,
        userId: session.user.id,
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "アーティファクトが見つかりません" } },
        { status: 404 }
      );
    }

    // Generate a dialogue question based on the code
    const client = new Anthropic();
    const generatePrompt = `あなたはプログラミング教育の専門家です。以下のコードについて、ユーザーの理解度を確認するための質問を1つ生成してください。

【ファイル名】${artifact.title}
【言語】${artifact.language || "不明"}

【コード】
\`\`\`${artifact.language || ""}
${artifact.content}
\`\`\`

【現在のレベル】
${artifact.unlockLevel + 1}/${artifact.totalQuestions}（${artifact.unlockLevel}問正解済み）

【出力形式】
以下のJSON形式で出力してください。JSONのみを出力し、他のテキストは含めないでください。

{
  "question": "なぜ〜していますか？形式の質問",
  "codeSnippet": "質問が参照するコード部分（5-10行）",
  "codeLanguage": "${artifact.language || "javascript"}"
}

【重要なルール】
1. 質問は「なぜ〜していますか？」形式にする
2. コード内の具体的な実装について質問する
3. 前回の質問と被らないようにする（unlockLevelを考慮）
4. codeSnippetには質問に関連するコード部分を必ず含める`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: generatePrompt }],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_FAILED", message: "質問の生成に失敗しました" } },
        { status: 500 }
      );
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: { code: "PARSE_ERROR", message: "質問の解析に失敗しました" } },
        { status: 500 }
      );
    }

    const question = JSON.parse(jsonMatch[0]) as {
      question: string;
      codeSnippet?: string;
      codeLanguage?: string;
    };

    return NextResponse.json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error("Dialogue question generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "質問の生成に失敗しました" } },
      { status: 500 }
    );
  }
}
