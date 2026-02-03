import { prisma } from "./prisma";

export interface TokenLimitCheck {
  allowed: boolean;
  currentUsage: number;
  dailyLimit: number;
  remaining: number;
}

/**
 * Check if user has enough tokens remaining for an operation
 * @param userId - The user ID to check
 * @param requiredTokens - Number of tokens required for the operation
 * @returns TokenLimitCheck object with usage details
 */
export async function checkTokenLimit(
  userId: string,
  requiredTokens: number = 0
): Promise<TokenLimitCheck> {
  // Get user's daily token limit from associated AccessKey
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accessKey: {
        select: { dailyTokenLimit: true },
      },
    },
  });

  // Default limit: use AccessKey's dailyTokenLimit, or fall back to env var or default
  const defaultLimit = Number(process.env.DEFAULT_DAILY_TOKEN_LIMIT) || 10000;
  const dailyLimit = user?.accessKey?.dailyTokenLimit || defaultLimit;

  // Get today's usage
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tokenUsage = await prisma.tokenUsage.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  const currentUsage = tokenUsage?.tokensUsed || 0;
  const remaining = Math.max(0, dailyLimit - currentUsage);
  const allowed = remaining >= requiredTokens;

  return {
    allowed,
    currentUsage,
    dailyLimit,
    remaining,
  };
}

/**
 * Estimate tokens from content length (1 token ≈ 4 characters)
 */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

/**
 * Update token usage for a user
 */
export async function updateTokenUsage(
  userId: string,
  tokens: number,
  category: string = "learning"
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.tokenUsage.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    create: {
      userId,
      date: today,
      tokensUsed: tokens,
      breakdown: { [category]: tokens },
    },
    update: {
      tokensUsed: { increment: tokens },
    },
  });

  // Update the breakdown separately to handle JSON update
  const existingUsage = await prisma.tokenUsage.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existingUsage) {
    const breakdown = (existingUsage.breakdown as Record<string, number>) || {};
    breakdown[category] = (breakdown[category] || 0) + tokens;
    await prisma.tokenUsage.update({
      where: { userId_date: { userId, date: today } },
      data: { breakdown },
    });
  }
}

// Error code for token limit exceeded
export const TOKEN_LIMIT_EXCEEDED_CODE = "TOKEN_LIMIT_EXCEEDED";
