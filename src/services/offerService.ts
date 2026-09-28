import { request } from "../../services/api";
import type { ApiSpecialOffer } from "../types/homeApi";

function mapOffer(raw: Record<string, unknown>): ApiSpecialOffer {
  return {
    Id: Number(raw.offer_id),
    Title: String(raw.title ?? ""),
    Description: String(raw.description ?? ""),
    DiscountType: raw.discount_type === "flat" ? "flat" : "percentage",
    DiscountPercent: Number(raw.discount_percent ?? 0),
    DiscountAmount: raw.discount_amount != null ? Number(raw.discount_amount) : null,
    MinOrderValue: raw.min_order_value != null ? Number(raw.min_order_value) : 0,
    MaxDiscountAmount:
      raw.max_discount_amount != null ? Number(raw.max_discount_amount) : null,
    ImageUrl: raw.image_url != null ? String(raw.image_url) : null,
    ValidFrom: raw.valid_from != null ? String(raw.valid_from) : null,
    ValidUntil: raw.valid_until != null ? String(raw.valid_until) : "",
  };
}

// Cart/Book Now's "Available Offers" list - GET /offers (services.py),
// scoped to the logged-in customer (already-used coupons excluded server-
// side). Distinct from useHomeStore's special_offers, which comes from the
// homepage's GET /home and is a globally Redis-cached, unauthenticated
// payload with no per-user filtering at all - reusing it here was why an
// already-used coupon kept showing as "Available" on Cart/Book Now even
// after the /offers endpoint itself was fixed to exclude it.
export async function listOffers(): Promise<ApiSpecialOffer[]> {
  const raw = await request<{ offers?: unknown }>("/offers");
  const list = Array.isArray(raw?.offers) ? raw.offers : [];
  return list.map((o) => mapOffer(o as Record<string, unknown>));
}

// Manual coupon-code entry (cart/checkout "Apply" box), the counterpart to
// browsing the pre-listed offers already shown on Cart/Book Now (both
// backed by useHomeStore's special_offers). Backend: GET /offers/validate
// (app/api/v1/endpoints/services.py) - checks IsActive, the validity
// window, and this customer's own prior usage of the coupon before
// returning it; checkout/create_direct_order still recompute and enforce
// the same rules server-side regardless, so nothing here is authoritative
// pricing. Requires auth (the one-time-per-user check needs to know who's
// asking) - same as every other order/cart endpoint in this app.
//
// The shared request() helper never preserves HTTP status on its thrown
// Error (see services/api.ts) - only a plain message string survives - so
// callers can't branch on 404-vs-409 here. That's fine: the backend's
// messages ("This coupon code is invalid or has expired." / "You've
// already used this coupon.") are already customer-facing text, safe to
// show directly via err.message, same pattern every other screen in this
// app already uses for its own catch blocks.
export async function validateCouponCode(code: string): Promise<ApiSpecialOffer> {
  const raw = await request<Record<string, unknown>>(
    `/offers/validate?code=${encodeURIComponent(code.trim())}`,
  );
  return {
    Id: Number(raw.offer_id),
    Title: String(raw.title ?? ""),
    Description: String(raw.description ?? ""),
    DiscountType: raw.discount_type === "flat" ? "flat" : "percentage",
    DiscountPercent: Number(raw.discount_percent ?? 0),
    DiscountAmount: raw.discount_amount != null ? Number(raw.discount_amount) : null,
    MinOrderValue: raw.min_order_value != null ? Number(raw.min_order_value) : 0,
    MaxDiscountAmount:
      raw.max_discount_amount != null ? Number(raw.max_discount_amount) : null,
    ImageUrl: raw.image_url != null ? String(raw.image_url) : null,
    ValidFrom: raw.valid_from != null ? String(raw.valid_from) : null,
    ValidUntil: raw.valid_until != null ? String(raw.valid_until) : "",
  };
}
