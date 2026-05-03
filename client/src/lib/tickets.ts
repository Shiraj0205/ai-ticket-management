import { api } from "./api.js";
import type { PaginatedTickets, Ticket, TicketStatus, TicketCategory } from "../types/index.js";

export type SortableTicketField =
  | "createdAt"
  | "updatedAt"
  | "subject"
  | "status"
  | "category"
  | "fromEmail";

export interface ListTicketsParams {
  status?: TicketStatus | "";
  category?: TicketCategory | "";
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortableTicketField;
  sortOrder?: "asc" | "desc";
}

export const ticketsApi = {
  list: (params: ListTicketsParams = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.category) query.set("category", params.category);
    if (params.search) query.set("search", params.search);
    query.set("page", String(params.page ?? 1));
    query.set("pageSize", String(params.pageSize ?? 20));
    query.set("sortBy", params.sortBy ?? "createdAt");
    query.set("sortOrder", params.sortOrder ?? "desc");
    return api.get<PaginatedTickets>(`/tickets?${query.toString()}`);
  },
  get: (id: string) => api.get<Ticket>(`/tickets/${id}`),
  update: (id: string, data: Partial<Pick<Ticket, "status" | "category" | "assignedAgentId">>) =>
    api.patch<Ticket>(`/tickets/${id}`, data),
};
