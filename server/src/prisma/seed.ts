import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth.js";

const prisma = new PrismaClient();

async function main() {
  // Create admin user via Better Auth
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });

  if (!existingAdmin) {
    const { user } = await auth.api.signUpEmail({
      body: {
        name: "Admin",
        email: "admin@example.com",
        password: "admin123!",
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN", emailVerified: true },
    });
    console.log("Created admin:", user.email);
  } else {
    console.log("Admin already exists:", existingAdmin.email);
  }

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
