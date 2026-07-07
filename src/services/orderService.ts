/**
 * orderService.ts
 *
 * Legacy service kept for backward compatibility with useOrderStore.
 * The active order flow uses apiOrderService.ts directly.
 * These functions delegate to the same /orders endpoint using the real API.
 * User identity is established server-side via the Bearer token - no user_id needed.
 */
import type { ApiOrder, CreateOrderApiPayload } from "../types/api";
import {
  fetchApiOrders,
  createApiOrder,
  cancelApiOrder,
  fetchApiOrderById,
} from "./apiOrderService";

export async function getOrders(_userId: string): Promise<ApiOrder[]> {
  return fetchApiOrders();
}

export async function getOrderById(orderId: string): Promise<ApiOrder | null> {
  try {
    return await fetchApiOrderById(Number(orderId));
  } catch {
    return null;
  }
}

export async function createOrder(payload: CreateOrderApiPayload): Promise<ApiOrder> {
  return createApiOrder(payload);
}

export async function cancelOrder(orderId: string): Promise<ApiOrder> {
  return cancelApiOrder(Number(orderId));
}
