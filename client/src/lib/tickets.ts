import { api } from "./api.js";
import type { PaginatedTickets, Ticket, TicketStatus, TicketCategory } from "../types/index.js";

export interface ListTicketsParams {
  status?: TicketStatus | "";
  category?: TicketCategory | "";
  page?: number;
  pageSize?: number;
}

export const ticketsApi = {
  list: (params: ListTicketsParams = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.category) query.set("category", params.category);
    query.set("page", String(params.page ?? 1));
    query.set("pageSize", String(params.pageSize ?? 20));
    query.set("sortBy", "createdAt");
    query.set("sortOrder", "desc");
    return api.get<PaginatedTickets>(`/tickets?${query.toString()}`);
  },
  get: (id: string) => api.get<Ticket>(`/tickets/${id}`),
  update: (id: string, data: Partial<Pick<Ticket, "status" | "category" | "assignedAgentId">>) =>
    api.patch<Ticket>(`/tickets/${id}`, data),
};
