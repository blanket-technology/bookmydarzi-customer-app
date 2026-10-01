// ============================================================================
// API payload & response types for Addresses, Orders
// ============================================================================

// ── Address ───────────────────────────────────────────────────────────────────

export type AddressType = "home" | "work" | "other";

export interface AddressPayload {
  full_name: string;
  mobile: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  address_type: AddressType;
  is_default: boolean;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;
}

export interface ApiAddress extends AddressPayload {
  id: number;
  user_id: number;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Order ─────────────────────────────────────────────────────────────────────

export type PaymentMethodType = "cod" | "online" | "upi" | "card";

export interface CreateOrderApiPayload {
  tailor_id?: number;        // Optional - backend assigns tailor if not provided
  service_id: number;
  address_id: number;
  /** cod | online - sent when placing order */
  payment_method?: PaymentMethodType;
  urgency_level: "standard" | "express" | "urgent";
  /** ISO date string "YYYY-MM-DD" - apiOrderService slices toISOString() to date only */
  expected_delivery_date: string;
  /** Required by backend - base price of the selected service */
  subtotal: number;
  /** Optional discount amount (default 0) */
  discount?: number;
  description?: string;
  fabric_notes?: string;
  customization_notes?: string;
  cloth_details?: string;
  stitching_preferences?: Record<string, string>;
  image_references?: string[];
}

/** Neutral placeholder when a display field is null/empty */
export const ORDER_DISPLAY_FALLBACK = "-";

/** Tracking step labels from backend list/detail payload - render as-is */
export interface ApiOrderTrackingDisplay {
  statusLabel?: string | null;
  note?: string | null;
  timeLabel?: string | null;
}

/** Display-ready fields from GET /orders/my-orders - render as-is, do not format on client */
export interface ApiOrderDisplayFields {
  orderNumber?: string | null;
  statusLabel?: string | null;
  serviceTitle?: string | null;
  serviceSubtitle?: string | null;
  deliveryLabel?: string | null;
  paymentStatusLabel?: string | null;
  amountDisplay?: string | null;
  canCancel?: boolean;
  /** Backend flag - show Pay Now when true */
  canPayNow?: boolean;
  /** When provided on the list item, used for inline tracking (no extra fetch) */
  trackingSteps?: ApiOrderTrackingDisplay[] | null;
  /** Backend's ScheduledPickupAt (app/schemas/order.py OrderResponse) - ISO
   * timestamp when pickup is/was scheduled, null until scheduled. */
  scheduledPickupAt?: string | null;
  /** Backend's PickupTimeSlot - human-readable slot string (e.g. "10 AM - 12 PM"). */
  pickupTimeSlot?: string | null;
}

/** Amount in rupees for POST /payments/create (from backend numeric fields only) */
export function getOrderPayAmountRupees(order: ApiOrder): number {
  if (order.total_price > 0) return order.total_price;
  return 0;
}

const PAID_ORDER_STATUSES = new Set(["paid", "completed", "success"]);

/** Whether Pay Now should be shown (backend flag first, then payment fields on order) */
export function isOrderPayable(order: ApiOrder): boolean {
  if (PAID_ORDER_STATUSES.has((order.payment_status ?? "").toLowerCase())) return false;
  if (order.canPayNow === true) return true;
  if (order.canPayNow === false) return false;
  const method = (order.payment_method ?? "").toLowerCase();
  if (method === "cod") return false;
  return order.payment_status === "pending";
}

/** Render backend text or a neutral dash - never synthesize business labels */
export function orderDisplayValue(value: string | null | undefined): string {
  if (value == null) return ORDER_DISPLAY_FALLBACK;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : ORDER_DISPLAY_FALLBACK;
}

function mapTrackingSteps(raw: unknown): ApiOrderTrackingDisplay[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const steps = raw.map((step: Record<string, unknown>) => ({
    statusLabel:
      (step.StatusLabel as string | undefined) ??
      (step.status_label as string | undefined) ??
      (step.status as string | undefined) ??
      null,
    note:
      (step.Note as string | undefined) ??
      (step.note as string | undefined) ??
      (step.description as string | undefined) ??
      null,
    timeLabel:
      (step.TimeLabel as string | undefined) ??
      (step.time_label as string | undefined) ??
      (step.timestamp as string | undefined) ??
      (step.created_at as string | undefined) ??
      null,
  }));
  return steps.length > 0 ? steps : null;
}

/** Merge display/tracking fields from list item shape (camelCase or PascalCase on same object) */
export function mergeOrderDisplayFromItem(order: ApiOrder): ApiOrder {
  const r = order as ApiOrder & Record<string, unknown>;
  const nested = (r.Display ?? r.display) as Record<string, unknown> | undefined;

  const pick = (camel: keyof ApiOrderDisplayFields, pascal: string): string | null | undefined => {
    const fromOrder = order[camel];
    if (fromOrder != null && String(fromOrder).trim() !== "") return fromOrder as string;
    if (r[pascal] != null && String(r[pascal]).trim() !== "") return r[pascal] as string;
    if (nested?.[pascal] != null && String(nested[pascal]).trim() !== "")
      return nested[pascal] as string;
    const snake = pascal.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
    if (nested?.[snake] != null && String(nested[snake]).trim() !== "")
      return nested[snake] as string;
    return null;
  };

  return {
    ...order,
    orderNumber: pick("orderNumber", "OrderNumber") ?? null,
    statusLabel: pick("statusLabel", "StatusLabel") ?? null,
    serviceTitle: pick("serviceTitle", "ServiceTitle") ?? null,
    serviceSubtitle: pick("serviceSubtitle", "ServiceSubtitle") ?? null,
    deliveryLabel: pick("deliveryLabel", "DeliveryLabel") ?? null,
    paymentStatusLabel: pick("paymentStatusLabel", "PaymentStatusLabel") ?? null,
    amountDisplay: pick("amountDisplay", "AmountDisplay") ?? null,
    canCancel:
      order.canCancel ??
      (typeof r.CanCancel === "boolean"
        ? r.CanCancel
        : typeof r.can_cancel === "boolean"
          ? r.can_cancel
          : typeof nested?.CanCancel === "boolean"
            ? (nested.CanCancel as boolean)
            : undefined),
    canPayNow:
      order.canPayNow ??
      (typeof r.CanPayNow === "boolean"
        ? r.CanPayNow
        : typeof r.can_pay_now === "boolean"
          ? r.can_pay_now
          : typeof r.ShowPayNow === "boolean"
            ? r.ShowPayNow
            : typeof r.show_pay_now === "boolean"
              ? r.show_pay_now
              : typeof nested?.CanPayNow === "boolean"
                ? (nested.CanPayNow as boolean)
                : undefined),
    trackingSteps:
      order.trackingSteps ??
      mapTrackingSteps(r.Tracking ?? r.tracking ?? r.TrackingSteps ?? nested?.Tracking),
  };
}

export interface ApiOrder extends ApiOrderDisplayFields {
  id: number;
  tailor_id: number;
  service_id: number;
  measurement_id: number | null;
  address_id: number;
  status: "pending" | "confirmed" | "in_progress" | "ready" | "delivered" | "cancelled";
  urgency_level: string;
  expected_delivery_date: string;
  description: string | null;
  fabric_notes: string | null;
  customization_notes: string | null;
  voice_note_url: string | null;
  cloth_details: string | null;
  total_price: number;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_method?: PaymentMethodType;
  created_at: string;
  updated_at: string;
  // Nested objects returned by the API
  service?: { id: number; name: string; base_price: number };
  tailor?: { id: number; name: string; specialization: string };
  address?: ApiAddress;
  /** Filled by Bridge/employee at pickup, or by Admin - never by the
   * customer. Present only once staff have collected it. */
  measurement?: {
    id: number;
    profile_name: string;
    gender: string | null;
    chest: number | null;
    waist: number | null;
    hips: number | null;
    shoulder: number | null;
    neck: number | null;
    sleeve_length: number | null;
    inseam: number | null;
    height: number | null;
    fit_preference: string | null;
    notes: string | null;
  };
}

// ── Order Tracking ────────────────────────────────────────────────────────────

/**
 * @deprecated GET /orders/{id}/tracking does not return a flat array of
 * these - it returns a single OrderTrackingResponse object (see
 * OrderTrackingPayload below). This shape/type was never actually correct;
 * kept only because OrderCard.tsx's inline expandable timeline still
 * compiles against it. Migrate remaining call sites to
 * fetchOrderTrackingPayload + OrderTrackingPayload, then delete this.
 */
export interface ApiOrderTracking {
  id: number;
  order_id: number;
  status: string;
  note: string;
  created_at: string;
  updated_by?: string;
  /** Display-ready label from GET /orders/{id}/tracking */
  statusLabel?: string | null;
  timeLabel?: string | null;
}

/** @deprecated see ApiOrderTracking */
export function mapTrackingStepForDisplay(step: ApiOrderTracking): ApiOrderTrackingDisplay {
  return {
    statusLabel: step.statusLabel ?? step.status ?? null,
    note: step.note ?? null,
    timeLabel: step.timeLabel ?? step.created_at ?? null,
  };
}

/**
 * GET /orders/{order_id}/tracking - confirmed against backend source
 * (app/schemas/order.py: OrderTrackingResponse, TimelineStageResponse,
 * OrderCurrentStageResponse). This is the real, current response shape -
 * a single object, not an array.
 */
export interface OrderTimelineStage {
  status: string;
  title: string;
  description?: string | null;
  completed: boolean;
  current: boolean;
  /** ISO-8601 when this stage was reached, null if not yet reached. */
  timestamp: string | null;
  /** Extra context for this step - currently only set on the "cancelled"
   * step, carrying the real cancellation reason. */
  note?: string | null;
  /** Who was assigned - only set on the "pickup_partner_assigned"/
   * "delivery_partner_assigned" pseudo-stages, when a Bridge employee was
   * actually assigned at that point in the timeline. */
  partner?: {
    name: string;
    photo_url: string | null;
    mobile: string | null;
  } | null;
}

export interface OrderCurrentStage {
  current_stage: string;
  title: string;
  description: string;
}

export interface OrderTrackingPayload {
  order_id: number;
  order_code: string;
  status: string;
  current_status: string;
  current_stage: OrderCurrentStage;
  /** ISO date YYYY-MM-DD, server-calculated, never derive this client-side. */
  expected_delivery_date: string | null;
  /** e.g. "Delivery by 5 Jun", server-calculated. */
  display_eta: string | null;
  /** True only while the order is in the 2-hour post-delivery inspection
   * window - controls whether the "Report an issue" action renders. */
  can_report_issue: boolean;
  /** ISO datetime the current inspection window closes, present only when
   * can_report_issue is true. */
  inspection_window_expires_at: string | null;
  timeline: OrderTimelineStage[];
}

// ── Payment ───────────────────────────────────────────────────────────────────

export interface CreatePaymentPayload {
  order_id: number;
  amount: number;
  payment_method?: PaymentMethodType;
  currency?: string;
}

export interface ApiPayment {
  id: number;
  order_id: number;
  amount: number;
  status: string;
  payment_method?: string;
  currency?: string;
  transaction_id?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Display-ready label from GET /payments/order/{order_id} */
  statusLabel?: string | null;
  amountDisplay?: string | null;
  razorpay_order_id?: string | null;
  razorpay_key?: string | null;
}

/** Result of resolving Pay Now session (GET existing or POST create) */
export type PaymentSessionSource = "existing" | "created";

export interface ResolvedPaymentSession {
  session: RazorpayPaymentSession;
  source: PaymentSessionSource;
}

/** Pick payment display strings from API payload - no frontend status labels */
export function mapPaymentForDisplay(raw: Record<string, unknown> | null | undefined): Pick<
  ApiPayment,
  "statusLabel" | "amountDisplay" | "status" | "transaction_id" | "payment_method"
> | null {
  if (!raw) return null;
  const statusLabel =
    (raw.StatusLabel as string | undefined) ??
    (raw.status_label as string | undefined) ??
    (raw.PaymentStatusLabel as string | undefined) ??
    (raw.payment_status_label as string | undefined) ??
    null;
  const amountDisplay =
    (raw.AmountDisplay as string | undefined) ??
    (raw.amount_display as string | undefined) ??
    null;
  const status = String(raw.Status ?? raw.status ?? "").trim() || null;
  return {
    statusLabel: statusLabel ?? status,
    amountDisplay,
    status: status ?? "",
    transaction_id:
      (raw.TransactionId as string | undefined) ??
      (raw.transaction_id as string | undefined) ??
      null,
    payment_method:
      (raw.PaymentMethod as string | undefined) ??
      (raw.payment_method as string | undefined) ??
      undefined,
  };
}

export type PaymentStatusUpdate = "pending" | "paid" | "completed" | "failed" | "cancelled";

/** Response from POST /payments/create for Razorpay checkout */
export interface RazorpayPaymentSession {
  payment_id: number;
  order_id: number;
  razorpay_order_id: string;
  razorpay_key: string;
  /** Amount in paise (smallest currency unit) for Razorpay SDK */
  amount: number;
  currency: string;
  status?: string;
}

export interface VerifyRazorpayPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
