import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";
import { requireAdmin } from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(requireAdmin);

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  // Create user via Better Auth so credentials are stored correctly
  const signUpResult = await auth.api.signUpEmail({
    body: { name, email, password },
  });

  // Mark email as verified (admin-created users skip verification)
  // and ensure role defaults to AGENT
  await prisma.user.update({
    where: { id: signUpResult.user.id },
    data: { emailVerified: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: signUpResult.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json(user);
});

usersRouter.patch("/:id", async (req, res) => {
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { name, email, password } = result.data;

  if (password) {
    // Update the credential Account's password via Better Auth context
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
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: "User deleted" });
  } catch {
    res.status(404).json({ error: "User not found" });
  }
});
