import { request } from "../../services/api";
import type {
  AddCartServiceEntryPayload,
  ApiCart,
  CartBilling,
  CartCheckoutPayload,
  CartCheckoutResult,
  CartEntryMeasurement,
  CartServiceEntry,
  CheckoutLineItem,
  MeasurementPreviewItem,
  UpdateCartServiceEntryPayload,
} from "../types/cart";
import { EMPTY_CART } from "../types/cart";

const BASE = "/cart";

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

function mapMeasurementPreview(raw: unknown): MeasurementPreviewItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = asRecord(item);
    return {
      name: str(r.measurement_name),
      value: str(r.measurement_value),
    };
  });
}

function mapEntryMeasurement(raw: unknown): CartEntryMeasurement | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    id: num(r.id),
    userId: num(r.user_id),
    profileName: str(r.profile_name),
    gender: r.gender != null ? str(r.gender) : null,
    chest: num(r.chest),
    waist: num(r.waist),
    hips: num(r.hips),
    shoulder: num(r.shoulder),
    neck: num(r.neck),
    sleeveLength: num(r.sleeve_length),
    inseam: num(r.inseam),
    height: num(r.height),
    fitPreference: r.fit_preference != null ? str(r.fit_preference) : null,
    notes: r.notes != null ? str(r.notes) : null,
    isDefault: Boolean(r.is_default),
  };
}

function mapCartEntry(raw: Record<string, unknown>): CartServiceEntry {
  return {
    id: num(raw.entry_id ?? raw.id),
    serviceId: num(raw.service_id),
    serviceName: str(raw.service_name, "Service"),
    categoryName: raw.category_name != null ? str(raw.category_name) : null,
    personName: str(raw.person_name),
    gender: raw.gender != null ? str(raw.gender) : null,
    quantity: num(raw.quantity, 1),
    unitPrice: num(raw.unit_price ?? raw.price),
    lineTotal: num(raw.line_total),
    unitPriceDisplay: str(raw.unit_price_display ?? raw.price_display, "₹0"),
    lineTotalDisplay: str(raw.line_total_display, "₹0"),
    notes: raw.notes != null ? str(raw.notes) : null,
    measurementId: raw.measurement_id != null ? num(raw.measurement_id) : null,
    measurementRequired: Boolean(raw.measurement_required),
    measurement: mapEntryMeasurement(raw.measurement),
    measurementPreview: mapMeasurementPreview(raw.measurement_preview),
  };
}

function mapBilling(raw: unknown): CartBilling {
  const r = asRecord(raw);
  return {
    itemTotal: num(r.item_total),
    discount: num(r.discount),
    platformFee: num(r.platform_fee),
    cgstAmount: num(r.cgst_amount),
    sgstAmount: num(r.sgst_amount),
    gstAmount: num(r.gst_amount),
    totalAmount: num(r.total_amount),
    advanceAmount: num(r.advance_amount),
    remainingAmount: num(r.remaining_amount),
    itemTotalDisplay: str(r.item_total_display, "₹0"),
    platformFeeDisplay: str(r.platform_fee_display, "₹0"),
    cgstDisplay: str(r.cgst_display, "₹0"),
    sgstDisplay: str(r.sgst_display, "₹0"),
    gstDisplay: str(r.gst_display, "₹0"),
    totalAmountDisplay: str(r.total_amount_display, "₹0"),
    advanceAmountDisplay: str(r.advance_amount_display, "₹0"),
    remainingAmountDisplay: str(r.remaining_amount_display, "₹0"),
  };
}

export function mapCart(raw: unknown): ApiCart {
  if (!raw) return { ...EMPTY_CART };
  const r = asRecord(raw);

  const entriesRaw = Array.isArray(r.service_entries) ? r.service_entries : [];
  const entries = entriesRaw
    .map((item) => mapCartEntry(asRecord(item)))
    .filter((e) => e.id > 0 || e.serviceId > 0);

  const itemCount = entries.reduce((sum, e) => sum + e.quantity, 0);

  return {
    id: num(r.id),
    customerId: num(r.customer_id),
    status: str(r.status),
    address: r.address ?? null,
    totalAmount: num(r.total_amount),
    totalAmountDisplay: str(r.total_amount_display, "₹0"),
    billing: mapBilling(r.billing),
    entries,
    itemCount,
  };
}

function mapCheckoutLineItems(raw: unknown): CheckoutLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = asRecord(item);
    return {
      personName: str(r.person_name),
      serviceName: str(r.service_name, "Service"),
      categoryName: r.category_name != null ? str(r.category_name) : null,
      quantity: num(r.quantity, 1),
      unitPrice: num(r.unit_price),
      lineTotal: num(r.line_total),
      price: num(r.price),
      priceDisplay: str(r.price_display, "₹0"),
      measurements: mapMeasurementPreview(r.measurements),
    };
  });
}

function mapCheckoutResult(raw: unknown): CartCheckoutResult {
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
    finalAmount: num(r.final_amount),
    totalAmountDisplay: str(r.total_amount_display, "₹0"),
    advanceAmount: num(r.advance_amount),
    advanceAmountDisplay: str(r.advance_amount_display, "₹0"),
    remainingAmount: num(r.remaining_amount),
    remainingAmountDisplay: str(r.remaining_amount_display, "₹0"),
    lineItems: mapCheckoutLineItems(r.line_items),
    message: str(r.message),
  };
}

/** GET /cart — returns null when no active cart exists */
export async function fetchCart(): Promise<ApiCart | null> {
  const res = await request<unknown>(BASE, { allowNotFound: true });
  if (res == null) return null;
  const cart = mapCart(res);
  if (cart.id > 0 || cart.entries.length > 0) return cart;
  return null;
}

/** POST /cart — create a new cart */
export async function createCart(): Promise<ApiCart> {
  const res = await request<unknown>(BASE, { method: "POST", body: {} });
  const cart = mapCart(res);
  if (cart.id <= 0) {
    throw new Error("Could not create cart. Please try again.");
  }
  return cart;
}

/** GET active cart or create one if missing */
export async function getOrCreateCart(): Promise<ApiCart> {
  const existing = await fetchCart();
  if (existing) return existing;
  return createCart();
}

/** POST /cart/service-entry */
export async function addCartServiceEntry(
  payload: AddCartServiceEntryPayload,
): Promise<ApiCart> {
  if (payload.service_id <= 0) {
    throw new Error("A valid service is required.");
  }

  const body: Record<string, unknown> = {
    service_id: payload.service_id,
    quantity: payload.quantity ?? 1,
  };

  if (payload.measurement_profile_id && payload.measurement_profile_id > 0) {
    body.measurement_profile_id = payload.measurement_profile_id;
    body.measurement_id =
      payload.measurement_id ?? payload.measurement_profile_id;
  }

  if (payload.selected_size) body.selected_size = payload.selected_size;
  if (
    payload.selected_measurements &&
    Object.keys(payload.selected_measurements).length > 0
  ) {
    body.selected_measurements = payload.selected_measurements;
  }
  if (payload.tailor_id) body.tailor_id = payload.tailor_id;
  if (payload.customization_notes) {
    body.customization_notes = payload.customization_notes;
  }

  const res = await request<unknown>(`${BASE}/service-entry`, {
    method: "POST",
    body,
  });

  return mapCart(res);
}

/** PUT /cart/service-entry/{entry_id} */
export async function updateCartServiceEntry(
  entryId: number,
  payload: UpdateCartServiceEntryPayload,
): Promise<ApiCart> {
  if (entryId <= 0) throw new Error("Invalid cart item.");
  if (payload.quantity < 1) {
    throw new Error("Quantity must be at least 1.");
  }

  const res = await request<unknown>(`${BASE}/service-entry/${entryId}`, {
    method: "PUT",
    body: { quantity: payload.quantity },
  });

  return mapCart(res);
}

/** DELETE /cart/service-entry/{entry_id} */
export async function deleteCartServiceEntry(entryId: number): Promise<ApiCart> {
  if (entryId <= 0) throw new Error("Invalid cart item.");

  const res = await request<unknown>(`${BASE}/service-entry/${entryId}`, {
    method: "DELETE",
  });

  const mapped = mapCart(res);
  if (mapped.id > 0 || mapped.entries.length > 0) return mapped;

  // Some backends return just {message} on delete — refetch to get fresh state.
  const fresh = await fetchCart();
  return fresh ?? { ...EMPTY_CART };
}

/** POST /cart/checkout */
export async function checkoutCart(
  payload: CartCheckoutPayload,
): Promise<CartCheckoutResult> {
  if (payload.address_id <= 0) {
    throw new Error("Delivery address is required.");
  }

  const res = await request<unknown>(`${BASE}/checkout`, {
    method: "POST",
    body: {
      address_id: payload.address_id,
      payment_method: payload.payment_method ?? "online",
    },
  });

  if (__DEV__) {
    console.log("Checkout Response", res);
  }

  const result = mapCheckoutResult(res);

  if (result.orderId <= 0) {
    throw new Error("Checkout succeeded but no order ID was returned.");
  }
  if (result.advanceAmount <= 0) {
    throw new Error("Unable to determine payable amount.");
  }

  return result;
}