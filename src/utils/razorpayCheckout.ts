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

function isCancelledError(err: unknown): boolean {
  const e = err as { code?: number; description?: string; message?: string };
  const desc = (e?.description ?? e?.message ?? "").toLowerCase();
  return e?.code === 0 || desc.includes("cancel");
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
    const e = err as { description?: string; message?: string };
    throw new Error(e?.description ?? e?.message ?? "Payment failed. Please try again.");
  }
}
