import NextAuth from "next-auth";
import type { NextAuthConfig, Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { UserType } from "@/generated/prisma/client";
import type { SubscriptionPlan } from "@/types/user";

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
    maxAge: 60 * 60, // 1 hour
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
    error: "/login",
  },
  providers: [
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

        // Check email verification for individual/admin users
        if (
          (user.userType === "individual" || user.userType === "admin") &&
          !user.emailVerified
        ) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

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
    async jwt({ token, user }) {
      const extendedToken = token as ExtendedJWT & typeof token;
      if (user) {
        extendedToken.id = user.id;
        extendedToken.email = user.email;
        extendedToken.displayName = user.displayName;
        extendedToken.userType = user.userType;
        extendedToken.organizationId = user.organizationId;

        // Get subscription info
        const subscription = await prisma.subscription.findFirst({
          where: {
            OR: [
              { userId: user.id },
              { organizationId: user.organizationId || undefined },
            ],
          },
        });

        // Use organization plan if available, otherwise individual plan
        extendedToken.plan = subscription?.organizationPlan
          ?? subscription?.individualPlan
          ?? "free";

        // Get daily token limit from access key if exists, otherwise use plan default
        const accessKey = await prisma.accessKey.findFirst({
          where: { userId: user.id },
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
