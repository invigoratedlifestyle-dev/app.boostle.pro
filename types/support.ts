export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_customer"
  | "resolved"
  | "closed";

export type SupportTicketPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type SupportTicket = {
  id: string;
  ticket_number: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  source: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSupportTicketInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type SupportApiResponse = {
  ok: boolean;
  ticketId?: string;
  ticketNumber?: number;
  error?: string;
};