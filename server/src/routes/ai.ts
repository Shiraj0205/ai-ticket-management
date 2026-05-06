import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { TICKET_CATEGORIES, type TicketCategory } from "../lib/enums.js";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const aiRouter = Router();

aiRouter.use(requireAuth);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ticketBodySchema = z.object({
  ticketId: z.string(),
});

aiRouter.post("/classify", async (req, res) => {
  const result = ticketBodySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: result.data.ticketId },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 100,
    system:
      "You are a support ticket classifier. Respond with exactly one of: GENERAL_QUESTION, TECHNICAL_QUESTION, REFUND_REQUEST",
    messages: [
      {
        role: "user",
        content: `Subject: ${ticket.subject}\n\n${ticket.body}`,
      },
    ],
  });

  const categoryRaw =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const category = TICKET_CATEGORIES.includes(categoryRaw as TicketCategory)
    ? (categoryRaw as TicketCategory)
    : undefined;

  if (!category) {
    res.status(500).json({ error: "Invalid classification from AI" });
    return;
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { category },
  });

  res.json({ category: updated.category });
});

aiRouter.post("/summarize", async (req, res) => {
  const result = ticketBodySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: result.data.ticketId },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system:
      "You are a support assistant. Summarize the following support ticket in 2-3 concise sentences.",
    messages: [
      {
        role: "user",
        content: `Subject: ${ticket.subject}\n\n${ticket.body}`,
      },
    ],
  });

  const aiSummary =
    message.content[0].type === "text" ? message.content[0].text : "";

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { aiSummary },
  });

  res.json({ summary: updated.aiSummary });
});

aiRouter.post("/suggest-reply", async (req, res) => {
  const result = ticketBodySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: result.data.ticketId },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const knowledgeBase = await prisma.knowledgeBaseEntry.findMany({
    select: { topic: true, content: true },
  });

  const kbContext =
    knowledgeBase.length > 0
      ? `\n\nKnowledge Base:\n${knowledgeBase.map((k) => `## ${k.topic}\n${k.content}`).join("\n\n")}`
      : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: `You are a helpful customer support agent. Write a friendly, professional reply to the following support ticket.${kbContext}`,
    messages: [
      {
        role: "user",
        content: `Subject: ${ticket.subject}\n\n${ticket.body}`,
      },
    ],
  });

  const aiSuggestedReply =
    message.content[0].type === "text" ? message.content[0].text : "";

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { aiSuggestedReply },
  });

  res.json({ reply: updated.aiSuggestedReply });
});

const polishReplySchema = z.object({
  body: z.string().min(1),
  fromName: z.string().optional(),
});

aiRouter.post("/polish-reply", async (req, res) => {
  const result = polishReplySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const agentName = req.authUser!.name;
  const { body, fromName } = result.data;
  const customerGreeting = fromName
    ? `Address the customer as "${fromName}" by name in the greeting.`
    : `The customer's name is not available.`;

  try {
    const { text } = await generateText({
      model: openai("gpt-5-nano"),
      system:
        `You are a professional customer support writing assistant. Improve the agent's draft reply: fix grammar, enhance clarity, and make the tone friendly and professional, while preserving the original meaning. ` +
        `${customerGreeting} ` +
        `End the reply with this exact signature on a new line:\n\nRegards,\n${agentName}\nhttps://my.ticketsystem.com\n\n` +
        `Return only the improved reply text with the signature — no commentary.`,
      prompt: body,
    });

    res.json({ polishedBody: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to polish reply" });
  }
});
