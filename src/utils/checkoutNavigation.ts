import type { ImperativeRouter } from "expo-router";
import { Alert } from "react-native";

import { useAuthStore } from "../../store/useAuthStore";
import { useAddressStore } from "../store/useAddressStore";
import { useCartStore } from "../store/useCartStore";
import { useOrderStore } from "../store/useOrderStore";
import { useCustomerOrdersStore } from "../store/useCustomerOrdersStore";
import type { PaymentMethodOption } from "../types/payment";
import { getDefaultAddress } from "./addressDisplay";

/** Resolve delivery address for cart checkout (store selection → saved default). */
export function resolveCheckoutAddressId(): number | null {
  const selected = useCartStore.getState().selectedAddressId;
  if (selected != null && selected > 0) return selected;

  const addresses = useAddressStore.getState().addresses;
  const fallback = getDefaultAddress(addresses);
  return fallback?.id ?? null;
}

// Module-level guard: this function is called fire-and-forget from button
// handlers (including from inside Alert.alert confirm callbacks, which
// aren't protected by React's own disabled-button re-render timing), so a
// second call while the first is still in flight must be a no-op rather
// than creating a duplicate order.
let checkoutInFlight = false;

/**
 * Cart checkout - validate address, create order, then either open the
 * Razorpay payment screen (Online) or land straight on Order Success (COD,
 * which the backend creates already placed - no gateway involved).
 * Skips Order Summary / review screen.
 */
export async function executeCheckoutFromCart(
  router: ImperativeRouter,
  scheduled?: { scheduledPickupAt: string; pickupTimeSlot: string },
  paymentMethod: PaymentMethodOption = "online",
  extras?: { customizationNotes?: string; imageReferences?: string[] },
): Promise<void> {
  if (checkoutInFlight) return;

  const cart = useCartStore.getState();
  if (cart.itemCount <= 0 || cart.entries.length === 0) return;

  checkoutInFlight = true;
  try {
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

    // result.advanceAmount is the exact figure the backend will charge - now
    // the order's full amount (no advance/remaining split; COD and online
    // both collect the whole amount in a single event) - this is what gets
    // passed to the payment screen, never a locally recomputed value.
    const result = await cart.checkout({
      address_id: addressId,
      payment_method: paymentMethod,
      pickup_type: cart.pickupType ?? "instant",
      ...(cart.appliedOfferId ? { offer_id: cart.appliedOfferId } : {}),
      ...(scheduled ? {
        scheduled_pickup_at: scheduled.scheduledPickupAt,
        pickup_time_slot: scheduled.pickupTimeSlot,
      } : {}),
      ...(extras?.customizationNotes ? { customization_notes: extras.customizationNotes } : {}),
      ...(extras?.imageReferences?.length ? { image_references: extras.imageReferences } : {}),
    });

    useOrderStore.getState().invalidateCache();
    useCustomerOrdersStore.getState().invalidateCache();

    if (paymentMethod === "cod") {
      router.replace({
        pathname: "/order-success" as never,
        params: {
          orderId: String(result.orderId),
          orderCode: result.orderCode,
          amount: String(result.finalAmount),
          remaining: String(result.remainingAmount ?? 0),
          payment: "cod_pending",
        },
      });
      return;
    }

    // Genuinely nothing to charge (e.g. a fully-discounted order totals ₹0)
    // - the order is already placed server-side, so there's no gateway to
    // open. Skip /payment entirely rather than sending the customer into a
    // screen that can never open Razorpay for a ₹0 amount.
    if (result.advanceAmount <= 0) {
      router.replace({
        pathname: "/order-success" as never,
        params: {
          orderId: String(result.orderId),
          orderCode: result.orderCode,
          amount: String(result.finalAmount),
          remaining: String(result.remainingAmount ?? 0),
          payment: "fully_paid",
        },
      });
      return;
    }

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
  } finally {
    checkoutInFlight = false;
  }
}

/** @deprecated Use executeCheckoutFromCart - kept for imports during migration */
export const navigateToCheckoutFromCart = executeCheckoutFromCart;