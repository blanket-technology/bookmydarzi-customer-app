import { request } from "../../services/api";
import type { CartCheckoutResult, SelectedAddon, StitchingPreferences } from "../types/cart";
import { generateIdempotencyKey } from "../utils/idempotencyKey";

export interface BillingEstimate {
  service_id: number;
  quantity: number;
  item_total: number;
  platform_fee: number;
  cgst_amount: number;
  sgst_amount: number;
  gst_amount: number;
  /** Any pending cancellation penalty already folded into total_amount below. */
  penalty_amount: number;
  total_amount: number;
  advance_amount: number;
  remaining_amount: number;
  item_total_display: string;
  platform_fee_display: string;
  gst_display: string;
  total_amount_display: string;
  advance_amount_display: string;
  remaining_amount_display: string;
}

export interface DirectOrderItem {
  service_id: number;
  quantity?: number;
}

export interface DirectOrderPayload {
  /** Ignored when `items` is set - see DirectOrderItem. */
  service_id: number;
  quantity?: number;
  address_id: number;
  pickup_type?: "instant" | "scheduled";
  payment_method?: "online" | "cod";
  offer_id?: number;
  scheduled_pickup_at?: string;
  pickup_time_slot?: string;
  stitching_preferences?: StitchingPreferences;
  /** Order-level free-text notes (Bug Report cycle 1, item 3.1/4.1). */
  customization_notes?: string;
  /** Reference style image URLs. */
  image_references?: string[];
  /** Extras selected on the service detail screen - see AddonPicker. */
  addons?: SelectedAddon[];
  /** Multi-item Book Now (e.g. a primary alteration tier plus other tiers
   * checked under "Add more work to this garment") - one real order with
   * several service lines, created directly without touching the cart.
   * When set, service_id/quantity/stitching_preferences/addons above are
   * ignored - see POST /orders/direct's `items` field on the backend. */
  items?: DirectOrderItem[];
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

export async function getBillingEstimate(
  serviceId: number,
  quantity = 1,
  addonIds: number[] = [],
  items?: DirectOrderItem[],
): Promise<BillingEstimate> {
  const qs = new URLSearchParams({ service_id: String(serviceId), quantity: String(quantity) });
  if (addonIds.length > 0) qs.set("addon_ids", addonIds.join(","));
  if (items?.length) {
    qs.set("items", JSON.stringify(items.map((i) => ({ service_id: i.service_id, quantity: i.quantity ?? 1 }))));
  }
  const raw = await request<unknown>(`/orders/billing-estimate?${qs.toString()}`);
  const r = asRecord(raw);
  return {
    service_id: num(r.service_id, serviceId),
    quantity: num(r.quantity, quantity),
    item_total: num(r.item_total),
    platform_fee: num(r.platform_fee),
    cgst_amount: num(r.cgst_amount),
    sgst_amount: num(r.sgst_amount),
    gst_amount: num(r.gst_amount),
    penalty_amount: num(r.penalty_amount),
    total_amount: num(r.total_amount),
    advance_amount: num(r.advance_amount),
    remaining_amount: num(r.remaining_amount),
    item_total_display: str(r.item_total_display, "₹0"),
    platform_fee_display: str(r.platform_fee_display, "₹0"),
    gst_display: str(r.gst_display, "₹0"),
    total_amount_display: str(r.total_amount_display, "₹0"),
    advance_amount_display: str(r.advance_amount_display, "₹0"),
    remaining_amount_display: str(r.remaining_amount_display, "₹0"),
  };
}

function mapToCheckoutResult(raw: unknown): CartCheckoutResult {
  const r = asRecord(raw);
  return {
    orderId: num(r.order_id),
    orderCode: str(r.order_code),
    status: str(r.status),
    paymentId: num(r.payment_id),
    action: str(r.action),
    subtotal: num(r.subtotal),
    discount: num(r.discount),
    platformFee: num(r.platform_fee),
    cgstAmount: num(r.cgst_amount),
    sgstAmount: num(r.sgst_amount),
    gstAmount: num(r.gst_amount),
    penaltyAmount: num(r.penalty_amount),
    finalAmount: num(r.final_amount),
    totalAmountDisplay: str(r.total_amount_display, "₹0"),
    advanceAmount: num(r.advance_amount),
    advanceAmountDisplay: str(r.advance_amount_display, "₹0"),
    remainingAmount: num(r.remaining_amount),
    remainingAmountDisplay: str(r.remaining_amount_display, "₹0"),
    lineItems: [],
    message: str(r.message, "Order placed successfully"),
  };
}

export async function createDirectOrder(
  payload: DirectOrderPayload,
): Promise<CartCheckoutResult> {
  const raw = await request<unknown>("/orders/direct", {
    method: "POST",
    body: {
      address_id: payload.address_id,
      pickup_type: payload.pickup_type ?? "instant",
      payment_method: payload.payment_method ?? "online",
      offer_id: payload.offer_id,
      scheduled_pickup_at: payload.scheduled_pickup_at,
      pickup_time_slot: payload.pickup_time_slot,
      ...(payload.items?.length
        ? { items: payload.items.map((i) => ({ service_id: i.service_id, quantity: i.quantity ?? 1 })) }
        : {
            service_id: payload.service_id,
            quantity: payload.quantity ?? 1,
            stitching_preferences: payload.stitching_preferences,
            ...(payload.addons?.length
              ? { addons: payload.addons.map((a) => ({ addon_id: a.addonId, ...(a.note?.trim() ? { note: a.note.trim() } : {}) })) }
              : {}),
          }),
    },
    // Same reasoning as cart checkout - makes the request wrapper's built-in
    // network-failure retry (and an accidental double-tap) safe.
    idempotencyKey: generateIdempotencyKey(),
  });
  const result = mapToCheckoutResult(raw);
  if (result.orderId <= 0) throw new Error("Order could not be created. Please try again.");
  // Note: advanceAmount === 0 is a legitimate state (e.g. zero platform fee)
  // - the order is already created server-side either way. Callers must
  // skip the payment gateway themselves when there's nothing to charge
  // upfront, not treat this as a checkout failure.
  return result;
}
