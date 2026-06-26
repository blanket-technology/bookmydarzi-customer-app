/**
 * Cart tab — live cart from GET /cart
 *
 * Backend alignment notes:
 *  - The pay amount shown here MUST equal what the backend charges.
 *    The backend's `billing.advance_amount` (+ `advance_amount_display`)
 *    is the single source of truth, surfaced via useCartStore as
 *    `billing.advanceAmount` / `billing.advanceAmountDisplay`.
 *  - We never render or enable "Pay" for an unknown/zero advance, so the
 *    UI can't display a figure that differs from the actual charge.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import CartItemCard from "../../src/components/cart/CartItemCard";
import ErrorState from "../../src/components/common/ErrorState";
import { useAppLanguage } from "../../src/i18n/useAppLanguage";
import { useAddressStore } from "../../src/store/useAddressStore";
import { useCartStore } from "../../src/store/useCartStore";
import type { ApiAddress } from "../../src/types/api";
import type { CartServiceEntry } from "../../src/types/cart";
import {
  executeCheckoutFromCart,
  resolveCheckoutAddressId,
} from "../../src/utils/checkoutNavigation";

function formatAddressTypeLabel(type: string): string {
  const key = type.trim().toLowerCase();
  if (key === "home") return "Home";
  if (key === "work") return "Work";
  if (key === "other") return "Other";
  if (!key) return "Address";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatCompactAddressLine(address: ApiAddress): string {
  return [address.address_line_1, address.address_line_2, address.city]
    .filter(Boolean)
    .join(", ");
}

function CartDeliveryAddressCard({
  address,
  onEdit,
}: {
  address: ApiAddress | null;
  onEdit: () => void;
}) {
  return (
    <View style={addrStyles.card}>
      <View style={addrStyles.headerRow}>
        <View style={addrStyles.labelRow}>
          <View style={addrStyles.iconWrap}>
            <Ionicons
              name={address ? "location" : "location-outline"}
              size={14}
              color={COLORS.primaryDark}
            />
          </View>
          <Text style={addrStyles.typeLabel}>
            {address
              ? `Deliver to: ${formatAddressTypeLabel(address.address_type)}`
              : "No delivery address"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onEdit}
          style={addrStyles.editBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Change address"
        >
          <Text style={addrStyles.editText}>
            {address ? "Change" : "Add"}
          </Text>
        </TouchableOpacity>
      </View>
      {address ? (
        <View style={addrStyles.body}>
          <Text style={addrStyles.name}>{address.full_name}</Text>
          <Text style={addrStyles.detail} numberOfLines={1}>
            {formatCompactAddressLine(address)}, {address.pincode}
          </Text>
          <Text style={addrStyles.detail}>{address.mobile}</Text>
        </View>
      ) : (
        <Text style={addrStyles.missingText}>
          Tap "Add" to set a delivery address before checkout
        </Text>
      )}
    </View>
  );
}

// ─── Bill row helper ──────────────────────────────────────────────────────────
function BillRow({
  label,
  value,
  bold,
  accent,
  discount,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
  discount?: boolean;
}) {
  return (
    <View style={billStyles.row}>
      <Text
        style={[billStyles.label, bold && billStyles.labelBold]}
      >
        {label}
      </Text>
      <Text
        style={[
          billStyles.value,
          bold && billStyles.valueBold,
          accent && billStyles.valueAccent,
          discount && billStyles.valueDiscount,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CartScreen() {
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const entries = useCartStore((s) => s.entries);
  const itemCount = useCartStore((s) => s.itemCount);
  const selectedAddressId = useCartStore((s) => s.selectedAddressId);
  const billing = useCartStore((s) => s.billing);
  const loading = useCartStore((s) => s.loading);
  const mutating = useCartStore((s) => s.mutating);
  const error = useCartStore((s) => s.error);
  const refreshCart = useCartStore((s) => s.refreshCart);
  const updateEntryQuantity = useCartStore((s) => s.updateEntryQuantity);
  const removeEntry = useCartStore((s) => s.removeEntry);
  const setCheckoutFlow = useCartStore((s) => s.setCheckoutFlow);

  const { addresses, fetchAddresses } = useAddressStore();

  const [refreshing, setRefreshing] = useState(false);
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);

  const hasAdvance =
    typeof billing.advanceAmount === "number" &&
    Number.isFinite(billing.advanceAmount) &&
    billing.advanceAmount > 0;

  useFocusEffect(
    useCallback(() => {
      void refreshCart({
        silent: entries.length > 0,
        allowCreate: false,
      }).catch(() => {});
      void fetchAddresses().catch(() => {});
    }, [entries.length, refreshCart, fetchAddresses]),
  );

  const deliveryAddress = useMemo(() => {
    const resolvedId = selectedAddressId ?? resolveCheckoutAddressId();
    if (!resolvedId) return null;
    return addresses.find((a) => a.id === resolvedId) ?? null;
  }, [addresses, selectedAddressId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshCart({ allowCreate: false }),
        fetchAddresses(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePayNow = () => {
    void executeCheckoutFromCart(router);
  };

  const handleEditAddress = useCallback(() => {
    setCheckoutFlow(false);
    router.push("/address");
  }, [router, setCheckoutFlow]);

  const renderItem = useCallback(
    ({ item, index }: { item: CartServiceEntry; index: number }) => (
      <Animated.View entering={FadeInDown.delay(60 + index * 30).duration(250)}>
        <CartItemCard
          item={item}
          mutating={mutating}
          onIncrease={() => {
            void updateEntryQuantity(item.id, item.quantity + 1).catch(() => {});
          }}
          onDecrease={() => {
            if (item.quantity <= 1) return;
            void updateEntryQuantity(item.id, item.quantity - 1).catch(() => {});
          }}
          onRemove={() => {
            void removeEntry(item.id).catch(() => {});
          }}
        />
      </Animated.View>
    ),
    [mutating, removeEntry, updateEntryQuantity],
  );

  const listHeader = useMemo(
    () => (
      <Animated.View entering={FadeInDown.duration(300)}>
        <Text style={styles.sectionLabel}>
          {itemCount} service{itemCount === 1 ? "" : "s"} in your cart
        </Text>
      </Animated.View>
    ),
    [itemCount],
  );

  const listFooter = useMemo(
    () => (
      <Animated.View
        entering={FadeInDown.delay(60 + entries.length * 30).duration(250)}
      >
        <Text style={styles.sectionLabel}>Delivery address</Text>
        <CartDeliveryAddressCard
          address={deliveryAddress}
          onEdit={handleEditAddress}
        />
        <View style={{ height: SPACING.sm }} />
      </Animated.View>
    ),
    [deliveryAddress, entries.length, handleEditAddress],
  );

  const isEmpty = !loading && entries.length === 0;
  const canPay = itemCount > 0 && entries.length > 0 && !mutating && hasAdvance;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons
              name="bag-handle-outline"
              size={20}
              color={COLORS.primaryDark}
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>{t("cart.title")}</Text>
            {itemCount > 0 ? (
              <Text style={styles.headerSub}>
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>
        </View>
        {mutating ? (
          <ActivityIndicator size="small" color={COLORS.primaryDark} />
        ) : null}
      </View>

      {/* ── States ──────────────────────────────────────────────────────── */}
      {error && entries.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => void refreshCart({ allowCreate: false })}
        />
      ) : loading && entries.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t("cart.loading")}</Text>
        </View>
      ) : isEmpty ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconRing}>
            <Ionicons name="cart-outline" size={52} color={COLORS.primaryDark} />
          </View>
          <Text style={styles.emptyTitle}>{t("cart.emptyTitle")}</Text>
          <Text style={styles.emptySub}>{t("cart.emptySub")}</Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => router.push("/(tabs)")}
            activeOpacity={0.85}
          >
            <Ionicons name="grid-outline" size={18} color={COLORS.white} />
            <Text style={styles.browseBtnText}>{t("common.browseServices")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.body}>
          {/* ── Item list ─────────────────────────────────────────────── */}
          <FlatList
            style={styles.list}
            data={entries}
            keyExtractor={(item) => String(item.id || item.serviceId)}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
          />

          {/* ── Sticky billing footer ──────────────────────────────────── */}
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, SPACING.md) },
            ]}
          >
            {/* Total + expandable breakdown */}
            <TouchableOpacity
              style={styles.totalRow}
              onPress={() => setBreakdownExpanded((v) => !v)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ expanded: breakdownExpanded }}
            >
              <View style={styles.totalRowLeft}>
                <Ionicons
                  name={breakdownExpanded ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={COLORS.primaryDark}
                />
                <Text style={styles.totalRowLabel}>
                  {breakdownExpanded ? "Price breakdown" : "Order total"}
                </Text>
              </View>
              <Text style={styles.totalRowValue}>
                {billing.totalAmountDisplay}
              </Text>
            </TouchableOpacity>

            {breakdownExpanded ? (
              <View style={styles.breakdown}>
                <BillRow
                  label="Services subtotal"
                  value={billing.itemTotalDisplay}
                />
                {billing.discount > 0 ? (
                  <BillRow
                    label="Discount"
                    value={`−₹${billing.discount.toLocaleString("en-IN")}`}
                    discount
                  />
                ) : null}
                <BillRow
                  label="Convenience fee"
                  value={billing.platformFeeDisplay}
                />
                <BillRow label="CGST (9%)" value={billing.cgstDisplay} />
                <BillRow label="SGST (9%)" value={billing.sgstDisplay} />
                <View style={styles.breakdownDivider} />
                <BillRow
                  label="Grand total"
                  value={billing.totalAmountDisplay}
                  bold
                  accent
                />
              </View>
            ) : null}

            {/* Payment split pill */}
            {hasAdvance ? (
              <View style={styles.splitRow}>
                <View style={styles.splitChip}>
                  <Ionicons
                    name="card-outline"
                    size={14}
                    color={COLORS.primaryDark}
                  />
                  <View>
                    <Text style={styles.splitNow}>
                      {billing.advanceAmountDisplay}
                    </Text>
                    <Text style={styles.splitNowLabel}>Pay now</Text>
                  </View>
                </View>
                <View style={styles.splitArrow}>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={COLORS.gray}
                  />
                </View>
                <View style={styles.splitChip}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={COLORS.gray}
                  />
                  <View>
                    <Text style={styles.splitLater}>
                      {billing.remainingAmountDisplay}
                    </Text>
                    <Text style={styles.splitLaterLabel}>After service</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Pay Now button */}
            <TouchableOpacity
              style={[styles.payBtn, !canPay && styles.payBtnDisabled]}
              onPress={handlePayNow}
              disabled={!canPay}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={
                  canPay
                    ? [COLORS.primaryDark, COLORS.primary]
                    : ["#aaa", "#ccc"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payBtnGradient}
              >
                {mutating ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={COLORS.white}
                    />
                    <Text style={styles.payBtnText}>
                      {hasAdvance
                        ? `${t("cart.payNow")} ${billing.advanceAmountDisplay}`
                        : t("cart.payNow")}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {!hasAdvance && entries.length > 0 && !loading ? (
              <Text style={styles.payHint}>
                Pull to refresh to load advance amount
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Address card styles ──────────────────────────────────────────────────────
const addrStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.12)",
    ...SHADOW.card,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.2)",
  },
  editText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  body: { gap: 2 },
  name: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.black,
  },
  detail: {
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 17,
  },
  missingText: {
    fontSize: 12,
    color: COLORS.error,
    lineHeight: 17,
    fontStyle: "italic",
  },
});

// ─── Bill row styles ──────────────────────────────────────────────────────────
const billStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  label: { fontSize: 13, color: COLORS.gray, fontWeight: "500" },
  labelBold: { color: COLORS.black, fontWeight: "700" },
  value: { fontSize: 13, fontWeight: "600", color: COLORS.black },
  valueBold: { fontSize: 14, fontWeight: "800" },
  valueAccent: { color: COLORS.primaryDark },
  valueDiscount: { color: "#16a34a" },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: COLORS.black },
  headerSub: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 1,
    fontWeight: "500",
  },

  body: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.gray,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  loadingText: { fontSize: 14, color: COLORS.gray },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  emptyIconRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.12)",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACING.lg,
    maxWidth: 300,
  },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 24,
    paddingVertical: 14,
    ...SHADOW.card,
  },
  browseBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.white },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  totalRowLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.black,
  },
  totalRowValue: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },

  breakdown: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: COLORS.grayBorder,
    marginVertical: 4,
  },

  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.15)",
  },
  splitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  splitArrow: { paddingHorizontal: 2 },
  splitNow: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primaryDark,
    lineHeight: 20,
  },
  splitNowLabel: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: "500",
    opacity: 0.8,
  },
  splitLater: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.gray,
    lineHeight: 20,
  },
  splitLaterLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: "500",
  },

  payBtn: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    height: 54,
    borderRadius: RADIUS.lg,
  },
  payBtnText: { fontSize: 17, fontWeight: "700", color: COLORS.white },

  payHint: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: "center",
    fontStyle: "italic",
  },
});
