/**
 * Client-side coupon discount estimate - display only. The backend
 * (checkout_service.py / direct_order_service.py) always recomputes and
 * enforces the real discount server-side from just the offer_id; this
 * mirrors that same formula (percentage capped by MaxDiscountAmount, both
 * types capped by the order total) purely so the estimate shown before
 * checkout matches what checkout will actually charge. Previously each
 * screen (cart.tsx, buy-now-review.tsx) reimplemented this inline and had
 * already drifted - one had the total-amount cap on percentage discounts,
 * the other didn't.
 */
export interface DiscountEstimateInput {
  discountType: "flat" | "percentage";
  discountValue: number;
  maxDiscountAmount?: number | null;
}

export function estimateCouponDiscount(
  offer: DiscountEstimateInput | null | undefined,
  orderTotal: number,
): number {
  if (!offer || offer.discountValue <= 0 || orderTotal <= 0) return 0;
  const raw =
    offer.discountType === "flat"
      ? Math.round(offer.discountValue)
      : Math.round(orderTotal * (offer.discountValue / 100) * 100) / 100;
  return Math.min(raw, offer.maxDiscountAmount ?? Infinity, orderTotal);
}
