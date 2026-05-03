import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const webhooksRouter = Router();

const inboundEmailSchema = z.object({
  from: z.string().email(),
  fromName: z.string().optional(),
  subject: z.string().min(1).max(500),
  body: z.string().max(50_000).optional(),
});

webhooksRouter.post("/inbound-email", async (req: Request, res: Response) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] WEBHOOK_SECRET is not set");
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  if (req.headers["x-webhook-secret"] !== secret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = inboundEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const { from, fromName, subject, body } = parsed.data;

  try {
    const ticket = await prisma.ticket.create({
      data: {
        fromEmail: from.toLowerCase(),
        fromName,
        subject,
        body: body?.trim() || "[No message body]",
        status: "OPEN",
      },
    });

    console.log(`[webhook] Ticket ${ticket.id} created from ${from}`);
    res.status(200).json({ ok: true, ticketId: ticket.id });
  } catch (err) {
    console.error("[webhook] Failed to create ticket:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
