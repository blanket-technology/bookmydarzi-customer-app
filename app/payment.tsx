/**
 * PaymentScreen - Razorpay checkout for Pay Now orders.
 * Route params: orderId, amount, customerName?, email?, phone?
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import ScreenHeader from "../src/components/common/ScreenHeader";
import {
  confirmRazorpayPayment,
  isValidOrderId,
  parsePositiveId,
  PaymentAlreadyCompletedError,
  resolvePaymentSessionForOrder,
} from "../src/services/paymentService";
import { useCartStore } from "../src/store/useCartStore";
import { useCustomerOrdersStore } from "../src/store/useCustomerOrdersStore";
import { useOrderStore } from "../src/store/useOrderStore";
import type { RazorpayPaymentSession } from "../src/types/api";
import { isPaymentSuccess } from "../src/utils/paymentStatus";
import {
  DevelopmentBuildRequiredError,
  EXPO_GO_RAZORPAY_MESSAGE,
  isRazorpayNativeAvailable,
  openRazorpayCheckout,
  PaymentCancelledError,
  type RazorpaySuccessData,
} from "../src/utils/razorpayCheckout";
import { safeRouterReplace } from "../src/utils/safeNavigation";

type ScreenState =
  | "loading"
  | "ready"
  | "paying"
  | "verifying"
  // Razorpay already charged the customer, but confirming that with our own
  // backend failed (network/timeout) - never let a retry from here reopen
  // Razorpay, since that would risk a second charge. Only retries the
  // idempotent verify call with the same gateway result.
  | "verification_failed"
  | "error"
  | "dev_build_required";

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId?: string;
    orderCode?: string;
    amount?: string;
    customerName?: string;
    email?: string;
    phone?: string;
  }>();

  const orderId = parsePositiveId(params.orderId);
  const orderCode = params.orderCode?.trim() || undefined;
  const amountRupee = Number(params.amount ?? 0);
  const customerName = params.customerName?.trim() || undefined;
  const email = params.email?.trim() || undefined;
  const phone = params.phone?.trim() || undefined;

  const [state, setState] = useState<ScreenState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [session, setSession] = useState<RazorpayPaymentSession | null>(null);
  // Kept only for the verification_failed recovery path - retrying verify
  // must reuse the exact gateway result, never a fresh Razorpay session.
  const [pendingGatewayResult, setPendingGatewayResult] = useState<RazorpaySuccessData | null>(null);

  const checkoutStarted = useRef(false);
  const isBusy = useRef(false);
  const razorpayAvailable = isRazorpayNativeAvailable();

  const finishSuccess = useCallback((paidAmountRupees?: number) => {
    useOrderStore.getState().invalidateCache();
    useCustomerOrdersStore.getState().invalidateCache();
    void useCartStore
      .getState()
      .refreshCart({ silent: true, allowCreate: false });
    safeRouterReplace(router, {
      pathname: "/order-success" as any,
      params: {
        orderId: String(orderId),
        ...(orderCode ? { orderCode } : {}),
        amount: paidAmountRupees != null ? String(paidAmountRupees) : undefined,
      },
    });
  }, [orderId, orderCode, router]);

  const loadSession = useCallback(async () => {
    if (!razorpayAvailable) {
      setState("dev_build_required");
      return;
    }
    if (!isValidOrderId(orderId)) {
      setErrorMsg("Invalid order. Cannot start payment.");
      setState("error");
      return;
    }

    const payAmount = amountRupee > 0 ? amountRupee : 0;
    if (payAmount <= 0) {
      // Nothing to charge upfront (e.g. zero platform fee) - the order was
      // already placed either way, so treat this as already-settled rather
      // than a dead-end error screen with no way forward.
      finishSuccess(0);
      return;
    }

    setState("loading");
    setErrorMsg(null);

    try {
      const { session: s } = await resolvePaymentSessionForOrder(
        orderId,
        payAmount,
      );
      setSession(s);
      setState("ready");
    } catch (err) {
      if (err instanceof PaymentAlreadyCompletedError) {
        finishSuccess();
        return;
      }
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not start payment. Try again.",
      );
      setState("error");
    }
  }, [orderId, amountRupee, razorpayAvailable, finishSuccess]);

  // Kicks off the async payment-session load on mount - a real network
  // side-effect, not derivable during render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession();
  }, [loadSession]);

  /** Confirms an already-obtained Razorpay result with our backend. Shared
   * by the initial checkout flow and the verification-failed retry, so a
   * network hiccup on the confirm call never requires reopening Razorpay
   * (which would risk a second charge). */
  const confirmWithBackend = useCallback(
    async (session_: RazorpayPaymentSession, result: RazorpaySuccessData) => {
      setState("verifying");
      setErrorMsg(null);

      try {
        const confirmed = await confirmRazorpayPayment(
          session_.payment_id,
          session_.order_id,
          result,
        );

        if (!confirmed || !isPaymentSuccess(confirmed.status)) {
          throw new Error(
            "Payment could not be confirmed. If amount was deducted, check My Orders.",
          );
        }

        setPendingGatewayResult(null);
        finishSuccess(session_.amount / 100);
      } catch (err) {
        // The gateway already charged the customer by this point - never
        // treat this as "nothing happened, try again from scratch". Keep
        // the result so a retry only re-verifies, never reopens Razorpay.
        setPendingGatewayResult(result);
        setState("verification_failed");
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Could not confirm your payment. If amount was deducted, check My Orders.",
        );
      }
    },
    [finishSuccess],
  );

  const openCheckout = useCallback(async () => {
    if (!session || isBusy.current) return;
    isBusy.current = true;
    setState("paying");
    setErrorMsg(null);

    try {
      const result = await openRazorpayCheckout({
        key: session.razorpay_key,
        amount: session.amount,
        currency: session.currency,
        order_id: session.razorpay_order_id,
        description: `Order #${orderCode ?? orderId}`,
        prefill: {
          name: customerName,
          email,
          contact: phone,
        },
      });

      await confirmWithBackend(session, result);
    } catch (err) {
      if (err instanceof DevelopmentBuildRequiredError) {
        setState("dev_build_required");
        setErrorMsg(err.message);
      } else if (err instanceof PaymentCancelledError) {
        setState("ready");
        setErrorMsg("Payment cancelled. You can try again or check My Orders.");
      } else {
        setState("ready");
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Payment failed. Please try again.",
        );
      }
    } finally {
      isBusy.current = false;
    }
  }, [session, orderId, orderCode, customerName, email, phone, confirmWithBackend]);

  const retryVerification = useCallback(async () => {
    if (!session || !pendingGatewayResult || isBusy.current) return;
    isBusy.current = true;
    try {
      await confirmWithBackend(session, pendingGatewayResult);
    } finally {
      isBusy.current = false;
    }
  }, [session, pendingGatewayResult, confirmWithBackend]);

  useEffect(() => {
    if (
      razorpayAvailable &&
      state === "ready" &&
      session &&
      !checkoutStarted.current
    ) {
      checkoutStarted.current = true;
      openCheckout();
    }
  }, [razorpayAvailable, state, session, openCheckout]);

  const displayAmount =
    session?.amount != null
      ? (session.amount / 100).toLocaleString("en-IN")
      : amountRupee.toLocaleString("en-IN");

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <ScreenHeader
        title="Pay Now"
        onBack={() => {
          if (state === "paying" || state === "verifying") return;
          router.back();
        }}
      />

      <View style={styles.body}>
        {state === "verification_failed" && (
          <>
            <Ionicons name="alert-circle-outline" size={48} color="#D97706" />
            <Text style={styles.devBuildTitle}>Confirming your payment</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Text style={styles.devBuildHint}>
              Your payment may have already gone through - we just
              couldn&apos;t confirm it with our server. Tap below to check
              again; this never charges you a second time.
            </Text>
            <TouchableOpacity
              style={styles.payBtn}
              onPress={retryVerification}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={20} color={COLORS.white} />
              <Text style={styles.payBtnText}>Check Payment Status</Text>
            </TouchableOpacity>
          </>
        )}

        {state === "loading" && (
          <>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.statusText}>Preparing secure payment...</Text>
          </>
        )}

        {(state === "ready" || state === "paying" || state === "verifying") && (
          <>
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Amount to pay</Text>
              <Text style={styles.amountValue}>₹{displayAmount}</Text>
              {orderId ? (
                <Text style={styles.orderRef}>Order #{orderCode ?? orderId}</Text>
              ) : null}
            </View>

            {(state === "paying" || state === "verifying") && (
              <>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.statusText}>
                  {state === "verifying"
                    ? "Confirming payment with server..."
                    : "Complete payment in Razorpay..."}
                </Text>
              </>
            )}

            {state === "ready" && errorMsg && (
              <Text style={styles.errorText}>{errorMsg}</Text>
            )}

            {state === "ready" && (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => {
                  checkoutStarted.current = true;
                  openCheckout();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="card-outline" size={22} color={COLORS.white} />
                <Text style={styles.payBtnText}>Pay with Razorpay</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {state === "dev_build_required" && (
          <>
            <Ionicons
              name="phone-portrait-outline"
              size={48}
              color={COLORS.primaryDark}
            />
            <Text style={styles.devBuildTitle}>Development build required</Text>
            <Text style={styles.devBuildText}>{EXPO_GO_RAZORPAY_MESSAGE}</Text>
            <Text style={styles.devBuildHint}>
              Your order #{orderCode ?? orderId ?? "-"} is saved. Install the dev build, then
              open Pay Now again from My Orders or complete payment from this
              screen.
            </Text>
          </>
        )}

        {state === "error" && (
          <>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={COLORS.error}
            />
            <Text style={styles.errorText}>
              {errorMsg ?? "Something went wrong."}
            </Text>
            {isValidOrderId(orderId) && razorpayAvailable && (
              <TouchableOpacity style={styles.payBtn} onPress={loadSession}>
                <Text style={styles.payBtnText}>Retry</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace("/(tabs)/orders")}
          disabled={state === "paying" || state === "verifying"}
          accessibilityRole="button"
          accessibilityLabel="Go to My Orders"
        >
          <Text style={styles.secondaryBtnText}>Go to My Orders</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  body: {
    flex: 1,
    padding: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  amountCard: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: "center",
    ...SHADOW.card,
  },
  amountLabel: { fontSize: 13, color: COLORS.gray, marginBottom: SPACING.xs },
  amountValue: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  orderRef: { fontSize: 12, color: COLORS.gray, marginTop: SPACING.sm },
  statusText: { fontSize: 14, color: COLORS.gray, textAlign: "center" },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: "center",
    paddingHorizontal: SPACING.md,
  },
  devBuildTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
  },
  devBuildText: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: SPACING.sm,
  },
  devBuildHint: {
    fontSize: 12,
    color: COLORS.primaryDark,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    height: 52,
    paddingHorizontal: SPACING.xl,
    width: "100%",
    ...SHADOW.card,
  },
  payBtnText: { fontSize: 16, fontWeight: "700", color: COLORS.white },
  secondaryBtn: { paddingVertical: SPACING.md },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
});
