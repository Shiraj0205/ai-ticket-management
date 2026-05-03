export const TICKET_STATUSES = ["OPEN", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = [
  "GENERAL_QUESTION",
  "TECHNICAL_QUESTION",
  "REFUND_REQUEST",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
