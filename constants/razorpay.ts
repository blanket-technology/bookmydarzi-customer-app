/**
 * Razorpay Key ID - used when backend does not return razorpay_key in /payments/create.
 * Set EXPO_PUBLIC_RAZORPAY_KEY in .env (public key only; never put Razorpay Secret in the app).
 */
export const RAZORPAY_KEY_ID =
  process.env.EXPO_PUBLIC_RAZORPAY_KEY?.trim() || "";

if (!RAZORPAY_KEY_ID) {
  console.error("RAZORPAY KEY NOT CONFIGURED");
}

export const RAZORPAY_THEME_COLOR = "#0c6c75";

export const RAZORPAY_CHECKOUT_NAME = "DarziApp";
