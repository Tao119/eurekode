import NextAuth from "next-auth";
import type { NextAuthConfig, Session, Account, Profile } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";
import type { UserType } from "@/generated/prisma/client";
import type { SubscriptionPlan } from "@/types/user";

// Cookie name for access key (used in Google OAuth flow for members)
const ACCESS_KEY_COOKIE = "pending_access_key";

// Token limits by plan (using monthly conversation points as proxy)
const TOKEN_LIMITS: Record<SubscriptionPlan, number> = {
  // Individual plans
  free: 30,
  starter: 300,
  pro: 900,
  max: 3000,
  // Organization plans (overlap with 'free' and 'starter' handled by individual)
  business: 15000,
  enterprise: 999999,
};

// Extend session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string | null;
      displayName: string;
      userType: UserType;
      organizationId: string | null;
      plan: SubscriptionPlan;
      dailyTokenLimit: number;
    };
  }

  interface User {
    id: string;
    email: string | null;
    displayName: string;
    userType: UserType;
    organizationId: string | null;
  }
}

// JWT type extension for NextAuth v5
interface ExtendedJWT {
  id: string;
  email: string | null;
  displayName: string;
  userType: UserType;
  organizationId: string | null;
  plan: SubscriptionPlan;
  dailyTokenLimit: number;
}

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginTokenSchema = z.object({
  loginToken: z.string().min(1),
});

const accessKeySchema = z.object({
  keyCode: z.string().regex(/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/),
  displayName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export const authConfig: NextAuthConfig = {
  // Note: No adapter needed for Credentials-only + JWT strategy
  // Database operations are handled manually in authorize callbacks
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
    error: "/login",
  },
  providers: [
    // Google OAuth Provider
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    // Login Token authentication (for auto-login after payment)
    Credentials({
      id: "login-token",
      name: "Login Token",
      credentials: {
        loginToken: { label: "Login Token", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginTokenSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { loginToken } = parsed.data;

        // Find the login token in VerificationToken table
        const tokenRecord = await prisma.verificationToken.findFirst({
          where: {
            token: loginToken,
            identifier: { startsWith: "login:" },
          },
        });

        if (!tokenRecord) {
          return null;
        }

        // Check expiration
        if (tokenRecord.expires < new Date()) {
          // Delete expired token
          await prisma.verificationToken.delete({
            where: {
              identifier_token: {
                identifier: tokenRecord.identifier,
                token: loginToken,
              },
            },
          });
          return null;
        }

        // Extract email from identifier (format: "login:email@example.com")
        const email = tokenRecord.identifier.replace("login:", "");

        // Find the user
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        // Delete the token (one-time use)
        await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: tokenRecord.identifier,
              token: loginToken,
            },
          },
        });

        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          userType: user.userType,
          organizationId: user.organizationId,
        };
      },
    }),
    // Email/Password authentication
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            subscription: true,
            accessKey: true,
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Email verification disabled - skip check
        // if (
        //   (user.userType === "individual" || user.userType === "admin") &&
        //   !user.emailVerified
        // ) {
        //   throw new Error("EMAIL_NOT_VERIFIED");
        // }

        // Check if member is disabled
        if (user.userType === "member") {
          const userSettings = user.settings as { isEnabled?: boolean } | null;
          if (userSettings?.isEnabled === false) {
            throw new Error("ACCOUNT_DISABLED");
          }
        }

        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          userType: user.userType,
          organizationId: user.organizationId,
        };
      },
    }),
    // Access Key authentication (first-time registration with email/password)
    Credentials({
      id: "access-key",
      name: "Access Key",
      credentials: {
        keyCode: { label: "Access Key", type: "text" },
        displayName: { label: "Display Name", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = accessKeySchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { keyCode, displayName, email, password } = parsed.data;

        // Find the access key
        const accessKey = await prisma.accessKey.findUnique({
          where: { keyCode },
          include: {
            organization: true,
            user: true,
          },
        });

        if (!accessKey) {
          throw new Error("INVALID_KEY");
        }

        // Check key status
        if (accessKey.status === "revoked") {
          throw new Error("INVALID_KEY");
        }

        if (accessKey.status === "expired") {
          throw new Error("KEY_EXPIRED");
        }

        // Check expiration
        if (accessKey.expiresAt && accessKey.expiresAt < new Date()) {
          // Update status to expired
          await prisma.accessKey.update({
            where: { id: accessKey.id },
            data: { status: "expired" },
          });
          throw new Error("KEY_EXPIRED");
        }

        // If key already has a user with email registered, it's already used
        if (accessKey.user && accessKey.user.email) {
          throw new Error("KEY_ALREADY_REGISTERED");
        }

        // For new registration, email and password are required
        if (!email || !password) {
          throw new Error("EMAIL_PASSWORD_REQUIRED");
        }

        // Check if email is already used by another user
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });
        if (existingUser) {
          throw new Error("EMAIL_ALREADY_EXISTS");
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        let targetUser;

        // Check if this is a re-registration (key has user but no email/password)
        if (accessKey.user && !accessKey.user.email) {
          // Re-registration: Update existing user with new credentials
          targetUser = await prisma.user.update({
            where: { id: accessKey.user.id },
            data: {
              email,
              passwordHash,
              displayName,
              emailVerified: new Date(), // Auto-verify for access key registration
            },
          });
        } else {
          // First registration: Create new member user with email and password
          targetUser = await prisma.user.create({
            data: {
              email,
              passwordHash,
              displayName,
              userType: "member",
              organizationId: accessKey.organizationId,
              emailVerified: new Date(), // Auto-verify for access key registration
            },
          });
        }

        // Update access key
        await prisma.accessKey.update({
          where: { id: accessKey.id },
          data: {
            userId: targetUser.id,
            usedAt: new Date(),
            status: "used",
          },
        });

        // Create CreditAllocation for the member based on the access key's dailyTokenLimit
        if (accessKey.dailyTokenLimit && accessKey.organizationId) {
          const now = new Date();
          const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

          await prisma.creditAllocation.upsert({
            where: {
              organizationId_userId_periodStart: {
                organizationId: accessKey.organizationId,
                userId: targetUser.id,
                periodStart,
              },
            },
            update: {
              allocatedPoints: accessKey.dailyTokenLimit,
            },
            create: {
              organizationId: accessKey.organizationId,
              userId: targetUser.id,
              allocatedPoints: accessKey.dailyTokenLimit,
              usedPoints: 0,
              periodStart,
              periodEnd,
              note: `アクセスキー ${keyCode} による自動割り当て`,
            },
          });
        }

        return {
          id: targetUser.id,
          email: targetUser.email,
          displayName: targetUser.displayName,
          userType: targetUser.userType,
          organizationId: targetUser.organizationId,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: { user: any; account?: Account | null; profile?: Profile }) {
      // Only handle Google OAuth
      if (account?.provider !== "google") {
        return true;
      }

      const email = profile?.email;
      if (!email) {
        return false;
      }

      try {
        // Check for pending access key in cookie (for member registration)
        const cookieStore = await cookies();
        const pendingAccessKey = cookieStore.get(ACCESS_KEY_COOKIE)?.value;

        if (pendingAccessKey) {
          // Access key flow: Create member user
          const accessKey = await prisma.accessKey.findUnique({
            where: { keyCode: pendingAccessKey },
            include: { organization: true, user: true },
          });

          if (!accessKey || accessKey.status !== "active") {
            // Invalid or already used key
            cookieStore.delete(ACCESS_KEY_COOKIE);
            return "/join?error=INVALID_KEY";
          }

          if (accessKey.expiresAt && accessKey.expiresAt < new Date()) {
            await prisma.accessKey.update({
              where: { id: accessKey.id },
              data: { status: "expired" },
            });
            cookieStore.delete(ACCESS_KEY_COOKIE);
            return "/join?error=KEY_EXPIRED";
          }

          // Check if email is already used
          const existingUser = await prisma.user.findUnique({ where: { email } });
          if (existingUser) {
            cookieStore.delete(ACCESS_KEY_COOKIE);
            return "/join?error=EMAIL_ALREADY_EXISTS";
          }

          // Create member user with Google account
          const newMember = await prisma.user.create({
            data: {
              email,
              displayName: profile?.name || email.split("@")[0],
              userType: "member",
              organizationId: accessKey.organizationId,
              emailVerified: new Date(),
              accounts: {
                create: {
                  type: "oauth",
                  provider: "google",
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                },
              },
            },
          });

          // Update access key
          await prisma.accessKey.update({
            where: { id: accessKey.id },
            data: {
              userId: newMember.id,
              usedAt: new Date(),
              status: "used",
            },
          });

          // Create CreditAllocation
          if (accessKey.dailyTokenLimit && accessKey.organizationId) {
            const now = new Date();
            const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            await prisma.creditAllocation.upsert({
              where: {
                organizationId_userId_periodStart: {
                  organizationId: accessKey.organizationId,
                  userId: newMember.id,
                  periodStart,
                },
              },
              update: { allocatedPoints: accessKey.dailyTokenLimit },
              create: {
                organizationId: accessKey.organizationId,
                userId: newMember.id,
                allocatedPoints: accessKey.dailyTokenLimit,
                usedPoints: 0,
                periodStart,
                periodEnd,
                note: `アクセスキー ${pendingAccessKey} による自動割り当て（Google認証）`,
              },
            });
          }

          // Clear the cookie
          cookieStore.delete(ACCESS_KEY_COOKIE);

          // Set user info for JWT
          user.id = newMember.id;
          user.email = newMember.email;
          user.displayName = newMember.displayName;
          user.userType = newMember.userType;
          user.organizationId = newMember.organizationId;

          return true;
        }

        // Normal flow: Individual user login/registration
        const existingUser = await prisma.user.findUnique({
          where: { email },
          include: { accounts: true },
        });

        if (existingUser) {
          // Existing user: Link Google account if not already linked
          const hasGoogleAccount = existingUser.accounts.some(
            (acc) => acc.provider === "google"
          );

          if (!hasGoogleAccount) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: "oauth",
                provider: "google",
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }

          user.id = existingUser.id;
          user.email = existingUser.email;
          user.displayName = existingUser.displayName;
          user.userType = existingUser.userType;
          user.organizationId = existingUser.organizationId;

          return true;
        }

        // New user: Create individual user with free plan + 14 days trial
        const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        const newUser = await prisma.user.create({
          data: {
            email,
            displayName: profile?.name || email.split("@")[0],
            userType: "individual",
            emailVerified: new Date(),
            accounts: {
              create: {
                type: "oauth",
                provider: "google",
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            },
            subscription: {
              create: {
                individualPlan: "free",
                status: "active",
                trialEnd: trialEndDate,
                currentPeriodStart: new Date(),
                currentPeriodEnd: trialEndDate,
              },
            },
          },
        });

        user.id = newUser.id;
        user.email = newUser.email;
        user.displayName = newUser.displayName;
        user.userType = newUser.userType;
        user.organizationId = newUser.organizationId;

        return true;
      } catch (error) {
        console.error("Google OAuth signIn error:", error);
        return false;
      }
    },
    async jwt({ token, user, trigger }) {
      const extendedToken = token as ExtendedJWT & typeof token;

      // 初回ログイン時、またはセッション更新リクエスト時にユーザー情報を取得
      if (user) {
        extendedToken.id = user.id;
        extendedToken.email = user.email;
        extendedToken.displayName = user.displayName;
        extendedToken.userType = user.userType;
        extendedToken.organizationId = user.organizationId;
      }

      // セッション更新時（updateSession()呼び出し時）にDBから最新情報を取得
      if (trigger === "update" && extendedToken.id) {
        const freshUser = await prisma.user.findUnique({
          where: { id: extendedToken.id },
          select: {
            email: true,
            displayName: true,
            userType: true,
            organizationId: true,
          },
        });
        if (freshUser) {
          extendedToken.email = freshUser.email;
          extendedToken.displayName = freshUser.displayName;
          extendedToken.userType = freshUser.userType;
          extendedToken.organizationId = freshUser.organizationId;
        }
      }

      // サブスクリプション情報を取得
      if (extendedToken.id) {
        const subscription = await prisma.subscription.findFirst({
          where: {
            OR: [
              { userId: extendedToken.id },
              { organizationId: extendedToken.organizationId || undefined },
            ],
          },
        });

        // Use organization plan if available, otherwise individual plan
        extendedToken.plan = subscription?.organizationPlan
          ?? subscription?.individualPlan
          ?? "free";

        // Get daily token limit from access key if exists, otherwise use plan default
        const accessKey = await prisma.accessKey.findFirst({
          where: { userId: extendedToken.id },
        });
        extendedToken.dailyTokenLimit =
          accessKey?.dailyTokenLimit || TOKEN_LIMITS[extendedToken.plan];
      }

      return extendedToken;
    },
    async session({ session, token }) {
      const extendedToken = token as unknown as ExtendedJWT;
      // Assign custom user properties to session
      (session.user as Session["user"]) = {
        id: extendedToken.id,
        email: extendedToken.email,
        displayName: extendedToken.displayName,
        userType: extendedToken.userType,
        organizationId: extendedToken.organizationId,
        plan: extendedToken.plan,
        dailyTokenLimit: extendedToken.dailyTokenLimit,
      };
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Redirect to appropriate dashboard based on user type
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return baseUrl;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
