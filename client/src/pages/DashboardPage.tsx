import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api.js";
import { Skeleton } from "../components/ui/skeleton.js";
import type { DashboardStats, PaginatedTickets, TicketStatus } from "../types/index.js";

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
};

function formatResolutionTime(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  linkTo?: string;
}

function StatCard({ label, value, sub, color = "text-gray-900", linkTo }: StatCardProps) {
  const inner = (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
  return linkTo ? <Link to={linkTo}>{inner}</Link> : inner;
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-16" />
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get<DashboardStats>("/dashboard/stats"),
  });

  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: () => api.get<PaginatedTickets>("/tickets?pageSize=5"),
  });

  const { data: ticketsPerDay, isLoading: chartLoading } = useQuery({
    queryKey: ["dashboard-tickets-per-day"],
    queryFn: () => api.get<{ date: string; count: number }[]>("/dashboard/tickets-per-day"),
  });

  const chartData = (ticketsPerDay ?? []).map((d) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    count: d.count,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* Stat cards */}
      {statsError && (
        <p className="text-sm text-red-600">Failed to load stats.</p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : stats ? (
          <>
            <StatCard
              label="Total Tickets"
              value={stats.totalTickets}
              linkTo="/tickets"
            />
            <StatCard
              label="Open Tickets"
              value={stats.openTickets}
              color="text-yellow-600"
              linkTo="/tickets?status=OPEN"
            />
            <StatCard
              label="Resolved by AI"
              value={stats.aiResolvedCount}
              color="text-purple-600"
              sub="tickets with AI reply"
            />
            <StatCard
              label="AI Resolution Rate"
              value={`${stats.aiResolvedPercentage}%`}
              color="text-purple-600"
              sub="of resolved tickets"
            />
            <StatCard
              label="Avg Resolution Time"
              value={formatResolutionTime(stats.avgResolutionHours)}
              color="text-blue-600"
              sub="resolved &amp; closed"
            />
          </>
        ) : null}
      </div>

      {/* Tickets per day chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Tickets per Day — Last 30 Days</h2>
        {chartLoading ? (
          <Skeleton className="h-48 w-full rounded-md" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
                cursor={{ fill: "#f9fafb" }}
              />
              <Bar dataKey="count" name="Tickets" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent tickets */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-3">Recent Tickets</h2>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {recentLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))
          ) : recent?.tickets.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No tickets yet.</p>
          ) : (
            recent?.tickets.map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.subject}</p>
                  <p className="text-xs text-gray-400">{t.fromEmail}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>
                  {t.status}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
