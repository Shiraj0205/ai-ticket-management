import { PrismaClient, Role } from "@prisma/client";
import { auth } from "../lib/auth.js";

enum AuthProvider {
  Credential = "credential",
}

const prisma = new PrismaClient();

async function createUser(
  name: string,
  email: string,
  password: string,
  role: Role
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${role} already exists:`, email);
    return;
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);
  const id = crypto.randomUUID();

  await prisma.user.create({
    data: { id, name, email, role, emailVerified: true },
  });

  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: id,
      providerId: AuthProvider.Credential,
      userId: id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`Created ${role.toLowerCase()}:`, email);
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env");
  }

  await createUser("Admin", adminEmail, adminPassword, Role.ADMIN);
  await createUser("Agent", "agent@example.com", "agent123!", Role.AGENT);

  // Seed knowledge base
  const entries = [
    {
      topic: "Refund Policy",
      content:
        "We offer full refunds within 30 days of purchase. After 30 days, we offer store credit. To request a refund, please provide your order number and reason for the refund.",
    },
    {
      topic: "Technical Support",
      content:
        "For technical issues, first try clearing your browser cache and cookies. If the issue persists, try a different browser. For account access issues, use the 'Forgot Password' link on the login page.",
    },
    {
      topic: "General Information",
      content:
        "Our support team is available Monday–Friday, 9am–5pm EST. Average response time is 24 hours. For urgent issues, please mark your ticket as high priority.",
    },
  ];

  for (const entry of entries) {
    await prisma.knowledgeBaseEntry.upsert({
      where: { id: entry.topic },
      update: { content: entry.content },
      create: entry,
    });
  }
  console.log("Seeded knowledge base entries");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
