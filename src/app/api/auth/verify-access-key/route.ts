import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types/api";

const ACCESS_KEY_COOKIE = "pending_access_key";

const verifyAccessKeySchema = z.object({
  keyCode: z.string().regex(/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const parsed = verifyAccessKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "無効なアクセスキー形式です",
          },
        },
        { status: 400 }
      );
    }

    const { keyCode } = parsed.data;

    // Find the access key
    const accessKey = await prisma.accessKey.findUnique({
      where: { keyCode },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!accessKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_KEY",
            message: "無効なアクセスキーです",
          },
        },
        { status: 400 }
      );
    }

    // Check key status
    if (accessKey.status === "revoked") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_KEY",
            message: "このアクセスキーは無効化されています",
          },
        },
        { status: 400 }
      );
    }

    if (accessKey.status === "expired") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "KEY_EXPIRED",
            message: "このアクセスキーは有効期限が切れています",
          },
        },
        { status: 400 }
      );
    }

    if (accessKey.status === "used") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "KEY_ALREADY_REGISTERED",
            message: "このアクセスキーは既に使用されています",
          },
        },
        { status: 400 }
      );
    }

    // Check expiration
    if (accessKey.expiresAt && accessKey.expiresAt < new Date()) {
      await prisma.accessKey.update({
        where: { id: accessKey.id },
        data: { status: "expired" },
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "KEY_EXPIRED",
            message: "このアクセスキーは有効期限が切れています",
          },
        },
        { status: 400 }
      );
    }

    // Store access key in cookie for Google OAuth callback (5 minutes)
    const cookieStore = await cookies();
    cookieStore.set(ACCESS_KEY_COOKIE, keyCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60, // 5 minutes
      path: "/",
    });

    return NextResponse.json({
      success: true,
      data: {
        organizationName: accessKey.organization.name,
      },
    });
  } catch (error) {
    console.error("Verify access key error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "サーバーエラーが発生しました",
        },
      },
      { status: 500 }
    );
  }
}
