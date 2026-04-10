export type Role = "ADMIN" | "AGENT";
export type TicketStatus = "OPEN" | "RESOLVED" | "CLOSED";
export type TicketCategory =
  | "GENERAL_QUESTION"
  | "TECHNICAL_QUESTION"
  | "REFUND_REQUEST";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName?: string | null;
  status: TicketStatus;
  category?: TicketCategory | null;
  aiSummary?: string | null;
  aiSuggestedReply?: string | null;
  assignedAgentId?: string | null;
  assignedAgent?: Pick<User, "id" | "name" | "email"> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTickets {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}
