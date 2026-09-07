import { request } from "../../services/api";
import type { ApiSpecialOffer } from "../types/homeApi";

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
    ImageUrl: raw.image_url != null ? String(raw.image_url) : null,
    ValidFrom: raw.valid_from != null ? String(raw.valid_from) : null,
    ValidUntil: raw.valid_until != null ? String(raw.valid_until) : "",
  };
}
