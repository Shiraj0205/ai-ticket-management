import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { PaginatedTickets, TicketStatus } from "../types/index.js";

const STATUSES: TicketStatus[] = ["OPEN", "RESOLVED", "CLOSED"];
const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
};

export default function DashboardPage() {
  const [counts, setCounts] = useState<Record<TicketStatus, number>>({
    OPEN: 0,
    RESOLVED: 0,
    CLOSED: 0,
  });
  const [recent, setRecent] = useState<PaginatedTickets["tickets"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [open, resolved, closed, recentRes] = await Promise.all([
          api.get<PaginatedTickets>("/tickets?status=OPEN&pageSize=1"),
          api.get<PaginatedTickets>("/tickets?status=RESOLVED&pageSize=1"),
          api.get<PaginatedTickets>("/tickets?status=CLOSED&pageSize=1"),
          api.get<PaginatedTickets>("/tickets?pageSize=5"),
        ]);
        setCounts({
          OPEN: open.total,
          RESOLVED: resolved.total,
          CLOSED: closed.total,
        });
        setRecent(recentRes.tickets);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {STATUSES.map((status) => (
          <Link
            key={status}
            to={`/tickets?status=${status}`}
            className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow"
          >
            <p className="text-sm text-gray-500 mb-1">{status}</p>
            <p className="text-3xl font-bold text-gray-900">{counts[status]}</p>
          </Link>
        ))}
      </div>

      {/* Recent tickets */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-3">
          Recent Tickets
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {recent.length === 0 && (
            <p className="p-4 text-sm text-gray-400">No tickets yet.</p>
          )}
          {recent.map((t) => (
            <Link
              key={t.id}
              to={`/tickets/${t.id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{t.subject}</p>
                <p className="text-xs text-gray-400">{t.fromEmail}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}
              >
                {t.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
