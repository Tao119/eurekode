import NextAuth from "next-auth";
import type { NextAuthConfig, Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { UserType, SubscriptionPlan } from "@/generated/prisma/client";

// Token limits by plan
const TOKEN_LIMITS: Record<SubscriptionPlan, number> = {
  free: 100,
  basic: 500,
  pro: 2000,
  unlimited: 999999,
  team: 2000,
  school: 1000,
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

        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          userType: user.userType,
          organizationId: user.organizationId,
        };
      },
    }),
    // Access Key authentication
    Credentials({
      id: "access-key",
      name: "Access Key",
      credentials: {
        keyCode: { label: "Access Key", type: "text" },
        displayName: { label: "Display Name", type: "text" },
      },
      async authorize(credentials) {
        const parsed = accessKeySchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { keyCode, displayName } = parsed.data;

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

        // If key already has a user, return that user
        if (accessKey.user) {
          return {
            id: accessKey.user.id,
            email: accessKey.user.email,
            displayName: accessKey.user.displayName,
            userType: accessKey.user.userType,
            organizationId: accessKey.user.organizationId,
          };
        }

        // Create new member user
        const newUser = await prisma.user.create({
          data: {
            displayName,
            userType: "member",
            organizationId: accessKey.organizationId,
          },
        });

        // Update access key
        await prisma.accessKey.update({
          where: { id: accessKey.id },
          data: {
            userId: newUser.id,
            usedAt: new Date(),
            status: "used",
          },
        });

        return {
          id: newUser.id,
          email: null,
          displayName: newUser.displayName,
          userType: newUser.userType,
          organizationId: newUser.organizationId,
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

        extendedToken.plan = subscription?.plan || "free";

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
