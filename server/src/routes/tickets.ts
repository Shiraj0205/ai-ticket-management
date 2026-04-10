import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

const createTicketSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
});

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "CLOSED"]).optional(),
  category: z
    .enum(["GENERAL_QUESTION", "TECHNICAL_QUESTION", "REFUND_REQUEST"])
    .optional(),
  assignedAgentId: z.string().nullable().optional(),
  aiSummary: z.string().nullable().optional(),
  aiSuggestedReply: z.string().nullable().optional(),
});

const listTicketsSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "CLOSED"]).optional(),
  category: z
    .enum(["GENERAL_QUESTION", "TECHNICAL_QUESTION", "REFUND_REQUEST"])
    .optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

ticketsRouter.get("/", async (req, res) => {
  const result = listTicketsSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { status, category, sortBy, sortOrder, page, pageSize } = result.data;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(status && { status }),
    ...(category && { category }),
  };

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        assignedAgent: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page, pageSize });
});

ticketsRouter.get("/:id", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      assignedAgent: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(ticket);
});

ticketsRouter.post("/", async (req, res) => {
  const result = createTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const ticket = await prisma.ticket.create({
    data: result.data,
    include: {
      assignedAgent: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  res.status(201).json(ticket);
});

ticketsRouter.patch("/:id", async (req, res) => {
  const result = updateTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: result.data,
      include: {
        assignedAgent: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    res.json(ticket);
  } catch {
    res.status(404).json({ error: "Ticket not found" });
  }
});
