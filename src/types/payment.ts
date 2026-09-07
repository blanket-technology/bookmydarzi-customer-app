/**
 * Checkout payment-method selection - the set the backend actually accepts
 * today (app/constants/payment_method.py: PaymentMethod.ALL = ("online", "cod")).
 *
 * Kept separate from the broader `PaymentMethodType` in src/types/api.ts
 * (which includes "upi"/"card" as aspirational gateway sub-methods) so the
 * checkout selector never offers an option the backend would reject.
 */
export type PaymentMethodOption = "online" | "cod";

export interface PaymentMethodMeta {
  value: PaymentMethodOption;
  /** Checkout-selector card title, e.g. "Pay Online". */
  title: string;
  subtitle: string;
  icon: "card-outline" | "cash-outline";
  /** Small badge shown on the card, e.g. "Recommended". Omit for none. */
  badge?: string;
  /** Short display label used everywhere else (Order Summary, Order
   * Details, Order History, Order Success) - e.g. "Online" / "Cash on
   * Delivery". Distinct from `title`, which is checkout-selector-specific
   * phrasing ("Pay Online"). */
  displayLabel: string;
}

/** Single source of truth for payment-method copy/icons across the whole
 * app - checkout selector, Order Summary, Order Details, Order History,
 * Order Success. Add a new entry here (and to PaymentMethodOption) when a
 * new method is introduced; no other file should hardcode this copy. */
export const PAYMENT_METHOD_META: Record<PaymentMethodOption, PaymentMethodMeta> = {
  online: {
    value: "online",
    title: "Pay Online",
    subtitle: "UPI, Cards, Netbanking & Wallets",
    icon: "card-outline",
    badge: "Recommended",
    displayLabel: "Online",
  },
  cod: {
    value: "cod",
    title: "Cash on Delivery",
    subtitle: "Pay securely after your order is delivered.",
    icon: "cash-outline",
    displayLabel: "Cash on Delivery",
  },
};

export const PAYMENT_METHOD_ORDER: PaymentMethodOption[] = ["online", "cod"];

/** Shared payment-action button labels - reused by PaymentCard,
 * BookingCompactCard, and Order Summary so retry/pay/place-order copy never
 * drifts between screens. */
export const PAYMENT_ACTION_LABELS = {
  payNow: "Pay Now",
  retryPayment: "Retry Payment",
  placeOrder: "Place Order",
  proceedToPayment: "Proceed to Payment",
  payRemainingBalance: "Pay Remaining Balance",
} as const;

/** Shared COD status-line copy - reused by PaymentCard and BookingCompactCard. */
export const COD_STATUS_LABELS = {
  pending: "Pay on Delivery",
  collected: "Payment Collected",
} as const;
