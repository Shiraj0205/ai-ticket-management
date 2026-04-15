import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set to a random string of at least 32 characters. " +
    "Generate one with: node -e \"require('crypto').randomBytes(32).toString('base64')\""
  );
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret,
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
