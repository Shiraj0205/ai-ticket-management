import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash("admin123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@example.com",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("Created admin:", admin.email);

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
