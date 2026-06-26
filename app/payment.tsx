/**
 * PaymentScreen — Razorpay checkout for Pay Now orders.
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
import {
    confirmRazorpayPayment,
    PaymentAlreadyCompletedError,
    resolvePaymentSessionForOrder,
    isValidOrderId,
    parsePositiveId,
} from "../src/services/paymentService";
import { useCartStore } from "../src/store/useCartStore";
import { useOrderStore } from "../src/store/useOrderStore";
import type { RazorpayPaymentSession } from "../src/types/api";
import { isPaymentSuccess } from "../src/utils/paymentStatus";
import {
    DevelopmentBuildRequiredError,
    EXPO_GO_RAZORPAY_MESSAGE,
    isRazorpayNativeAvailable,
    openRazorpayCheckout,
    PaymentCancelledError,
} from "../src/utils/razorpayCheckout";
import { safeRouterReplace } from "../src/utils/safeNavigation";

type ScreenState =
  | "loading"
  | "ready"
  | "paying"
  | "verifying"
  | "error"
  | "dev_build_required";

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId?: string;
    amount?: string;
    customerName?: string;
    email?: string;
    phone?: string;
  }>();

  const orderId = parsePositiveId(params.orderId);
  const amountRupee = Number(params.amount ?? 0);
  const customerName = params.customerName?.trim() || undefined;
  const email = params.email?.trim() || undefined;
  const phone = params.phone?.trim() || undefined;

  const [state, setState] = useState<ScreenState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [session, setSession] = useState<RazorpayPaymentSession | null>(null);

  const checkoutStarted = useRef(false);
  const isBusy = useRef(false);
  const razorpayAvailable = isRazorpayNativeAvailable();

  const finishSuccess = useCallback(() => {
    useOrderStore.getState().invalidateCache();
    void useCartStore
      .getState()
      .refreshCart({ silent: true, allowCreate: false });
    safeRouterReplace(router, {
      pathname: "/order-success" as any,
      params: {
        orderId: String(orderId),
        payment: "paid",
      },
    });
  }, [orderId, router]);

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
      setErrorMsg("Invalid payment amount.");
      setState("error");
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

  useEffect(() => {
    loadSession();
  }, [loadSession]);

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
        description: `Order #${orderId}`,
        prefill: {
          name: customerName,
          email,
          contact: phone,
        },
      });

      setState("verifying");

      const confirmed = await confirmRazorpayPayment(
        session.payment_id,
        session.order_id,
        result,
      );

      if (!confirmed || !isPaymentSuccess(confirmed.status)) {
        throw new Error(
          "Payment could not be confirmed. If amount was deducted, check My Orders.",
        );
      }

      finishSuccess();
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
  }, [session, orderId, customerName, email, phone, finishSuccess]);

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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (state === "paying" || state === "verifying") return;
            router.back();
          }}
          disabled={state === "paying" || state === "verifying"}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay Now</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
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
                <Text style={styles.orderRef}>Order #{orderId}</Text>
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
              Your order #{orderId ?? "—"} is saved. Install the dev build, then
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
        >
          <Text style={styles.secondaryBtnText}>Go to My Orders</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black },
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
