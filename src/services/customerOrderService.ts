/**
 * Customer orders API
 *   GET /customer/orders/active
 *   GET /customer/orders/completed
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
  OrderDetailsMeasurementBlock,
  OrderDetailsOrderBlock,
  OrderDetailsPaymentBlock,
  OrderDetailsPricingBlock,
  OrderDetailsServiceBlock,
  OrderDetailsTimelineItem,
  OrderSummaryBillingBlock,
  OrderSummaryDatesBlock,
  OrderSummaryDeliveryAddressBlock,
  OrderSummaryOrderBlock,
  OrderSummaryPaymentBlock,
  OrderSummaryServiceBlock,
} from "../types/customerOrders";
import { ORDER_DISPLAY_FALLBACK, orderDisplayValue } from "../types/api";
import { isCompletedCustomerOrderStatus } from "../utils/customerOrderStatus";

const BASE = "/customer/orders";

function extractList(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = res as Record<string, unknown>;
  if (Array.isArray(r?.orders)) return r.orders as Record<string, unknown>[];
  if (Array.isArray(r?.data)) return r.data as Record<string, unknown>[];
  if (Array.isArray(r?.results)) return r.results as Record<string, unknown>[];
  return [];
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

function formatAmountDisplay(obj: Record<string, unknown>): string {
  const display = pickStr(
    obj,
    "amountPaidDisplay",
    "AmountPaidDisplay",
    "amount_paid_display",
    "amountDisplay",
    "AmountDisplay",
    "paid_amount_display",
    "total_display",
  );
  if (display) return display;

  const paid =
    pickNum(obj, "amountPaid", "AmountPaid", "amount_paid", "paid_amount") ||
    pickNum(obj, "total_price", "TotalPrice", "final_amount", "FinalAmount", "total");

  if (paid > 0) {
    return `₹${paid.toLocaleString("en-IN")}`;
  }
  return ORDER_DISPLAY_FALLBACK;
}

function mapListItem(raw: Record<string, unknown>): CustomerOrderListItem {
  const id = pickNum(raw, "id", "Id", "order_id", "OrderId");
  const status = pickStr(raw, "status", "Status").toLowerCase() || "pending";
  const bookingId = pickStr(
    raw,
    "orderNumber",
    "OrderNumber",
    "booking_id",
    "BookingId",
    "booking_number",
    "BookingNumber",
    "order_number",
  );

  const scheduledLabel = pickStr(
    raw,
    "scheduledLabel",
    "ScheduledLabel",
    "scheduled_at_label",
    "scheduled_date_time",
    "ScheduledDateTime",
    "deliveryLabel",
    "DeliveryLabel",
    "expected_delivery_date",
    "ExpectedDeliveryDate",
    "appointment_label",
    "AppointmentLabel",
  );

  return {
    id,
    bookingId: bookingId || (id > 0 ? `ORD${id}` : ORDER_DISPLAY_FALLBACK),
    status,
    statusLabel: orderDisplayValue(
      pickStr(raw, "statusLabel", "StatusLabel", "status_label") || status,
    ),
    scheduledLabel: orderDisplayValue(scheduledLabel || raw.created_at?.toString()),
    amountPaidDisplay: formatAmountDisplay(raw),
    serviceTitle: orderDisplayValue(
      pickStr(raw, "serviceTitle", "ServiceTitle", "service_title", "service_name", "ServiceName"),
    ),
    serviceSubtitle: orderDisplayValue(
      pickStr(
        raw,
        "serviceSubtitle",
        "ServiceSubtitle",
        "service_subtitle",
        "category_name",
        "CategoryName",
      ),
    ),
    canPayNow: pickBool(raw, "canPayNow", "CanPayNow", "can_pay_now", "show_pay_now"),
    paymentStatusLabel:
      pickStr(raw, "paymentStatusLabel", "PaymentStatusLabel", "payment_status_label") ||
      undefined,
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
      return { label: label || "—", value: orderDisplayValue(value) };
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

export async function fetchActiveCustomerOrders(): Promise<CustomerOrderListItem[]> {
  const res = await request<unknown>(`${BASE}/active`);
  return extractList(res).map(mapListItem).filter((o) => o.id > 0);
}

export async function fetchCompletedCustomerOrders(): Promise<CustomerOrderListItem[]> {
  const res = await request<unknown>(`${BASE}/completed`);
  return extractList(res).map(mapListItem).filter((o) => o.id > 0);
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
    service_fee: nullableMoney(billing.service_fee ?? billing.serviceFee),
    discount: nullableMoney(billing.discount ?? billing.discount_amount),
    total_amount: nullableMoney(
      billing.total_amount ??
        billing.totalAmount ??
        billing.final_amount ??
        billing.finalAmount,
    ),
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

function mapDetailsOrderBlock(raw: Record<string, unknown>): OrderDetailsOrderBlock {
  const order = block(raw, "order", "Order");
  return {
    order_code: nullableStr(order.order_code ?? order.orderCode),
    order_id: nullableNum(order.order_id ?? order.orderId ?? order.id ?? order.Id),
    status: nullableStr(order.status ?? order.Status),
    urgency_level: nullableStr(order.urgency_level ?? order.urgencyLevel),
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
    final_amount: nullableMoney(
      pricing.final_amount ?? pricing.finalAmount ?? pricing.total_amount,
    ),
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

function mapDetailsMeasurementBlock(
  raw: Record<string, unknown>,
): OrderDetailsMeasurementBlock {
  const m = block(raw, "measurement", "Measurement");
  return {
    profile_name: nullableStr(m.profile_name ?? m.profileName ?? m.name),
    gender: nullableStr(m.gender),
    fit: nullableStr(m.fit),
    chest: nullableMoney(m.chest),
    waist: nullableMoney(m.waist),
  };
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
    tracking_timeline: mapDetailsTimeline(raw),
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

