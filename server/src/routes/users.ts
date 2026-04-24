import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";
import { requireAdmin } from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(requireAdmin);

const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  role: z.enum(["ADMIN", "AGENT"]).optional(),
});

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

usersRouter.post("/", async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const ctx = await auth.$context;
  const hashed = await ctx.password.hash(password);
  const id = crypto.randomUUID();
  const now = new Date();

  const user = await prisma.user.create({
    data: { id, name, email, emailVerified: true, createdAt: now, updatedAt: now },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    },
  });

  res.status(201).json(user);
});

usersRouter.patch("/:id", async (req, res) => {
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { name, email, password, role } = result.data;

  if (password) {
    const account = await prisma.account.findFirst({
      where: { userId: req.params.id, providerId: "credential" },
    });
    if (!account) {
      res.status(404).json({ error: "User credential account not found" });
      return;
    }
    const ctx = await auth.$context;
    const hashed = await ctx.password.hash(password);
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashed },
    });
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (role) updateData.role = role;

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: "User not found" });
  }
});

usersRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    res.json({ message: "User deleted" });
  } catch {
    res.status(404).json({ error: "User not found" });
  }
});
