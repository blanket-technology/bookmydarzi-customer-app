/**
 * Order-scoped chat API - /api/v1/chat/orders/{order_id}/*
 *
 * Chat is between an order's customer and their assigned tailor (admin may read).
 * There is no global "conversations" list on the backend - each thread is tied
 * to an order.
 */

import { request } from "../../services/api";
import type { OrderChatMessage, OrderChatThread } from "../types/engagement";

function unwrap(res: any): any {
  return res?.data ?? res;
}

function mapMessage(raw: any): OrderChatMessage {
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    order_id: Number(raw?.order_id ?? raw?.OrderId ?? 0),
    sender_id: Number(raw?.sender_id ?? raw?.SenderId ?? 0),
    sender_role: String(raw?.sender_role ?? raw?.SenderRole ?? ""),
    message: String(raw?.message ?? raw?.Message ?? ""),
    is_read: Boolean(raw?.is_read ?? raw?.IsRead ?? false),
    created_at: String(raw?.created_at ?? raw?.CreatedAt ?? ""),
  };
}

/** GET /chat/orders/{orderId}/messages */
export async function getOrderThread(
  orderId: number,
  page = 1,
  limit = 50,
): Promise<OrderChatThread> {
  const res = await request<any>(
    `/chat/orders/${orderId}/messages?page=${page}&limit=${limit}`,
  );
  const data = unwrap(res);
  const list = Array.isArray(data?.messages) ? data.messages : [];
  return {
    order_id: Number(data?.order_id ?? orderId),
    messages: list.map(mapMessage),
    total: Number(data?.total ?? list.length),
    unread_count: Number(data?.unread_count ?? 0),
  };
}

/** POST /chat/orders/{orderId}/messages */
export async function sendOrderMessage(
  orderId: number,
  message: string,
): Promise<OrderChatMessage> {
  const res = await request<any>(`/chat/orders/${orderId}/messages`, {
    method: "POST",
    body: { message },
  });
  return mapMessage(unwrap(res));
}

/** PATCH /chat/orders/{orderId}/read */
export async function markOrderChatRead(orderId: number): Promise<number> {
  const res = await request<any>(`/chat/orders/${orderId}/read`, { method: "PATCH" });
  const data = unwrap(res);
  return Number(data?.updated ?? 0);
}

/** GET /chat/orders/{orderId}/unread-count */
export async function getOrderChatUnreadCount(orderId: number): Promise<number> {
  const res = await request<any>(`/chat/orders/${orderId}/unread-count`);
  const data = unwrap(res);
  return Number(data?.unread_count ?? 0);
}
