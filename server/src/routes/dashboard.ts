import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/tickets-per-day", async (_req, res) => {
  try {
    const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT DATE("createdAt") AS day, COUNT(*) AS count
      FROM "Ticket"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `;

    // Build a map of existing counts keyed by YYYY-MM-DD
    const countByDay = new Map<string, number>(
      rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)])
    );

    // Fill every day in the past 30 days (including days with 0 tickets)
    const result: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, count: countByDay.get(key) ?? 0 });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load chart data" });
  }
});

dashboardRouter.get("/stats", async (_req, res) => {
  try {
    const [totalTickets, openTickets, resolvedTickets, aiResolvedCount] =
      await Promise.all([
        prisma.ticket.count(),
        prisma.ticket.count({ where: { status: "OPEN" } }),
        prisma.ticket.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
        prisma.ticket.count({
          where: {
            status: { in: ["RESOLVED", "CLOSED"] },
            aiSuggestedReply: { not: null },
          },
        }),
      ]);

    const avgResult = await prisma.$queryRaw<[{ avg_hours: unknown }]>`
      SELECT EXTRACT(EPOCH FROM AVG("updatedAt" - "createdAt")) / 3600 AS avg_hours
      FROM "Ticket"
      WHERE status::text IN ('RESOLVED', 'CLOSED')
    `;

    const rawAvg = avgResult[0]?.avg_hours;
    const avgResolutionHours =
      rawAvg != null ? Math.round(Number(rawAvg) * 10) / 10 : null;

    const aiResolvedPercentage =
      resolvedTickets > 0
        ? Math.round((aiResolvedCount / resolvedTickets) * 1000) / 10
        : 0;

    res.json({
      totalTickets,
      openTickets,
      aiResolvedCount,
      aiResolvedPercentage,
      avgResolutionHours,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});
