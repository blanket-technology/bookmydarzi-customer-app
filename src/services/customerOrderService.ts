/**
 * Customer orders API
 *   GET /customer/orders/active?status=&page=&limit=
 *   GET /customer/orders/completed?page=&limit=
 *   GET /customer/orders/cancelled?page=&limit=
 *   GET /customer/orders/{order_id}/summary
 *   GET /customer/orders/{order_id}/details
 */
import { request } from "../../services/api";
import type {
  CustomerOrderBillLine,
  CustomerOrderDetails,
  CustomerOrderDetailsPayload,
  CustomerOrderKeyValue,
  CustomerOrderListItem,
  CustomerOrderServiceLine,
  CustomerOrderSummary,
  CustomerOrderSummaryPayload,
  CustomerOrderSupportInfo,
  OrderDetailsDeliveryAddressBlock,
  OrderDetailsLineItem,
  OrderDetailsMeasurementBlock,
  OrderDetailsOrderBlock,
  OrderDetailsPaymentBlock,
  OrderDetailsPricingBlock,
  OrderDetailsServiceBlock,
  OrderDetailsTimelineItem,
  PickupPartner,
  OrderSummaryBillingBlock,
  OrderSummaryDatesBlock,
  OrderSummaryDeliveryAddressBlock,
  OrderSummaryOrderBlock,
  OrderSummaryPaymentBlock,
  OrderSummaryServiceBlock,
  PaginatedCustomerOrders,
} from "../types/customerOrders";
import { ORDER_DISPLAY_FALLBACK, orderDisplayValue } from "../types/api";
import { isCompletedCustomerOrderStatus } from "../utils/customerOrderStatus";

const BASE = "/customer/orders";

function extractList(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = res as Record<string, unknown>;
  if (Array.isArray(r?.items)) return r.items as Record<string, unknown>[];
  if (Array.isArray(r?.orders)) return r.orders as Record<string, unknown>[];
  if (Array.isArray(r?.data)) return r.data as Record<string, unknown>[];
  if (Array.isArray(r?.results)) return r.results as Record<string, unknown>[];
  return [];
}

/** Total/page/limit from the paginated envelope, defaulting to a
 * single-page result when the backend ever returns a bare array (keeps
 * older cached responses / other callers from breaking). */
function extractPageMeta(
  res: unknown,
  items: unknown[],
  fallbackPage: number,
  fallbackLimit: number,
): { total: number; page: number; limit: number } {
  const r = res as Record<string, unknown>;
  const total = typeof r?.total === "number" ? r.total : items.length;
  const page = typeof r?.page === "number" ? r.page : fallbackPage;
  const limit = typeof r?.limit === "number" ? r.limit : fallbackLimit;
  return { total, page, limit };
}

function unwrapRecord(res: unknown): Record<string, unknown> {
  if (!res || typeof res !== "object") return {};
  const r = res as Record<string, unknown>;
  const nested = r.data ?? r.order ?? r.summary ?? r.details ?? r.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...r, ...(nested as Record<string, unknown>) };
  }
  return r;
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function pickNum(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = obj[key];
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function pickBool(
  obj: Record<string, unknown>,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "boolean") return v;
  }
  return undefined;
}

/** Order total in rupees - `price` is the actual field name on the backend's
 * CustomerActiveOrderItem/CustomerCompletedOrderItem list schemas, and is
 * always populated (= order.FinalAmount) regardless of payment state. */
function pickOrderAmount(obj: Record<string, unknown>): number | undefined {
  // `price` is the actual field name on both list schemas
  // (CustomerActiveOrderItem/CustomerCompletedOrderItem), always populated
  // (= order.FinalAmount) regardless of payment state.
  const n = pickNum(obj, "price");
  return n > 0 ? n : undefined;
}

function formatAmountDisplay(obj: Record<string, unknown>): string {
  // `price` can carry paise (e.g. a discounted order placed before the
  // backend's own whole-rupee rounding fix), so always round for display.
  const paid = pickOrderAmount(obj);
  if (paid) return `₹${Math.round(paid).toLocaleString("en-IN")}`;
  return ORDER_DISPLAY_FALLBACK;
}

function mapListItem(raw: Record<string, unknown>): CustomerOrderListItem {
  const id = pickNum(raw, "id", "Id", "order_id", "OrderId");
  const status = pickStr(raw, "status", "Status").toLowerCase() || "pending";
  // `order_code` is the actual field name on both
  // CustomerActiveOrderItem/CustomerCompletedOrderItem list schemas.
  const bookingId = pickStr(raw, "order_code");

  // Active-list items carry `expected_delivery_date`; completed-list items
  // carry `completed_at` instead - the two backend schemas
  // (CustomerActiveOrderItem / CustomerCompletedOrderItem) never return both.
  // Some of these can be a bare date ("2026-08-06") or a full timestamp with
  // microseconds/offset ("2026-08-04T20:44:29.192209+05:30") - always
  // reduce to one consistent date-only value here so every consumer of
  // `scheduledLabel` (home screen, Orders tab, support picker) renders the
  // same shape regardless of which raw field/format the backend used.
  const rawDate = pickStr(raw, "expected_delivery_date", "completed_at") || raw.created_at?.toString() || "";
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const scheduledLabel =
    parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : "";

  const paymentStatus = pickStr(raw, "payment_status", "PaymentStatus", "paymentStatus") || undefined;
  const paymentMethod = pickStr(raw, "payment_method", "PaymentMethod", "paymentMethod") || null;

  return {
    id,
    bookingId: bookingId || (id > 0 ? `ORD${id}` : ORDER_DISPLAY_FALLBACK),
    status,
    statusLabel: orderDisplayValue(
      pickStr(raw, "statusLabel", "StatusLabel", "status_label",
              "CustomerStatus", "customer_status") || status,
    ),
    scheduledLabel: orderDisplayValue(scheduledLabel),
    amountPaidDisplay: formatAmountDisplay(raw),
    orderAmount: pickOrderAmount(raw),
    paymentStatus,
    paymentMethod,
    // `service_name`/`category_name` are the actual field names on both
    // list schemas (see backend CustomerActiveOrderItem/CustomerCompletedOrderItem).
    serviceTitle: orderDisplayValue(pickStr(raw, "service_name")),
    serviceSubtitle: orderDisplayValue(pickStr(raw, "category_name")),
    thumbnail: pickStr(raw, "thumbnail", "Thumbnail", "image_url", "ImageUrl") || null,
    expectedDeliveryDate:
      pickStr(raw, "expected_delivery_date", "ExpectedDeliveryDate", "expectedDeliveryDate") || null,
    canPayNow: pickBool(raw, "canPayNow", "CanPayNow", "can_pay_now", "show_pay_now"),
    paymentStatusLabel:
      pickStr(raw, "paymentStatusLabel", "PaymentStatusLabel", "payment_status_label") ||
      undefined,
    pickupType: pickStr(raw, "pickup_type", "PickupType", "pickupType") || null,
    pickupTimeSlot: pickStr(raw, "pickup_time_slot", "PickupTimeSlot", "pickupTimeSlot") || null,
    scheduledPickupAt:
      pickStr(raw, "scheduled_pickup_at", "ScheduledPickupAt", "scheduledPickupAt") || null,
    cancelledAt: pickStr(raw, "cancelled_at", "CancelledAt", "cancelledAt") || null,
    cancelReason: pickStr(raw, "reason", "Reason", "cancel_reason") || null,
    penaltyAmount: pickNum(raw, "penalty_amount", "PenaltyAmount") || undefined,
    refundAmount: pickNum(raw, "refund_amount", "RefundAmount") || undefined,
  };
}

function mapKeyValueRows(raw: unknown): CustomerOrderKeyValue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const label = pickStr(row, "label", "Label", "title", "Title", "key", "Key");
      const value = pickStr(row, "value", "Value", "text", "Text", "description");
      if (!label && !value) return null;
      return { label: label || "-", value: orderDisplayValue(value) };
    })
    .filter((r): r is CustomerOrderKeyValue => r != null);
}

function mapServiceLines(raw: unknown): CustomerOrderServiceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const row = item as Record<string, unknown>;
    return {
      id: (row.id ?? row.Id ?? index) as string | number,
      name: orderDisplayValue(
        pickStr(row, "name", "Name", "service_name", "ServiceName", "title", "Title"),
      ),
      subtitle: pickStr(row, "subtitle", "Subtitle", "description", "Description") || undefined,
      quantity: pickNum(row, "quantity", "Quantity") || undefined,
      priceDisplay:
        pickStr(row, "priceDisplay", "PriceDisplay", "price", "Price", "amount") || undefined,
    };
  });
}

function mapBillLines(raw: unknown): CustomerOrderBillLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      label: pickStr(row, "label", "Label", "title", "Title") || "Item",
      value: orderDisplayValue(pickStr(row, "value", "Value", "amount", "Amount")),
      isTotal: pickBool(row, "isTotal", "IsTotal", "is_total") === true,
      isDiscount: pickBool(row, "isDiscount", "IsDiscount", "is_discount") === true,
    };
  });
}

function mapSupport(raw: Record<string, unknown>): CustomerOrderSupportInfo | undefined {
  const block =
    (raw.support as Record<string, unknown>) ??
    (raw.Support as Record<string, unknown>) ??
    (raw.help as Record<string, unknown>) ??
    (raw.Help as Record<string, unknown>);

  if (!block) {
    const phone = pickStr(raw, "supportPhone", "SupportPhone", "helpline");
    const email = pickStr(raw, "supportEmail", "SupportEmail");
    if (!phone && !email) return undefined;
    return {
      title: "Need help with this booking?",
      subtitle: "Our support team is here for you",
      phone: phone || undefined,
      email: email || undefined,
      actionLabel: "Contact support",
    };
  }

  return {
    title: pickStr(block, "title", "Title") || "Need help with this booking?",
    subtitle: pickStr(block, "subtitle", "Subtitle") || undefined,
    phone: pickStr(block, "phone", "Phone") || undefined,
    email: pickStr(block, "email", "Email") || undefined,
    actionLabel: pickStr(block, "actionLabel", "ActionLabel") || "Contact support",
  };
}

function mapSummaryOrDetails(
  raw: Record<string, unknown>,
  mode: "summary" | "details",
): CustomerOrderSummary | CustomerOrderDetails {
  const id = pickNum(raw, "id", "Id", "order_id", "OrderId");
  const status = pickStr(raw, "status", "Status").toLowerCase() || "pending";
  const bookingId = pickStr(raw, "orderNumber", "OrderNumber", "booking_id", "BookingId", "booking_number");

  const services = mapServiceLines(
    raw.services ??
      raw.Services ??
      raw.service_list ??
      raw.ServiceList ??
      raw.items ??
      raw.Items,
  );

  const billLines = mapBillLines(
    raw.bill ??
      raw.Bill ??
      raw.bill_details ??
      raw.BillDetails ??
      raw.billDetails ??
      raw.pricing ??
      raw.Pricing,
  );

  const bookingDetails = mapKeyValueRows(
    raw.booking_details ??
      raw.BookingDetails ??
      raw.bookingDetails ??
      raw.booking_info ??
      raw.BookingInfo,
  );

  const addressLines = mapKeyValueRows(raw.address ?? raw.Address ?? raw.delivery_address ?? raw.DeliveryAddress);

  const paymentLines = mapKeyValueRows(raw.payment ?? raw.Payment ?? raw.payment_info ?? raw.PaymentInfo);

  const base: CustomerOrderSummary = {
    id,
    bookingId: bookingId || (id > 0 ? `ORD${id}` : ORDER_DISPLAY_FALLBACK),
    status,
    statusLabel: orderDisplayValue(pickStr(raw, "statusLabel", "StatusLabel", "status_label") || status),
    isCompleted: isCompletedCustomerOrderStatus(status),
    headerSubtitle: pickStr(raw, "subtitle", "Subtitle", "header_subtitle") || undefined,
    services,
    billLines,
    bookingDetails,
    addressLines,
    paymentLines,
    support: mapSupport(raw),
  };

  if (mode === "summary") return base;

  const trackingSteps = mapKeyValueRows(
    raw.tracking ??
      raw.Tracking ??
      raw.tracking_steps ??
      raw.TrackingSteps ??
      raw.timeline,
  );

  return {
    ...base,
    trackingSteps,
    notes: pickStr(raw, "notes", "Notes", "description", "Description") || undefined,
    tailorName: pickStr(raw, "tailorName", "TailorName", "tailor_name") || undefined,
    createdAtLabel: pickStr(raw, "createdAtLabel", "CreatedAtLabel", "created_at") || undefined,
    updatedAtLabel: pickStr(raw, "updatedAtLabel", "UpdatedAtLabel", "updated_at") || undefined,
  };
}

export interface CustomerOrdersPageParams {
  page?: number;
  limit?: number;
  /** Active-tab only - filter to a single order status. */
  status?: string;
}

function buildQuery(params?: CustomerOrdersPageParams): string {
  if (!params) return "";
  const qp = new URLSearchParams();
  if (params.page) qp.set("page", String(params.page));
  if (params.limit) qp.set("limit", String(params.limit));
  if (params.status) qp.set("status", params.status);
  const qs = qp.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchActiveCustomerOrders(
  params?: CustomerOrdersPageParams,
): Promise<PaginatedCustomerOrders> {
  const res = await request<unknown>(`${BASE}/active${buildQuery(params)}`);
  const items = extractList(res).map(mapListItem).filter((o) => o.id > 0);
  return { items, ...extractPageMeta(res, items, params?.page ?? 1, params?.limit ?? 20) };
}

export async function fetchCompletedCustomerOrders(
  params?: CustomerOrdersPageParams,
): Promise<PaginatedCustomerOrders> {
  const res = await request<unknown>(`${BASE}/completed${buildQuery(params)}`);
  const items = extractList(res).map(mapListItem).filter((o) => o.id > 0);
  return { items, ...extractPageMeta(res, items, params?.page ?? 1, params?.limit ?? 20) };
}

export async function fetchCancelledCustomerOrders(
  params?: CustomerOrdersPageParams,
): Promise<PaginatedCustomerOrders> {
  const res = await request<unknown>(`${BASE}/cancelled${buildQuery(params)}`);
  const items = extractList(res).map(mapListItem).filter((o) => o.id > 0);
  return { items, ...extractPageMeta(res, items, params?.page ?? 1, params?.limit ?? 20) };
}

function block(raw: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    const v = raw[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  }
  return {};
}

function nullableStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function nullableNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function nullableMoney(v: unknown): number | string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed || null;
  }
  return null;
}

function unwrapSummaryEnvelope(res: unknown): Record<string, unknown> {
  if (!res || typeof res !== "object") return {};
  const r = res as Record<string, unknown>;
  const nested = r.data ?? r.summary ?? r.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return r;
}

function unwrapDetailsEnvelope(res: unknown): Record<string, unknown> {
  if (!res || typeof res !== "object") return {};
  const r = res as Record<string, unknown>;
  const nested = r.data ?? r.details ?? r.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return r;
}

function mapSummaryOrderBlock(raw: Record<string, unknown>): OrderSummaryOrderBlock {
  const order = block(raw, "order", "Order");
  return {
    order_code: nullableStr(order.order_code ?? order.orderCode ?? order.OrderCode),
    status: nullableStr(order.status ?? order.Status),
    completed_at: nullableStr(order.completed_at ?? order.completedAt ?? order.CompletedAt),
  };
}

function mapSummaryDatesBlock(raw: Record<string, unknown>): OrderSummaryDatesBlock {
  const dates = block(raw, "dates", "Dates");
  return {
    order_placed_at: nullableStr(
      dates.order_placed_at ?? dates.orderPlacedAt ?? dates.placed_at,
    ),
    expected_delivery_date: nullableStr(
      dates.expected_delivery_date ?? dates.expectedDeliveryDate,
    ),
    delivered_at: nullableStr(dates.delivered_at ?? dates.deliveredAt),
  };
}

function mapSummaryServiceBlock(raw: Record<string, unknown>): OrderSummaryServiceBlock {
  const service = block(raw, "service", "Service");
  return {
    service_name: nullableStr(service.service_name ?? service.serviceName ?? service.name),
    category_name: nullableStr(service.category_name ?? service.categoryName),
    quantity: nullableNum(service.quantity ?? service.Quantity),
  };
}

function mapSummaryBillingBlock(raw: Record<string, unknown>): OrderSummaryBillingBlock {
  const billing = block(raw, "billing", "Billing", "pricing", "Pricing");
  return {
    item_total: nullableMoney(billing.item_total ?? billing.itemTotal ?? billing.subtotal),
    gst_amount: nullableMoney(billing.gst_amount ?? billing.gstAmount ?? billing.gst),
    cgst_amount: nullableMoney(billing.cgst_amount ?? billing.cgstAmount),
    sgst_amount: nullableMoney(billing.sgst_amount ?? billing.sgstAmount),
    service_fee: nullableMoney(billing.service_fee ?? billing.serviceFee ?? billing.platform_fee),
    discount: nullableMoney(billing.discount ?? billing.discount_amount),
    total_amount: nullableMoney(
      billing.total_amount ??
        billing.totalAmount ??
        billing.final_amount ??
        billing.finalAmount,
    ),
    advance_amount: nullableNum(billing.advance_amount ?? billing.advanceAmount),
    remaining_amount: nullableNum(billing.remaining_amount ?? billing.remainingAmount),
  };
}

function mapSummaryPaymentBlock(raw: Record<string, unknown>): OrderSummaryPaymentBlock {
  const payment = block(raw, "payment", "Payment");
  return {
    payment_method: nullableStr(payment.payment_method ?? payment.paymentMethod),
    payment_status: nullableStr(payment.payment_status ?? payment.paymentStatus),
    transaction_id: nullableStr(payment.transaction_id ?? payment.transactionId),
  };
}

function mapSummaryAddressBlock(
  raw: Record<string, unknown>,
): OrderSummaryDeliveryAddressBlock {
  const addr = block(raw, "delivery_address", "deliveryAddress", "DeliveryAddress", "address");
  return {
    name: nullableStr(addr.name ?? addr.full_name ?? addr.fullName),
    mobile: nullableStr(addr.mobile ?? addr.phone),
    full_address: nullableStr(
      addr.full_address ?? addr.fullAddress ?? addr.address_line ?? addr.address,
    ),
  };
}

export function mapCustomerOrderSummaryPayload(
  orderId: number,
  res: unknown,
): CustomerOrderSummaryPayload {
  const raw = unwrapSummaryEnvelope(res);
  return {
    orderId,
    order: mapSummaryOrderBlock(raw),
    dates: mapSummaryDatesBlock(raw),
    service: mapSummaryServiceBlock(raw),
    billing: mapSummaryBillingBlock(raw),
    payment: mapSummaryPaymentBlock(raw),
    delivery_address: mapSummaryAddressBlock(raw),
  };
}

function mapBridgePartner(raw: Record<string, unknown>, ...keys: string[]): PickupPartner | null {
  const partner = block(raw, ...keys);
  const name = nullableStr(partner.name);
  if (!name) return null;
  return {
    name,
    photo_url: nullableStr(partner.photo_url ?? partner.photoUrl),
    mobile: nullableStr(partner.mobile),
    rating: nullableNum(partner.rating),
  };
}

function mapDetailsOrderBlock(raw: Record<string, unknown>): OrderDetailsOrderBlock {
  const order = block(raw, "order", "Order");
  return {
    order_code: nullableStr(order.order_code ?? order.orderCode),
    order_id: nullableNum(order.order_id ?? order.orderId ?? order.id ?? order.Id),
    status: nullableStr(order.status ?? order.Status),
    customer_status: nullableStr(order.customer_status ?? order.CustomerStatus),
    urgency_level: nullableStr(order.urgency_level ?? order.urgencyLevel),
    pickup_type: nullableStr(order.pickup_type ?? order.pickupType ?? order.PickupType),
    pickup_time_slot: nullableStr(order.pickup_time_slot ?? order.pickupTimeSlot ?? order.PickupTimeSlot),
    scheduled_pickup_at: nullableStr(order.scheduled_pickup_at ?? order.scheduledPickupAt ?? order.ScheduledPickupAt),
    image_references: Array.isArray(order.image_references ?? order.ImageReferences)
      ? ((order.image_references ?? order.ImageReferences) as unknown[]).map(String)
      : null,
    customization_notes: nullableStr(order.customization_notes ?? order.CustomizationNotes),
    // Bug fix: these two fields were added to OrderDetailsOrderBlock's type
    // and rendered in order-details.tsx, but never actually mapped here -
    // payload.order.voice_note_url/latest_repair_request were silently
    // undefined at runtime despite the backend genuinely sending them, so
    // neither the voice-note player nor the "Issue reported" section ever
    // showed anything.
    voice_note_url: nullableStr(order.voice_note_url ?? order.VoiceNoteUrl),
    latest_repair_request: (() => {
      const repair = block(order, "latest_repair_request", "LatestRepairRequest");
      const description = nullableStr(repair.issue_description ?? repair.IssueDescription);
      if (!description) return null;
      return {
        issue_description: description,
        issue_photo_urls: Array.isArray(repair.issue_photo_urls ?? repair.IssuePhotoUrls)
          ? ((repair.issue_photo_urls ?? repair.IssuePhotoUrls) as unknown[]).map(String)
          : null,
        reported_at: nullableStr(repair.reported_at ?? repair.ReportedAt) ?? "",
        resolved_at: nullableStr(repair.resolved_at ?? repair.ResolvedAt),
      };
    })(),
    pickup_partner: mapBridgePartner(order, "pickup_partner", "pickupPartner"),
    delivery_partner: mapBridgePartner(order, "delivery_partner", "deliveryPartner"),
    return_partner: mapBridgePartner(order, "return_partner", "returnPartner"),
    repair_pickup_partner: mapBridgePartner(order, "repair_pickup_partner", "repairPickupPartner"),
    repair_delivery_partner: mapBridgePartner(order, "repair_delivery_partner", "repairDeliveryPartner"),
    can_reschedule: Boolean(order.can_reschedule ?? order.canReschedule),
  };
}

function mapDetailsServiceBlock(raw: Record<string, unknown>): OrderDetailsServiceBlock {
  const service = block(raw, "service", "Service");
  return {
    service_name: nullableStr(service.service_name ?? service.serviceName ?? service.name),
    category_name: nullableStr(service.category_name ?? service.categoryName),
    base_price: nullableMoney(service.base_price ?? service.basePrice ?? service.price),
  };
}

function mapDetailsPricingBlock(raw: Record<string, unknown>): OrderDetailsPricingBlock {
  const pricing = block(raw, "pricing", "Pricing", "billing", "Billing");
  return {
    base_amount: nullableMoney(pricing.base_amount ?? pricing.baseAmount ?? pricing.item_total),
    discount_amount: nullableMoney(pricing.discount_amount ?? pricing.discountAmount),
    gst_amount: nullableMoney(pricing.gst_amount ?? pricing.gstAmount ?? pricing.gst),
    cgst_amount: nullableMoney(pricing.cgst_amount ?? pricing.cgstAmount),
    sgst_amount: nullableMoney(pricing.sgst_amount ?? pricing.sgstAmount),
    service_fee: nullableMoney(pricing.service_fee ?? pricing.serviceFee ?? pricing.platform_fee),
    penalty_amount: nullableMoney(pricing.penalty_amount ?? pricing.penaltyAmount),
    final_amount: nullableMoney(
      pricing.final_amount ?? pricing.finalAmount ?? pricing.total_amount,
    ),
    advance_amount: nullableNum(pricing.advance_amount ?? pricing.advanceAmount),
    remaining_amount: nullableNum(pricing.remaining_amount ?? pricing.remainingAmount),
  };
}

function mapDetailsPaymentBlock(raw: Record<string, unknown>): OrderDetailsPaymentBlock {
  const payment = block(raw, "payment", "Payment");
  return {
    amount: nullableMoney(payment.amount ?? payment.paid_amount ?? payment.total_amount),
    payment_method: nullableStr(payment.payment_method ?? payment.paymentMethod),
    payment_status: nullableStr(payment.payment_status ?? payment.paymentStatus),
    transaction_id: nullableStr(payment.transaction_id ?? payment.transactionId),
  };
}

function mapDetailsAddressBlock(
  raw: Record<string, unknown>,
): OrderDetailsDeliveryAddressBlock {
  const addr = block(raw, "delivery_address", "deliveryAddress", "DeliveryAddress", "address");
  return {
    name: nullableStr(addr.name ?? addr.full_name),
    mobile: nullableStr(addr.mobile ?? addr.phone),
    address_line_1: nullableStr(addr.address_line_1 ?? addr.addressLine1 ?? addr.line1),
    city: nullableStr(addr.city),
    state: nullableStr(addr.state),
    pincode: nullableStr(addr.pincode ?? addr.pin_code ?? addr.zip),
  };
}

function mapMeasurementFields(m: Record<string, unknown>): OrderDetailsMeasurementBlock {
  return {
    profile_name: nullableStr(m.profile_name ?? m.profileName ?? m.name),
    gender: nullableStr(m.gender),
    fit: nullableStr(m.fit),
    neck: nullableMoney(m.neck),
    chest: nullableMoney(m.chest),
    waist: nullableMoney(m.waist),
    hips: nullableMoney(m.hips),
    shoulder: nullableMoney(m.shoulder),
    sleeve_length: nullableMoney(m.sleeve_length ?? m.sleeveLength),
    inseam: nullableMoney(m.inseam),
    height: nullableMoney(m.height),
    notes: nullableStr(m.notes),
  };
}

function mapDetailsMeasurementBlock(
  raw: Record<string, unknown>,
): OrderDetailsMeasurementBlock {
  const m = block(raw, "measurement", "Measurement");
  return mapMeasurementFields(m);
}

function mapDetailsLineItems(raw: Record<string, unknown>): OrderDetailsLineItem[] {
  const list = raw.line_items ?? raw.lineItems ?? raw.LineItems;
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const row = item as Record<string, unknown>;
    const measurementRaw = row.measurement as Record<string, unknown> | null | undefined;
    return {
      order_item_id: nullableNum(row.order_item_id ?? row.orderItemId),
      person_name: nullableStr(row.person_name ?? row.personName),
      service_id: nullableNum(row.service_id ?? row.serviceId),
      service_name: nullableStr(row.service_name ?? row.serviceName),
      category_name: nullableStr(row.category_name ?? row.categoryName),
      image_url: nullableStr(row.image_url ?? row.imageUrl ?? row.ImageUrl),
      quantity: nullableNum(row.quantity) ?? 1,
      unit_price: nullableMoney(row.unit_price ?? row.unitPrice),
      line_total: nullableMoney(row.line_total ?? row.lineTotal),
      measurement:
        measurementRaw && typeof measurementRaw === "object"
          ? mapMeasurementFields(measurementRaw)
          : null,
      stitching_preferences:
        row.stitching_preferences && typeof row.stitching_preferences === "object"
          ? (row.stitching_preferences as OrderDetailsLineItem["stitching_preferences"])
          : null,
      notes: nullableStr(row.notes),
      addons: mapLineItemAddons(row.addons),
    };
  });
}

function mapLineItemAddons(raw: unknown): OrderDetailsLineItem["addons"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      addon_id: nullableNum(row.addon_id ?? row.addonId),
      name: nullableStr(row.name) ?? "Addon",
      price: nullableNum(row.price) ?? 0,
      note: nullableStr(row.note),
    };
  });
}

function mapDetailsTimeline(raw: Record<string, unknown>): OrderDetailsTimelineItem[] {
  const list =
    raw.tracking_timeline ??
    raw.trackingTimeline ??
    raw.tracking ??
    raw.timeline ??
    raw.TrackingTimeline;
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      status: nullableStr(row.status ?? row.title ?? row.label),
      timestamp: nullableStr(row.timestamp ?? row.time ?? row.date ?? row.created_at),
    };
  });
}

export function mapCustomerOrderDetailsPayload(
  orderId: number,
  res: unknown,
): CustomerOrderDetailsPayload {
  const raw = unwrapDetailsEnvelope(res);
  const order = mapDetailsOrderBlock(raw);
  const resolvedOrderId = order.order_id ?? orderId;
  return {
    orderId: resolvedOrderId > 0 ? resolvedOrderId : orderId,
    order,
    service: mapDetailsServiceBlock(raw),
    pricing: mapDetailsPricingBlock(raw),
    payment: mapDetailsPaymentBlock(raw),
    delivery_address: mapDetailsAddressBlock(raw),
    measurement: mapDetailsMeasurementBlock(raw),
    line_items: mapDetailsLineItems(raw),
    tracking_timeline: mapDetailsTimeline(raw),
    pendingPenaltyAmount: nullableNum(raw.pending_penalty_amount ?? raw.pendingPenaltyAmount),
  };
}

export async function fetchCustomerOrderSummary(
  orderId: number,
): Promise<CustomerOrderSummaryPayload> {
  const res = await request<unknown>(`${BASE}/${orderId}/summary`);
  return mapCustomerOrderSummaryPayload(orderId, res);
}

export async function fetchCustomerOrderDetails(
  orderId: number,
): Promise<CustomerOrderDetailsPayload> {
  const res = await request<unknown>(`${BASE}/${orderId}/details`);
  return mapCustomerOrderDetailsPayload(orderId, res);
}

export interface OrderRatingInfo {
  order_id: number;
  rating: number;
  comment: string | null;
  already_rated: boolean;
  edited?: boolean;
  updated_at?: string | null;
}

export async function fetchOrderRating(orderId: number): Promise<OrderRatingInfo> {
  return request<OrderRatingInfo>(`${BASE}/${orderId}/rating`);
}

// isEdit selects PATCH (edit a previously-submitted rating - the backend's
// update_order_rating, no time limit) vs POST (submit_order_rating, only
// ever creates the first rating - a second POST 409s). Mirrors the
// website's RatingCard (already_rated ? "PATCH" : "POST").
export async function submitOrderRating(
  orderId: number,
  rating: number,
  comment?: string,
  isEdit = false,
): Promise<OrderRatingInfo> {
  return request<OrderRatingInfo>(`${BASE}/${orderId}/rating`, {
    method: isEdit ? "PATCH" : "POST",
    body: { rating, comment: comment || null },
  });
}

