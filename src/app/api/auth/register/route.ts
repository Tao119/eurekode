import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import type { ApiResponse } from "@/types/api";

const registerSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .regex(
      /^(?=.*[a-zA-Z])(?=.*\d)/,
      "パスワードは英字と数字を含める必要があります"
    ),
  displayName: z
    .string()
    .min(1, "表示名を入力してください")
    .max(100, "表示名は100文字以内で入力してください"),
  userType: z.enum(["individual", "admin"]),
  organizationName: z.string().optional(),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const { email, password, displayName, userType, organizationName } =
      parsed.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_EXISTS",
            message: "このメールアドレスは既に登録されています",
          },
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user (and organization if admin)
    if (userType === "admin") {
      if (!organizationName) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "組織名を入力してください",
            },
          },
          { status: 400 }
        );
      }

      // Create organization and admin user with 14-day Starter trial
      const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const organization = await prisma.organization.create({
        data: {
          name: organizationName,
          plan: "starter",
          settings: {
            allowedModes: ["explanation", "generation", "brainstorm"],
            allowedTechStacks: [],
            unlockSkipAllowed: false,
            reflectionRequired: false,
            defaultDailyTokenLimit: 1000,
          },
          users: {
            create: {
              email,
              passwordHash,
              displayName,
              userType: "admin",
              // emailVerified is NOT set - requires email verification
            },
          },
          subscription: {
            create: {
              organizationPlan: "starter",
              status: "active",
              trialEnd: trialEndDate,
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEndDate,
            },
          },
        },
        include: {
          users: true,
        },
      });

      // Generate verification token and send email
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires,
        },
      });

      // Send verification email
      try {
        await sendVerificationEmail(email, token);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue registration even if email fails - user can request resend
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            userId: organization.users[0].id,
            organizationId: organization.id,
            message: "アカウントが作成されました。メールアドレスの確認をお願いします。",
            requiresVerification: true,
          },
        },
        { status: 201 }
      );
    } else {
      // Create individual user with 14-day Starter trial
      const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName,
          userType: "individual",
          // emailVerified is NOT set - requires email verification
          subscription: {
            create: {
              individualPlan: "starter", // Start with Starter plan
              status: "active",
              trialEnd: trialEndDate, // 14-day trial
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEndDate,
            },
          },
        },
      });

      // Generate verification token and send email
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires,
        },
      });

      // Send verification email
      try {
        await sendVerificationEmail(email, token);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue registration even if email fails - user can request resend
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            userId: user.id,
            message: "アカウントが作成されました。メールアドレスの確認をお願いします。",
            requiresVerification: true,
            trialEnd: trialEndDate.toISOString(),
          },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "アカウントの作成に失敗しました",
        },
      },
      { status: 500 }
    );
  }
}
