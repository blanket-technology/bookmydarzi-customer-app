/**
 * apiOrderService.ts
 *
 * All order API calls aligned with backend endpoints:
 *   POST   /orders                      → Create draft order
 *   GET    /orders/my-orders            → List my orders (customer or assigned tailor)
 *   GET    /orders/{order_id}           → Get order details
 *   GET    /orders/{order_id}/tracking  → Get order tracking timeline
 *   PATCH  /orders/{order_id}/status    → Update status (assigned tailor only)
 *   PATCH  /orders/{order_id}/cancel    → Cancel own order
 *
 * All requests use the Bearer token from SecureStore automatically via request().
 * No user_id is sent - the backend identifies the user from the JWT token.
 */
import { request } from "../../services/api";
import type { CreateOrderApiPayload, ApiOrder, ApiOrderTracking } from "../types/api";

const BASE = "/orders";

// ---------------------------------------------------------------------------
// PascalCase → camelCase mapper for a single order object
// Backend may return { Id, CustomerId, Status, ... } or { id, status, ... }
// ---------------------------------------------------------------------------
function mapOrder(raw: any): ApiOrder {
  if (!raw) throw new Error("Invalid order data received from server");

  // Status normalisation - backend uses snake_case or PascalCase
  const rawStatus: string = (
    raw?.Status ?? raw?.status ?? "pending"
  ).toLowerCase();

  const STATUS_MAP: Record<string, ApiOrder["status"]> = {
    draft: "pending",
    pending: "pending",
    pending_payment: "pending",
    pendingpayment: "pending",
    confirmed: "confirmed",
    accepted: "confirmed",
    processing: "in_progress",
    assigned: "confirmed",
    assigned_to_tailor: "confirmed",
    in_progress: "in_progress",
    inprogress: "in_progress",
    measurement_pending: "in_progress",
    ready: "ready",
    ready_for_delivery: "ready",
    out_for_delivery: "ready",
    delivered: "delivered",
    completed: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled",
  };
  const status: ApiOrder["status"] = STATUS_MAP[rawStatus] ?? "pending";

  // Payment status normalisation
  const rawPayStatus: string = (
    raw?.PaymentStatus ?? raw?.payment_status ?? "pending"
  ).toLowerCase();
  const PAY_MAP: Record<string, ApiOrder["payment_status"]> = {
    pending: "pending",
    pending_payment: "pending",
    processing: "pending",
    paid: "paid",
    completed: "paid",
    success: "paid",
    failed: "failed",
    refunded: "failed",
    cancelled: "failed",
  };
  const payment_status: ApiOrder["payment_status"] = PAY_MAP[rawPayStatus] ?? "pending";

  const rawPayMethod = String(
    raw?.PaymentMethod ?? raw?.payment_method ?? ""
  ).toLowerCase();
  const payment_method: ApiOrder["payment_method"] | undefined =
    rawPayMethod === "cod" ||
    rawPayMethod === "online" ||
    rawPayMethod === "upi" ||
    rawPayMethod === "card"
      ? (rawPayMethod as ApiOrder["payment_method"])
      : undefined;

  return {
    id: raw?.Id ?? raw?.id ?? 0,
    tailor_id: raw?.TailorId ?? raw?.tailor_id ?? 0,
    service_id: raw?.ServiceId ?? raw?.service_id ?? 0,
    measurement_id: raw?.MeasurementId ?? raw?.measurement_id ?? null,
    address_id: raw?.AddressId ?? raw?.address_id ?? 0,
    status,
    urgency_level: raw?.UrgencyLevel ?? raw?.urgency_level ?? "standard",
    expected_delivery_date: raw?.ExpectedDeliveryDate ?? raw?.expected_delivery_date ?? "",
    description: raw?.Description ?? raw?.description ?? null,
    fabric_notes: raw?.FabricNotes ?? raw?.fabric_notes ?? null,
    customization_notes: raw?.CustomizationNotes ?? raw?.customization_notes ?? null,
    cloth_details: raw?.ClothDetails ?? raw?.cloth_details ?? null,
    total_price:
      raw?.FinalAmount ??
      raw?.TotalPrice ??
      raw?.total_price ??
      raw?.Subtotal ??
      raw?.subtotal ??
      0,
    payment_status,
    payment_method,
    created_at: raw?.CreatedAt ?? raw?.created_at ?? "",
    updated_at: raw?.UpdatedAt ?? raw?.updated_at ?? "",
    // Nested service
    service: raw?.Service
      ? {
          id: raw.Service.Id ?? raw.Service.id ?? 0,
          name: raw.Service.Name ?? raw.Service.name ?? "",
          base_price: raw.Service.BasePrice ?? raw.Service.base_price ?? 0,
        }
      : raw?.service ?? undefined,
    // Nested tailor
    tailor: raw?.Tailor
      ? {
          id: raw.Tailor.Id ?? raw.Tailor.id ?? 0,
          name: raw.Tailor.Name ?? raw.Tailor.name ?? "",
          specialization: raw.Tailor.Specialization ?? raw.Tailor.specialization ?? "",
        }
      : raw?.tailor ?? undefined,
    orderNumber: raw?.OrderNumber ?? raw?.order_number ?? null,
    statusLabel: raw?.StatusLabel ?? raw?.status_label ?? null,
    serviceTitle: raw?.ServiceTitle ?? raw?.service_title ?? null,
    serviceSubtitle: raw?.ServiceSubtitle ?? raw?.service_subtitle ?? null,
    deliveryLabel: raw?.DeliveryLabel ?? raw?.delivery_label ?? null,
    paymentStatusLabel: raw?.PaymentStatusLabel ?? raw?.payment_status_label ?? null,
    amountDisplay: raw?.AmountDisplay ?? raw?.amount_display ?? null,
    canCancel:
      typeof raw?.CanCancel === "boolean"
        ? raw.CanCancel
        : typeof raw?.can_cancel === "boolean"
          ? raw.can_cancel
          : undefined,
    canPayNow:
      typeof raw?.CanPayNow === "boolean"
        ? raw.CanPayNow
        : typeof raw?.can_pay_now === "boolean"
          ? raw.can_pay_now
          : typeof raw?.ShowPayNow === "boolean"
            ? raw.ShowPayNow
            : typeof raw?.show_pay_now === "boolean"
              ? raw.show_pay_now
              : undefined,
  };
}

// ---------------------------------------------------------------------------
// Extract array from any backend response shape
// ---------------------------------------------------------------------------
function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.orders)) return res.orders;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.results)) return res.results;
  return [];
}

// ---------------------------------------------------------------------------
// GET /orders/my-orders
// Returns orders for the currently authenticated user (customer or tailor).
// ---------------------------------------------------------------------------
export async function fetchApiOrders(): Promise<ApiOrder[]> {
  const res = await request<any>(`${BASE}/my-orders`);

  if (__DEV__) {
    console.log("[OrderService] fetchApiOrders raw:", JSON.stringify(res));
  }

  const rawList = extractList(res);
  const mapped = rawList.map(mapOrder);

  if (__DEV__) {
    console.log("[OrderService] fetchApiOrders mapped:", mapped.length, "orders");
  }

  return mapped;
}

// ---------------------------------------------------------------------------
// GET /orders/{order_id}
// Returns full order details.
// ---------------------------------------------------------------------------
export async function fetchApiOrderById(id: number): Promise<ApiOrder> {
  const res = await request<any>(`${BASE}/${id}`);

  if (__DEV__) {
    console.log("[OrderService] fetchApiOrderById raw:", JSON.stringify(res));
  }

  const raw = res?.data ?? res?.order ?? res;
  return mapOrder(raw);
}

// ---------------------------------------------------------------------------
// GET /orders/{order_id}/tracking
// Returns the tracking timeline for an order.
// ---------------------------------------------------------------------------
export async function fetchApiOrderTracking(id: number): Promise<ApiOrderTracking[]> {
  const res = await request<any>(`${BASE}/${id}/tracking`);

  if (__DEV__) {
    console.log("[OrderService] fetchApiOrderTracking raw:", JSON.stringify(res));
  }

  // Backend may return { tracking: [...] } or a flat array
  let rawList: any[];
  if (Array.isArray(res)) {
    rawList = res;
  } else if (Array.isArray(res?.tracking)) {
    rawList = res.tracking;
  } else if (Array.isArray(res?.data)) {
    rawList = res.data;
  } else {
    rawList = [];
  }

  return rawList.map((t: any): ApiOrderTracking => ({
    id: t?.Id ?? t?.id ?? 0,
    order_id: t?.OrderId ?? t?.order_id ?? id,
    status: t?.Status ?? t?.status ?? "",
    note: t?.Note ?? t?.note ?? t?.Message ?? t?.message ?? "",
    created_at: t?.CreatedAt ?? t?.created_at ?? "",
    updated_by: t?.UpdatedBy ?? t?.updated_by ?? undefined,
    statusLabel:
      t?.StatusLabel ??
      t?.status_label ??
      t?.Status ??
      t?.status ??
      null,
    timeLabel:
      t?.TimeLabel ??
      t?.time_label ??
      t?.Timestamp ??
      t?.timestamp ??
      t?.CreatedAt ??
      t?.created_at ??
      null,
  }));
}

// ---------------------------------------------------------------------------
// POST /orders
// Creates a draft order for the current authenticated user.
// ---------------------------------------------------------------------------
export async function createApiOrder(payload: CreateOrderApiPayload): Promise<ApiOrder> {
  // Build a clean body - only include fields with real values
  const body: Record<string, unknown> = {
    service_id: payload.service_id,
    address_id: payload.address_id,
    // Backend expects "YYYY-MM-DD" - slice the ISO string
    expected_delivery_date: payload.expected_delivery_date.slice(0, 10),
    urgency_level: payload.urgency_level ?? "standard",
    subtotal: typeof payload.subtotal === "number" ? payload.subtotal : 0,
    discount: typeof payload.discount === "number" ? payload.discount : 0,
  };

  if (payload.tailor_id) body.tailor_id = payload.tailor_id;
  if (payload.measurement_id) body.measurement_id = payload.measurement_id;
  if (payload.description?.trim()) body.description = payload.description.trim();
  if (payload.cloth_details?.trim()) body.cloth_details = payload.cloth_details.trim();
  if (payload.fabric_notes?.trim()) body.fabric_notes = payload.fabric_notes.trim();
  if (payload.customization_notes?.trim()) body.customization_notes = payload.customization_notes.trim();
  if (payload.stitching_preferences && Object.keys(payload.stitching_preferences).length > 0) {
    body.stitching_preferences = payload.stitching_preferences;
  }
  if (payload.image_references && payload.image_references.length > 0) {
    body.image_references = payload.image_references;
  }
  if (payload.payment_method) {
    body.payment_method = payload.payment_method;
  }

  if (__DEV__) {
    console.log("[OrderService] createApiOrder payload:", JSON.stringify(body));
  }

  const res = await request<any>(BASE, { method: "POST", body });

  if (__DEV__) {
    console.log("[OrderService] createApiOrder raw response:", JSON.stringify(res));
  }

  const raw = res?.data ?? res?.order ?? res;
  return mapOrder(raw);
}

// ---------------------------------------------------------------------------
// PATCH /orders/{order_id}/cancel
// Cancels the order. Only the order owner can cancel.
// ---------------------------------------------------------------------------
export async function cancelApiOrder(id: number): Promise<ApiOrder> {
  const res = await request<any>(`${BASE}/${id}/cancel`, { method: "PATCH" });

  if (__DEV__) {
    console.log("[OrderService] cancelApiOrder raw:", JSON.stringify(res));
  }

  const raw = res?.data ?? res?.order ?? res;
  return mapOrder(raw);
}

// ---------------------------------------------------------------------------
// PATCH /orders/{order_id}/status
// Updates order status. Only the assigned tailor can call this.
// ---------------------------------------------------------------------------
export async function updateApiOrderStatus(
  id: number,
  status: string,
  note?: string
): Promise<ApiOrder> {
  const body: Record<string, unknown> = { status };
  if (note?.trim()) body.note = note.trim();

  if (__DEV__) {
    console.log("[OrderService] updateApiOrderStatus payload:", JSON.stringify(body));
  }

  const res = await request<any>(`${BASE}/${id}/status`, {
    method: "PATCH",
    body,
  });

  if (__DEV__) {
    console.log("[OrderService] updateApiOrderStatus raw:", JSON.stringify(res));
  }

  const raw = res?.data ?? res?.order ?? res;
  return mapOrder(raw);
}
