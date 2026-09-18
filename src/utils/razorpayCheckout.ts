import { Platform } from "react-native";
import {
  RAZORPAY_CHECKOUT_NAME,
  RAZORPAY_THEME_COLOR,
} from "../../constants/razorpay";
import {
  EXPO_GO_RAZORPAY_MESSAGE,
  getRazorpayCheckoutModule,
  isRazorpayNativeAvailable,
} from "./razorpayNative";

export type RazorpaySuccessData = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayOpenParams = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  description?: string;
  prefill?: { email?: string; contact?: string; name?: string };
};

export class PaymentCancelledError extends Error {
  constructor() {
    super("Payment cancelled");
    this.name = "PaymentCancelledError";
  }
}

/** Thrown when Razorpay native module is unavailable (e.g. Expo Go). */
export class DevelopmentBuildRequiredError extends Error {
  constructor(message = EXPO_GO_RAZORPAY_MESSAGE) {
    super(message);
    this.name = "DevelopmentBuildRequiredError";
  }
}

// Razorpay's native Checkout SDK (shared contract across Android/iOS -
// react-native-razorpay's native modules on both platforms just forward the
// SDK's own onPaymentError(code, ...) unchanged) reports errors as:
//   0 = NETWORK_ERROR, 1 = INVALID_OPTIONS, 2 = PAYMENT_CANCELED,
//   3 = TLS_ERROR, 4 = INCOMPATIBLE_PLUGINS, 5 = UNKNOWN_ERROR
// This previously checked `code === 0`, which is NETWORK_ERROR, not a
// cancel - a genuine decline (insufficient balance / wrong UPI) that the
// user then exits from could be misclassified depending on whatever
// English description string Razorpay happened to send that day, since
// the only other check was a raw "cancel" substring match with no
// contract guaranteeing it. A real network error must also never be
// treated as a user cancel - it needs its own clear "check your
// connection" message, not either of the other two branches.
function isCancelledError(err: unknown): boolean {
  const e = err as { code?: number; description?: string; message?: string };
  if (e?.code === 2) return true;
  if (typeof e?.code === "number") return false;
  // No numeric code at all (some SDK paths reject with a bare Error) - fall
  // back to the description, but only as a secondary signal, never primary.
  const desc = (e?.description ?? e?.message ?? "").toLowerCase();
  return desc.includes("cancel");
}

function isNetworkError(err: unknown): boolean {
  const e = err as { code?: number };
  return e?.code === 0;
}

export { isRazorpayNativeAvailable, EXPO_GO_RAZORPAY_MESSAGE };

/**
 * Opens native Razorpay checkout (development build or production only).
 */
export async function openRazorpayCheckout(
  params: RazorpayOpenParams
): Promise<RazorpaySuccessData> {
  if (Platform.OS === "web") {
    throw new Error("Online payment is only available on the mobile app.");
  }

  if (!isRazorpayNativeAvailable()) {
    throw new DevelopmentBuildRequiredError();
  }

  if (!params.key?.trim() || !params.order_id?.trim() || params.amount <= 0) {
    throw new Error("Invalid payment configuration. Please try again.");
  }

  const RazorpayCheckout = getRazorpayCheckoutModule();
  if (!RazorpayCheckout) {
    throw new DevelopmentBuildRequiredError();
  }

  try {
    const data = await RazorpayCheckout.open({
      key: params.key,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      name: RAZORPAY_CHECKOUT_NAME,
      description: params.description ?? "Order payment",
      prefill: params.prefill ?? {},
      theme: { color: RAZORPAY_THEME_COLOR },
    });

    if (
      !data?.razorpay_payment_id ||
      !data?.razorpay_order_id ||
      !data?.razorpay_signature
    ) {
      throw new Error("Payment completed but response was incomplete.");
    }

    return {
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_order_id: data.razorpay_order_id,
      razorpay_signature: data.razorpay_signature,
    };
  } catch (err) {
    if (err instanceof DevelopmentBuildRequiredError) throw err;
    if (isCancelledError(err)) {
      throw new PaymentCancelledError();
    }
    if (isNetworkError(err)) {
      throw new Error("Could not reach the payment gateway. Check your connection and try again.");
    }
    const e = err as { description?: string; message?: string };
    throw new Error(e?.description ?? e?.message ?? "Payment failed. Please try again.");
  }
}
