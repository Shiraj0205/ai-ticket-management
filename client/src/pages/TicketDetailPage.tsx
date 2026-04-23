import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { Skeleton } from "../components/ui/skeleton.js";
import type { Ticket, TicketStatus } from "../types/index.js";

type AgentOption = { id: string; name: string };

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "RESOLVED", "CLOSED"];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Ticket>(`/tickets/${id}`),
      api.get<AgentOption[]>("/tickets/agents"),
    ])
      .then(([t, u]) => {
        setTicket(t);
        setAgents(u);
      })
      .catch(() => navigate("/tickets"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function updateTicket(data: Partial<Ticket>) {
    if (!ticket) return;
    try {
      const updated = await api.patch<Ticket>(`/tickets/${ticket.id}`, data);
      setTicket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function runAi(action: "classify" | "summarize" | "suggest-reply") {
    if (!ticket) return;
    setAiLoading(action);
    setError("");
    try {
      await api.post(`/ai/${action}`, { ticketId: ticket.id });
      const updated = await api.get<Ticket>(`/tickets/${ticket.id}`);
      setTicket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI action failed");
    } finally {
      setAiLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-4 w-28" />
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="border-t pt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
      </div>
    );
  }
  if (!ticket) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <button
        onClick={() => navigate("/tickets")}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to Tickets
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">{ticket.subject}</h1>
        <div className="text-sm text-gray-500 space-y-0.5">
          <p>
            From: <span className="text-gray-700">{ticket.fromEmail}</span>
            {ticket.fromName && ` (${ticket.fromName})`}
          </p>
          <p>
            Created: {new Date(ticket.createdAt).toLocaleString()}
          </p>
        </div>

        <p className="text-sm text-gray-700 whitespace-pre-wrap border-t pt-4">
          {ticket.body}
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Status
          </label>
          <select
            value={ticket.status}
            onChange={(e) =>
              updateTicket({ status: e.target.value as TicketStatus })
            }
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Assigned Agent
          </label>
          <select
            value={ticket.assignedAgentId ?? ""}
            onChange={(e) =>
              updateTicket({
                assignedAgentId: e.target.value || null,
              })
            }
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full"
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* AI Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">AI Features</h2>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => runAi("classify")}
            disabled={!!aiLoading}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {aiLoading === "classify" ? "Classifying..." : "Auto-Classify"}
          </button>
          <button
            onClick={() => runAi("summarize")}
            disabled={!!aiLoading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {aiLoading === "summarize" ? "Summarizing..." : "Summarize"}
          </button>
          <button
            onClick={() => runAi("suggest-reply")}
            disabled={!!aiLoading}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {aiLoading === "suggest-reply" ? "Generating..." : "Suggest Reply"}
          </button>
        </div>

        {ticket.category && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Category</p>
            <span className="text-sm font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
              {ticket.category.replace(/_/g, " ")}
            </span>
          </div>
        )}

        {ticket.aiSummary && (
          <div>
            <p className="text-xs text-gray-500 mb-1">AI Summary</p>
            <p className="text-sm text-gray-700 bg-blue-50 rounded p-3">
              {ticket.aiSummary}
            </p>
          </div>
        )}

        {ticket.aiSuggestedReply && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Suggested Reply</p>
            <p className="text-sm text-gray-700 bg-green-50 rounded p-3 whitespace-pre-wrap">
              {ticket.aiSuggestedReply}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
