import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "change-me-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[Password Reset] To: ${user.email}\nReset URL: ${url}`);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      console.log(
        `[Email Verification] To: ${user.email}\nVerification URL: ${url}`
      );
    },
    sendOnSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "AGENT",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24, // 24 hours
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:5173"],
});

export type Session = typeof auth.$Infer.Session;
