import { request } from "../../services/api";
import { generateIdempotencyKey } from "../utils/idempotencyKey";

export interface CancellationPreview {
  order_id: number;
  order_code: string;
  current_stage: string;
  display_stage: string;
  payment_type: "prepaid" | "postpaid";
  cancellation_allowed: boolean;
  contact_support: boolean;
  paid_amount: number;
  penalty_pct: number;
  penalty_amount: number;
  refund_pct: number;
  refund_amount: number;
  policy_description: string | null;
}

export interface OrderCancellation {
  Id: number;
  CancellationCode: string | null;
  OrderId: number;
  OrderStageAtCancel: string | null;
  PaymentType: string;
  PaidAmount: number;
  PenaltyPct: number;
  PenaltyAmount: number;
  RefundPct: number;
  RefundAmount: number;
  OverrideRefundAmount: number | null;
  Reason: string | null;
  Status: string;
  RefundId: number | null;
  AdminNotes: string | null;
  CreatedAt: string;
  ProcessedAt: string | null;
}

export async function fetchCancellationPreview(orderId: number): Promise<CancellationPreview> {
  return request<CancellationPreview>(`/orders/${orderId}/cancellation-preview`);
}

export async function cancelOrder(orderId: number, reason?: string): Promise<OrderCancellation> {
  return request<OrderCancellation>(`/orders/${orderId}/cancel`, {
    method: "POST",
    body: { reason: reason ?? null },
    idempotencyKey: generateIdempotencyKey(),
  });
}

export async function fetchOrderCancellation(orderId: number): Promise<OrderCancellation> {
  return request<OrderCancellation>(`/orders/${orderId}/cancellation`);
}

// Per-item cancel (cancel one line item within a multi-item order,
// without cancelling the whole order) - mirrors the whole-order shapes
// above, scoped to an OrderItem instead. See
// app/services/cancellation/item_cancellation_service.py.
export interface ItemCancellationPreview {
  order_id: number;
  order_item_id: number;
  order_code: string;
  service_name: string | null;
  current_stage: string;
  display_stage: string;
  payment_type: "prepaid" | "postpaid";
  cancellation_allowed: boolean;
  contact_support: boolean;
  is_last_active_item: boolean;
  item_price: number;
  paid_amount: number;
  penalty_pct: number;
  penalty_amount: number;
  refund_pct: number;
  refund_amount: number;
  policy_description: string | null;
  cancel_reason: string | null;
}

export interface OrderItemCancellation {
  Id: number;
  CancellationCode: string | null;
  OrderId: number;
  OrderItemId: number;
  OrderStageAtCancel: string | null;
  PaymentType: string;
  ItemPrice: number;
  PenaltyPct: number;
  PenaltyAmount: number;
  RefundPct: number;
  RefundAmount: number;
  OverrideRefundAmount: number | null;
  Reason: string | null;
  Status: string;
  RefundId: number | null;
  AdminNotes: string | null;
  CreatedAt: string;
  ProcessedAt: string | null;
}

export async function fetchItemCancellationPreview(
  orderId: number,
  itemId: number,
): Promise<ItemCancellationPreview> {
  return request<ItemCancellationPreview>(`/orders/${orderId}/items/${itemId}/cancellation-preview`);
}

export async function cancelOrderItem(
  orderId: number,
  itemId: number,
  reason?: string,
): Promise<OrderItemCancellation> {
  return request<OrderItemCancellation>(`/orders/${orderId}/items/${itemId}/cancel`, {
    method: "POST",
    body: { reason: reason ?? null },
    idempotencyKey: generateIdempotencyKey(),
  });
}
