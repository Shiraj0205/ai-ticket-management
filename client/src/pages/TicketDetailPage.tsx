import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ticketsApi } from "../lib/tickets.js";
import { Skeleton } from "../components/ui/skeleton.js";
import type { Ticket, TicketStatus, TicketCategory } from "../types/index.js";

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "RESOLVED", "CLOSED"];
const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: "GENERAL_QUESTION", label: "General Question" },
  { value: "TECHNICAL_QUESTION", label: "Technical Question" },
  { value: "REFUND_REQUEST", label: "Refund Request" },
];

const replySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty"),
});
type ReplyFormData = z.infer<typeof replySchema>;

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: ticket,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => ticketsApi.get(id!),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["ticket-agents"],
    queryFn: ticketsApi.getAgents,
  });

  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ["ticket-replies", id],
    queryFn: () => ticketsApi.getReplies(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Pick<Ticket, "status" | "category" | "assignedAgentId">>) =>
      ticketsApi.update(id!, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", id], updated);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReplyFormData>({ resolver: zodResolver(replySchema) });

  const currentBody = watch("body") ?? "";

  const replyMutation = useMutation({
    mutationFn: (body: string) => ticketsApi.createReply(id!, body),
    onSuccess: (newReply) => {
      queryClient.setQueryData(
        ["ticket-replies", id],
        (prev: typeof replies) => [...(prev ?? []), newReply]
      );
      reset();
    },
  });

  const polishMutation = useMutation({
    mutationFn: (body: string) => ticketsApi.polishReply(body, ticket?.fromName),
    onSuccess: ({ polishedBody }) => {
      setValue("body", polishedBody, { shouldValidate: true, shouldDirty: true });
    },
  });

  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiError, setAiError] = useState("");

  async function runAi(action: "classify" | "summarize" | "suggest-reply") {
    if (!ticket) return;
    setAiLoading(action);
    setAiError("");
    try {
      await ticketsApi.runAi(action, ticket.id);

      if (action === "classify") {
        // Job is async via PgBoss — poll until category changes or 30s timeout
        const prevCategory = ticket.category;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const updated = await ticketsApi.get(ticket.id);
          queryClient.setQueryData(["ticket", id], updated);
          if (updated.category !== prevCategory) break;
        }
      } else {
        const updated = await ticketsApi.get(ticket.id);
        queryClient.setQueryData(["ticket", id], updated);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI action failed");
    } finally {
      setAiLoading(null);
    }
  }

  if (isLoading) {
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
        <div className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
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

  if (isError || !ticket) {
    return (
      <div className="max-w-3xl">
        <button onClick={() => navigate("/tickets")} className="text-sm text-blue-600 hover:underline mb-4 block">
          ← Back to Tickets
        </button>
        <p className="text-sm text-red-600">Ticket not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <button
        onClick={() => navigate("/tickets")}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to Tickets
      </button>

      {/* Ticket body */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">{ticket.subject}</h1>
        <div className="text-sm text-gray-500 space-y-0.5">
          <p>
            From: <span className="text-gray-700">{ticket.fromEmail}</span>
            {ticket.fromName && ` (${ticket.fromName})`}
          </p>
          <p>Created: {new Date(ticket.createdAt).toLocaleString()}</p>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap border-t pt-4">{ticket.body}</p>
      </div>

      {/* Reply thread */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">
          Replies {replies.length > 0 && <span className="text-gray-400 font-normal">({replies.length})</span>}
        </h2>

        {repliesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : replies.length === 0 ? (
          <p className="text-sm text-gray-400">No replies yet.</p>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => (
              <div key={reply.id} className="bg-gray-50 rounded-md p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">{reply.author.name}</span>
                  <span className="text-xs text-gray-400">{new Date(reply.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reply form */}
        <form
          onSubmit={handleSubmit(({ body }) => replyMutation.mutate(body))}
          className="space-y-2 border-t pt-4"
        >
          <textarea
            {...register("body")}
            rows={3}
            placeholder="Write a reply..."
            disabled={isSubmitting || replyMutation.isPending}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-y disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors.body && (
            <p className="text-xs text-red-600">{errors.body.message}</p>
          )}
          {replyMutation.isError && (
            <p className="text-xs text-red-600">
              {replyMutation.error instanceof Error ? replyMutation.error.message : "Failed to send reply"}
            </p>
          )}
          {polishMutation.isError && (
            <p className="text-xs text-red-600">
              {polishMutation.error instanceof Error ? polishMutation.error.message : "Failed to polish reply"}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => polishMutation.mutate(currentBody)}
              disabled={!currentBody.trim() || polishMutation.isPending || replyMutation.isPending}
              className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
            >
              {polishMutation.isPending ? "Polishing..." : "✦ Polish"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || replyMutation.isPending || polishMutation.isPending}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {replyMutation.isPending ? "Sending..." : "Send Reply"}
            </button>
          </div>
        </form>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Ticket Management</h2>

        {updateMutation.isError && (
          <p className="text-sm text-red-600">
            {updateMutation.error instanceof Error ? updateMutation.error.message : "Update failed"}
          </p>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={ticket.status}
              onChange={(e) => updateMutation.mutate({ status: e.target.value as TicketStatus })}
              disabled={updateMutation.isPending}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full disabled:opacity-50"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={ticket.category ?? ""}
              onChange={(e) =>
                updateMutation.mutate({ category: (e.target.value as TicketCategory) || null })
              }
              disabled={updateMutation.isPending}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full disabled:opacity-50"
            >
              <option value="">Uncategorized</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assigned Agent</label>
            <select
              value={ticket.assignedAgentId ?? ""}
              onChange={(e) =>
                updateMutation.mutate({ assignedAgentId: e.target.value || null })
              }
              disabled={updateMutation.isPending}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full disabled:opacity-50"
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {ticket.assignedAgent && (
              <p className="text-xs text-gray-400 mt-1">{ticket.assignedAgent.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* AI Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">AI Features</h2>

        {aiError && <p className="text-sm text-red-600">{aiError}</p>}

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

        {ticket.aiSummary && (
          <div>
            <p className="text-xs text-gray-500 mb-1">AI Summary</p>
            <p className="text-sm text-gray-700 bg-blue-50 rounded p-3">{ticket.aiSummary}</p>
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
