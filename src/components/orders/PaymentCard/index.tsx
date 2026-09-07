import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../../constants/theme";
import { orderDisplayValue } from "../../../types/api";
import { COD_STATUS_LABELS, PAYMENT_ACTION_LABELS, PAYMENT_METHOD_META } from "../../../types/payment";

/**
 * Single source of truth for order payment UI - Online and COD share this
 * one component, never duplicated per screen. Payment *method* branching
 * always uses the `paymentMethod` prop (backend's PaymentMethod field),
 * never inferred from payment_status text - COD and Online can both pass
 * through the same status strings (e.g. a COD order can still show
 * "fully_paid" once collected), so status alone can't tell them apart.
 *
 * Driven by fields the backend already provides (app/schemas/order.py:
 * PaymentStatus, RemainingAmount, BalanceDue, AmountDisplay,
 * RemainingAmountDisplay; app/services/orders/order_display.py:
 * resolve_payment_display returns "cod_pending"/"Pay on Delivery" for an
 * uncollected COD payment).
 */
export interface PaymentCardProps {
  paymentMethod: "online" | "cod" | "unknown" | null | undefined;
  /** Raw backend PaymentStatus, e.g. advance_paid | fully_paid | payment_failed | cod_pending | paid. */
  paymentStatus: string | null | undefined;
  /** Order total - always shown regardless of payment state. */
  orderAmountDisplay: string | null | undefined;
  /** How much has actually been paid so far (advance, or full amount once settled). Omit/0 for COD before collection. */
  amountDisplay: string | null | undefined;
  remainingAmountDisplay: string | null | undefined;
  remainingAmount: number;
  /** True when the customer can pay the remaining balance now (backend's BalanceDue field). */
  balanceDue: boolean;
  transactionId?: string | null;
  onPayNow?: () => void;
  onRetryPayment?: () => void;
  onPayBalance?: () => void;
  payingBalance?: boolean;
  /** True while a retry/resume payment session is being resolved - disables the button and shows a spinner so duplicate taps can't create duplicate sessions. */
  retryingPayment?: boolean;
}

const FAILURE_STATUSES = new Set(["payment_failed", "advance_failed", "failed"]);
const PENDING_STATUSES = new Set(["payment_pending", "advance_pending", "pending", "initiated"]);
const FULLY_PAID_STATUSES = new Set(["fully_paid", "paid", "success"]);
const COD_PENDING_STATUSES = new Set(["cod_pending", "cod"]);

const PaymentCard = memo(
  ({
    paymentMethod,
    paymentStatus,
    orderAmountDisplay,
    amountDisplay,
    remainingAmountDisplay,
    remainingAmount,
    balanceDue,
    transactionId,
    onPayNow,
    onRetryPayment,
    onPayBalance,
    payingBalance = false,
    retryingPayment = false,
  }: PaymentCardProps) => {
    const status = (paymentStatus ?? "").toLowerCase();
    const isCod = paymentMethod === "cod";
    const isFailed = FAILURE_STATUSES.has(status);
    const isPending = PENDING_STATUSES.has(status);
    const isFullyPaid = FULLY_PAID_STATUSES.has(status);
    const isCodPending = COD_PENDING_STATUSES.has(status);

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons
            name={isCod ? "cash-outline" : "card-outline"}
            size={18}
            color={COLORS.primaryDark}
          />
          <Text style={styles.headerText}>
            {isCod ? PAYMENT_METHOD_META.cod.displayLabel : "Online Payment"}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Payment Method</Text>
          <Text style={styles.value}>
            {paymentMethod === "online" || paymentMethod === "cod"
              ? PAYMENT_METHOD_META[paymentMethod].displayLabel
              : "-"}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Order Amount</Text>
          <Text style={styles.value}>{orderDisplayValue(orderAmountDisplay)}</Text>
        </View>

        {transactionId ? (
          <View style={styles.row}>
            <Text style={styles.label}>Reference</Text>
            <Text style={styles.value} numberOfLines={1}>
              {transactionId}
            </Text>
          </View>
        ) : null}

        {/* Payment Status - the one place status pills render, regardless of
            method. Never a duplicate per-method block; only the label/color
            set differs. */}
        {isCod ? (
          // The "Pay on Delivery" pending badge was removed on request; only
          // show a pill once the COD amount has actually been collected.
          !isCodPending ? (
            <View style={[styles.statusPill, styles.statusPillSuccess]}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Text style={styles.statusPillTextSuccess}>
                {COD_STATUS_LABELS.collected}
              </Text>
            </View>
          ) : null
        ) : (
          <>
            {isFailed && (
              <View style={[styles.statusPill, styles.statusPillError]}>
                <Ionicons name="close-circle" size={14} color={COLORS.error} />
                <Text style={styles.statusPillTextError}>Payment failed</Text>
              </View>
            )}
            {isPending && !isFailed && (
              <View style={[styles.statusPill, styles.statusPillWarning]}>
                <Ionicons name="time" size={14} color="#D97706" />
                <Text style={styles.statusPillTextWarning}>Payment pending</Text>
              </View>
            )}
            {isFullyPaid && (
              <View style={[styles.statusPill, styles.statusPillSuccess]}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.statusPillTextSuccess}>Fully paid</Text>
              </View>
            )}

            {isFailed && onRetryPayment ? (
              <TouchableOpacity
                style={[styles.primaryBtn, retryingPayment && styles.primaryBtnDisabled]}
                onPress={onRetryPayment}
                disabled={retryingPayment}
                accessibilityRole="button"
                accessibilityLabel="Retry payment"
              >
                {retryingPayment ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>{PAYMENT_ACTION_LABELS.retryPayment}</Text>
                )}
              </TouchableOpacity>
            ) : null}
            {isPending && !isFailed && onPayNow ? (
              <TouchableOpacity
                style={[styles.primaryBtn, retryingPayment && styles.primaryBtnDisabled]}
                onPress={onPayNow}
                disabled={retryingPayment}
                accessibilityRole="button"
                accessibilityLabel="Pay now"
              >
                {retryingPayment ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>{PAYMENT_ACTION_LABELS.payNow}</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        )}

        {/* The separate Cash-on-Delivery "Amount Due" section with its own Pay
            Now button was removed here (Bug Report cycle 1, item 6.1); the
            amount-due row + Pay Now now live inside the Price Breakdown section
            on the order-details screen. This card just shows payment
            method/status. */}
      </View>
    );
  },
);

PaymentCard.displayName = "PaymentCard";
export default PaymentCard;

/**
 * Hard gate matching backend behavior exactly: an order can never be marked
 * delivered while RemainingAmount > 0 - no bypass, no warning-only path
 * (app/services/orders/employee_order_service.py: complete_employee_order).
 * The frontend must mirror this, not just display it - use this to decide
 * whether a "Mark Delivered" / "Deliver" action is even rendered.
 */
export function canShowDeliverAction(remainingAmount: number): boolean {
  return remainingAmount <= 0;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: SPACING.xs,
  },
  headerText: {
    ...TYPOGRAPHY.heading.h3,
    color: COLORS.black,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.gray,
  },
  value: {
    ...TYPOGRAPHY.body.md,
    fontWeight: "700",
    color: COLORS.black,
  },
  remainingLabel: {
    color: COLORS.error,
    fontWeight: "600",
  },
  remainingValue: {
    color: COLORS.error,
  },
  balanceSection: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    gap: SPACING.xs,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusPillError: { backgroundColor: COLORS.errorLight },
  statusPillWarning: { backgroundColor: "#FEF6E7" },
  statusPillSuccess: { backgroundColor: COLORS.successLight },
  statusPillTextError: {
    ...TYPOGRAPHY.label.sm,
    color: COLORS.error,
    textTransform: "none",
    letterSpacing: 0,
  },
  statusPillTextWarning: {
    ...TYPOGRAPHY.label.sm,
    color: "#D97706",
    textTransform: "none",
    letterSpacing: 0,
  },
  statusPillTextSuccess: {
    ...TYPOGRAPHY.label.sm,
    color: COLORS.success,
    textTransform: "none",
    letterSpacing: 0,
  },
  primaryBtn: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    ...TYPOGRAPHY.label.lg,
    color: COLORS.white,
    textTransform: "none",
    letterSpacing: 0,
  },
});
