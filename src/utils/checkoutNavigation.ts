import type { Router } from "expo-router";
import { Alert } from "react-native";

import { useAuthStore } from "../../store/useAuthStore";
import { useAddressStore } from "../store/useAddressStore";
import { useCartStore } from "../store/useCartStore";
import { useOrderStore } from "../store/useOrderStore";
import { getDefaultAddress } from "./addressDisplay";

/** Resolve delivery address for cart checkout (store selection → saved default). */
export function resolveCheckoutAddressId(): number | null {
  const selected = useCartStore.getState().selectedAddressId;
  if (selected != null && selected > 0) return selected;

  const addresses = useAddressStore.getState().addresses;
  const fallback = getDefaultAddress(addresses);
  return fallback?.id ?? null;
}

/**
 * Cart checkout — validate address, create order, open Razorpay payment screen.
 * Skips Order Summary / review screen.
 */
export async function executeCheckoutFromCart(router: Router): Promise<void> {
  const cart = useCartStore.getState();
  if (cart.itemCount <= 0 || cart.entries.length === 0) return;

  cart.setCheckoutFlow(true);

  const addressStore = useAddressStore.getState();
  if (addressStore.addresses.length === 0 && !addressStore.loading) {
    await addressStore.fetchAddresses().catch(() => {});
  }

  const addressId = resolveCheckoutAddressId();
  if (!addressId) {
    router.push("/address");
    return;
  }

  cart.setAddressId(addressId);

  try {
    // result.advanceAmount is the exact figure the backend will charge —
    // this is what gets passed to the payment screen, never a locally
    // recomputed value.
    const result = await cart.checkout({
      address_id: addressId,
      payment_method: "online",
    });

    useOrderStore.getState().invalidateCache();

    const user = useAuthStore.getState().user;
    const customerName =
      user?.name?.trim() ||
      `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() ||
      undefined;

    router.push({
      pathname: "/payment",
      params: {
        orderId: String(result.orderId),
        orderCode: result.orderCode,
        paymentId: String(result.paymentId),
        amount: String(result.advanceAmount),
        amountDisplay: result.advanceAmountDisplay,
        remainingAmount: String(result.remainingAmount),
        remainingAmountDisplay: result.remainingAmountDisplay,
        ...(customerName ? { customerName } : {}),
        ...(user?.email?.trim() ? { email: user.email.trim() } : {}),
        ...(user?.mobile?.trim() ? { phone: user.mobile.trim() } : {}),
      },
    });
  } catch (err) {
    Alert.alert(
      "Checkout Failed",
      err instanceof Error ? err.message : "Checkout failed. Please try again.",
    );
  }
}

/** @deprecated Use executeCheckoutFromCart — kept for imports during migration */
export const navigateToCheckoutFromCart = executeCheckoutFromCart;