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

type StatsRow = {
  totalTickets: bigint;
  openTickets: bigint;
  aiResolvedCount: bigint;
  aiResolvedPercentage: unknown;
  avgResolutionHours: unknown;
};

dashboardRouter.get("/stats", async (_req, res) => {
  try {
    const rows = await prisma.$queryRaw<StatsRow[]>`SELECT * FROM get_dashboard_stats()`;
    const row = rows[0];

    res.json({
      totalTickets: Number(row.totalTickets),
      openTickets: Number(row.openTickets),
      aiResolvedCount: Number(row.aiResolvedCount),
      aiResolvedPercentage: row.aiResolvedPercentage != null ? Number(row.aiResolvedPercentage) : 0,
      avgResolutionHours: row.avgResolutionHours != null ? Number(row.avgResolutionHours) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});
