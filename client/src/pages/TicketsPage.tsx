import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ticketsApi } from "../lib/tickets.js";
import { Skeleton } from "../components/ui/skeleton.js";
import type { TicketStatus, TicketCategory } from "../types/index.js";

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "General",
  TECHNICAL_QUESTION: "Technical",
  REFUND_REQUEST: "Refund",
};

const COLUMNS = ["Subject", "From", "Status", "Category", "Assigned", "Created"];

export default function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") ?? "") as TicketStatus | "";
  const category = (searchParams.get("category") ?? "") as TicketCategory | "";
  const page = Number(searchParams.get("page") ?? "1");

  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", { status, category, page }],
    queryFn: () => ticketsApi.list({ status, category, page }),
  });

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(p));
    setSearchParams(next);
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Tickets</h1>
        {data && (
          <p className="text-sm text-gray-500 mt-0.5">
            {data.total} {data.total === 1 ? "ticket" : "tickets"} total
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          value={category}
          onChange={(e) => setFilter("category", e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Categories</option>
          <option value="GENERAL_QUESTION">General Question</option>
          <option value="TECHNICAL_QUESTION">Technical Question</option>
          <option value="REFUND_REQUEST">Refund Request</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {(error as Error).message ?? "Failed to load tickets"}
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
                </tr>
              ))
            ) : data?.tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-sm text-gray-400 text-center">
                  No tickets found.
                </td>
              </tr>
            ) : (
              data?.tickets.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm">
                    <Link
                      to={`/tickets/${t.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {t.fromName ? (
                      <span>
                        {t.fromName}{" "}
                        <span className="text-gray-400 text-xs">{t.fromEmail}</span>
                      </span>
                    ) : (
                      t.fromEmail
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {t.category ? CATEGORY_LABELS[t.category] : "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {t.assignedAgent?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
