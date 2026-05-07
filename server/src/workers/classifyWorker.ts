import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { boss } from "../lib/boss.js";
import { prisma } from "../lib/prisma.js";
import { TICKET_CATEGORIES, type TicketCategory } from "../lib/enums.js";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const CLASSIFY_QUEUE = "classify-ticket";

export async function startClassifyWorker() {
  await boss.createQueue(CLASSIFY_QUEUE);
  await boss.work<{ ticketId: string }>(CLASSIFY_QUEUE, async (job) => {
    const { ticketId } = job.data;
    console.log(`[classify] processing job for ticket ${ticketId}`);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { console.log(`[classify] ticket ${ticketId} not found`); return; }

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system:
        "You are a support ticket classifier. Respond with exactly one of: GENERAL_QUESTION, TECHNICAL_QUESTION, REFUND_REQUEST",
      prompt: `Subject: ${ticket.subject}\n\n${ticket.body}`,
    });

    const categoryRaw = text.trim();
    console.log(`[classify] AI returned: "${categoryRaw}"`);
    const category = TICKET_CATEGORIES.includes(categoryRaw as TicketCategory)
      ? (categoryRaw as TicketCategory)
      : undefined;

    if (category) {
      await prisma.ticket.update({ where: { id: ticketId }, data: { category } });
      console.log(`[classify] ticket ${ticketId} classified as ${category}`);
    } else {
      console.log(`[classify] invalid category "${categoryRaw}", skipping update`);
    }
  });
}
