/**
 * Customer support API — /api/v1/support/*
 * Tickets, threaded replies, and FAQs.
 */

import { request } from "../../services/api";
import type {
  FAQ,
  SupportCategory,
  SupportTicket,
  SupportTicketCreatePayload,
  SupportTicketListItem,
  SupportTicketMessage,
  SupportTicketStatus,
} from "../types/engagement";

const BASE = "/support";

function unwrap(res: any): any {
  return res?.data ?? res;
}

function mapMessage(raw: any): SupportTicketMessage {
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    sender_id: Number(raw?.sender_id ?? raw?.SenderId ?? 0),
    sender_role: String(raw?.sender_role ?? raw?.SenderRole ?? ""),
    message: String(raw?.message ?? raw?.Message ?? ""),
    created_at: String(raw?.created_at ?? raw?.CreatedAt ?? ""),
  };
}

function mapTicket(raw: any): SupportTicket {
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    ticket_code: raw?.ticket_code ?? raw?.TicketCode ?? null,
    user_id: Number(raw?.user_id ?? raw?.UserId ?? 0),
    order_id: raw?.order_id ?? raw?.OrderId ?? null,
    subject: String(raw?.subject ?? raw?.Subject ?? ""),
    category: (raw?.category ?? raw?.Category ?? "general") as SupportCategory,
    status: (raw?.status ?? raw?.Status ?? "open") as SupportTicketStatus,
    priority: String(raw?.priority ?? raw?.Priority ?? "normal"),
    created_at: String(raw?.created_at ?? raw?.CreatedAt ?? ""),
    updated_at: raw?.updated_at ?? raw?.UpdatedAt ?? null,
    messages: Array.isArray(raw?.messages) ? raw.messages.map(mapMessage) : [],
  };
}

function mapListItem(raw: any): SupportTicketListItem {
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    ticket_code: raw?.ticket_code ?? raw?.TicketCode ?? null,
    subject: String(raw?.subject ?? raw?.Subject ?? ""),
    category: (raw?.category ?? raw?.Category ?? "general") as SupportCategory,
    status: (raw?.status ?? raw?.Status ?? "open") as SupportTicketStatus,
    order_id: raw?.order_id ?? raw?.OrderId ?? null,
    created_at: String(raw?.created_at ?? raw?.CreatedAt ?? ""),
    updated_at: raw?.updated_at ?? raw?.UpdatedAt ?? null,
  };
}

function mapFaq(raw: any): FAQ {
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    question: String(raw?.question ?? raw?.Question ?? ""),
    answer: String(raw?.answer ?? raw?.Answer ?? ""),
    category: String(raw?.category ?? raw?.Category ?? "general"),
  };
}

/** POST /support/tickets */
export async function createTicket(payload: SupportTicketCreatePayload): Promise<SupportTicket> {
  const body: Record<string, unknown> = {
    subject: payload.subject,
    message: payload.message,
    category: payload.category ?? "general",
  };
  if (payload.order_id != null) body.order_id = payload.order_id;
  const res = await request<any>(`${BASE}/tickets`, { method: "POST", body });
  return mapTicket(unwrap(res));
}

/** GET /support/tickets */
export async function listTickets(
  status?: SupportTicketStatus,
  page = 1,
  limit = 20,
): Promise<{ tickets: SupportTicketListItem[]; total: number }> {
  let query = `?page=${page}&limit=${limit}`;
  if (status) query += `&status=${encodeURIComponent(status)}`;
  const res = await request<any>(`${BASE}/tickets${query}`);
  const data = unwrap(res);
  const list = Array.isArray(data?.tickets) ? data.tickets : Array.isArray(data) ? data : [];
  return { tickets: list.map(mapListItem), total: Number(data?.total ?? list.length) };
}

/** GET /support/tickets/{id} */
export async function getTicket(ticketId: number): Promise<SupportTicket> {
  const res = await request<any>(`${BASE}/tickets/${ticketId}`);
  return mapTicket(unwrap(res));
}

/** POST /support/tickets/{id}/messages */
export async function replyToTicket(
  ticketId: number,
  message: string,
): Promise<SupportTicketMessage> {
  const res = await request<any>(`${BASE}/tickets/${ticketId}/messages`, {
    method: "POST",
    body: { message },
  });
  return mapMessage(unwrap(res));
}

/** PATCH /support/tickets/{id}/status (staff) */
export async function updateTicketStatus(
  ticketId: number,
  status: SupportTicketStatus,
): Promise<SupportTicket> {
  const res = await request<any>(`${BASE}/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: { status },
  });
  return mapTicket(unwrap(res));
}

/** GET /support/faqs */
export async function listFaqs(category?: string): Promise<FAQ[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await request<any>(`${BASE}/faqs${query}`);
  const data = unwrap(res);
  const list = Array.isArray(data?.faqs) ? data.faqs : Array.isArray(data) ? data : [];
  return list.map(mapFaq);
}
