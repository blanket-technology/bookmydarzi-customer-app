/**
 * Order Summary screen for "Order Now" (direct checkout, bypasses cart).
 * Shown after address selection for a quantity-1 service booking.
 * Measurement is never collected from the customer - it's filled later by
 * Bridge/employee at pickup, or by Admin.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import CodConfirmModal from "../src/components/cart/CodConfirmModal";
import { CouponSection, type AppliedOffer } from "../src/components/cart/CouponSection";
import SlideToConfirm from "../src/components/cart/SlideToConfirm";
import StyleReferencePicker from "../src/components/cart/StyleReferencePicker";
import VoiceNoteRecorder from "../src/components/cart/VoiceNoteRecorder";
import { trackOrderPlaced } from "../src/services/mixpanelService";
import PickupDateCalendarModal from "../src/components/common/PickupDateCalendarModal";
import ScreenHeader from "../src/components/common/ScreenHeader";
import PaymentMethodSelector from "../src/components/orders/PaymentMethodSelector";
import {
  createDirectOrder,
  getBillingEstimate,
  type BillingEstimate,
} from "../src/services/directOrderService";
import { uploadOrderStyleReference } from "../src/services/apiOrderService";
import { registerServiceAreaInterest } from "../src/services/locationService";
import { useAddressStore } from "../src/store/useAddressStore";
import { useCartStore } from "../src/store/useCartStore";
import { useCheckoutPreferencesStore } from "../src/store/useCheckoutPreferencesStore";
import { useCustomerOrdersStore } from "../src/store/useCustomerOrdersStore";
import { useHomeStore } from "../src/store/useHomeStore";
import { useOrderStore } from "../src/store/useOrderStore";
import type { ApiAddress } from "../src/types/api";
import { PAYMENT_ACTION_LABELS, type PaymentMethodOption } from "../src/types/payment";
import { buildPickupTimeSlots } from "../src/utils/pickupTimeSlots";
import { estimateCouponDiscount } from "../src/utils/couponDiscount";
import { normalizeProfileImageUrl } from "../src/utils/profileImage";
import { safeRouterPush, safeRouterReplace } from "../src/utils/safeNavigation";
import { getUserMobile } from "../src/utils/userPhone";
import { useAuthStore } from "../store/useAuthStore";

function formatSelectedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function BillingRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.billingRow}>
      <Text style={[s.billingLabel, bold && s.billingLabelBold]}>{label}</Text>
      <Text style={[s.billingValue, bold && s.billingValueBold]}>{value}</Text>
    </View>
  );
}

function AddressLine({ addr }: { addr: ApiAddress }) {
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.landmark,
    addr.city,
    addr.state,
    addr.pincode,
  ].filter(Boolean);
  return (
    <View style={s.addrCard}>
      <Ionicons name="location-outline" size={16} color={COLORS.primaryDark} />
      <View style={{ flex: 1 }}>
        <Text style={s.addrName}>{addr.full_name}</Text>
        <Text style={s.addrLine}>{parts.join(", ")}</Text>
      </View>
    </View>
  );
}

export default function BuyNowReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addressId = "" } = useLocalSearchParams<{
    addressId?: string;
  }>();

  const { pendingService, resetBookingFlow } = useCartStore();
  const { addresses, fetchAddresses, loading: addrLoading } = useAddressStore();
  const { user } = useAuthStore();
  const serviceImageUri = useMemo(
    () => normalizeProfileImageUrl(pendingService?.imageUrl),
    [pendingService?.imageUrl],
  );

  const [billing, setBilling] = useState<BillingEstimate | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");

  // Own local state, deliberately independent of useCartStore's applied-
  // offer fields - Book Now bypasses the cart entirely (direct_order_service.py
  // never touches CART/CART_ENTRIES), so it has no business reading or
  // writing cart-domain state. specialOffers is the same homepage-payload
  // list the cart screen already browses (useHomeStore, populated by
  // GET /home) - no separate fetch needed here.
  const specialOffers = useHomeStore((s) => s.specialOffers);
  const [appliedOffer, setAppliedOffer] = useState<AppliedOffer | null>(null);

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [pickupType, setPickupType] = useState<"instant" | "scheduled">("instant");
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [scheduledSlot, setScheduledSlot] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const pickupTimeSlots = useMemo(() => buildPickupTimeSlots(), []);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  // Reference style image + order notes, mirroring the cart (item 4.1).
  // styleReferenceUri holds the local picker preview immediately, then the
  // final https:// url once uploadOrderStyleReference resolves - the
  // order-create call below only sends it once it's the uploaded url (see
  // the /^https?:\/\// check), so this used to silently drop the photo
  // entirely: nothing here ever uploaded it. Fixed by uploading right after
  // picking, same shape as VoiceNoteRecorder's own record-then-upload flow.
  const [styleReferenceUri, setStyleReferenceUri] = useState<string | null>(null);
  const [styleReferenceUploading, setStyleReferenceUploading] = useState(false);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);

  const handlePickStyleReference = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow BMD to access your photos to upload a style reference.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // Forced crop UI was overlapping the photo; no crop needed for a
      // reference image - take it as-is.
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    const localUri = result.assets[0].uri;
    setStyleReferenceUri(localUri);
    setStyleReferenceUploading(true);
    try {
      const uploaded = await uploadOrderStyleReference(localUri);
      setStyleReferenceUri(uploaded.url);
    } catch {
      Alert.alert(
        "Upload failed",
        "Couldn't upload the style reference photo. Please try again.",
      );
      setStyleReferenceUri(null);
    } finally {
      setStyleReferenceUploading(false);
    }
  }, []);
  const [placing, setPlacing] = useState(false);
  const [codModalVisible, setCodModalVisible] = useState(false);

  const lastPaymentMethod = useCheckoutPreferencesStore((s) => s.lastPaymentMethod);
  const setLastPaymentMethod = useCheckoutPreferencesStore((s) => s.setLastPaymentMethod);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodOption>(lastPaymentMethod);

  const handleSelectPaymentMethod = useCallback(
    (method: PaymentMethodOption) => {
      setPaymentMethod(method);
      setLastPaymentMethod(method);
    },
    [setLastPaymentMethod],
  );

  useEffect(() => {
    fetchAddresses().catch(() => {});
  }, [fetchAddresses]);

  // Default-select an address once the async fetch resolves - genuinely
  // needs to be an effect, same "adjust state after data arrives" case
  // used throughout this app's screens (see address.tsx).
  useEffect(() => {
    if (!addresses.length || selectedAddressId !== null) return;
    const fromParam = addressId ? Number(addressId) : null;
    if (fromParam && addresses.find((a) => a.id === fromParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAddressId(fromParam);
      return;
    }
    const def = addresses.find((a) => a.is_default) ?? addresses[0];
    if (def) setSelectedAddressId(def.id);
  }, [addresses, selectedAddressId, addressId]);

  // Kicks off an async billing-estimate fetch whenever the selected service/
  // addons change - a real network side-effect, not derivable during render.
  useEffect(() => {
    if (!pendingService?.bookableServiceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBillingLoading(false);
      setBillingError("No service selected. Please go back and pick a service.");
      return;
    }
    setBillingLoading(true);
    setBillingError("");
    const addonIds = (pendingService.addons ?? []).map((a) => a.addonId);
    const extraItems = pendingService.extraItems ?? [];
    const items = extraItems.length > 0
      ? [
          { service_id: pendingService.bookableServiceId, quantity: pendingService.quantity ?? 1 },
          ...extraItems.map((e) => ({
            service_id: e.serviceId,
            quantity: 1,
            addons: e.addons,
          })),
        ]
      : undefined;
    // Bug fix: "Can't perform a React state update on a component that
    // hasn't mounted yet" - this fetch had no mount guard at all, so a
    // customer who navigated to/away from this screen quickly enough (back
    // button, double-tap, or this effect re-firing on a dependency change
    // while a previous fetch was still in flight) could have setBilling/
    // setBillingError/setBillingLoading fire after the component was
    // unmounted or before it had finished its first commit. `active` is
    // flipped false by the cleanup function on unmount/re-run; every setter
    // below checks it first.
    let active = true;
    getBillingEstimate(pendingService.bookableServiceId, 1, addonIds, items)
      .then((result) => {
        if (active) setBilling(result);
      })
      .catch((err) => {
        if (active) {
          setBillingError(
            err instanceof Error ? err.message : "Could not load pricing. Please try again.",
          );
        }
      })
      .finally(() => {
        if (active) setBillingLoading(false);
      });
    return () => {
      active = false;
    };
    // Same reasoning as service-details.tsx's addon fetch effect - depend on
    // the ids themselves (joined), not the array reference, since
    // pendingService.addons/extraItems are new array identities on every
    // render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingService?.bookableServiceId,
    (pendingService?.addons ?? []).map((a) => a.addonId).join(","),
    (pendingService?.extraItems ?? []).map((e) => e.serviceId).join(","),
  ]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  // CGST/SGST split display - the billing-estimate endpoint only returns a
  // combined gst_display string; cgst_amount/sgst_amount are already there
  // as raw numbers, so derive matching per-tax labels the same way cart.tsx
  // does, instead of showing one merged "GST (18%)" row.
  const taxableBase = billing ? billing.item_total : 0;
  const cgstPercent =
    billing && taxableBase > 0
      ? +((billing.cgst_amount / taxableBase) * 100).toFixed(2)
      : 0;
  const sgstPercent =
    billing && taxableBase > 0
      ? +((billing.sgst_amount / taxableBase) * 100).toFixed(2)
      : 0;
  const cgstDisplay = billing ? `₹${Math.round(billing.cgst_amount).toLocaleString("en-IN")}` : "₹0";
  const sgstDisplay = billing ? `₹${Math.round(billing.sgst_amount).toLocaleString("en-IN")}` : "₹0";

  // Client-side discount estimate for display only - create_direct_order
  // recomputes and validates the real discount server-side from offer_id
  // (same "the backend is authoritative" contract as cart.tsx). Shared with
  // cart.tsx via estimateCouponDiscount() so the two screens can't drift.
  const estimatedDiscount = billing
    ? estimateCouponDiscount(appliedOffer, billing.total_amount)
    : 0;
  const displayTotal = billing ? Math.max(billing.total_amount - estimatedDiscount, 1) : 0;
  const displayTotalText = `₹${Math.round(displayTotal).toLocaleString("en-IN")}`;

  const canProceed =
    !!selectedAddressId &&
    !billingLoading &&
    !!billing &&
    (pickupType === "instant" || (!!scheduledDate && !!scheduledSlot));

  const placeOrder = useCallback(async () => {
    if (!pendingService || !selectedAddressId || !billing) return;

    setPlacing(true);
    try {
      let scheduledPickupAt: string | undefined;
      if (pickupType === "scheduled" && scheduledDate && scheduledSlot) {
        const slot = pickupTimeSlots.find((s) => s.label === scheduledSlot);
        const dt = new Date(scheduledDate);
        dt.setHours(slot?.hour ?? 9, slot?.minute ?? 0, 0, 0);
        scheduledPickupAt = dt.toISOString();
      }

      const extraItems = pendingService.extraItems ?? [];
      const result = await createDirectOrder({
        service_id: pendingService.bookableServiceId,
        quantity: pendingService.quantity ?? 1,
        address_id: selectedAddressId,
        pickup_type: pickupType,
        payment_method: paymentMethod,
        stitching_preferences: pendingService.stitchingPreferences,
        ...(pendingService.addons?.length ? { addons: pendingService.addons } : {}),
        ...(appliedOffer ? { offer_id: appliedOffer.offerId } : {}),
        ...(scheduledPickupAt
          ? { scheduled_pickup_at: scheduledPickupAt, pickup_time_slot: scheduledSlot! }
          : {}),
        ...(orderNotes.trim() ? { customization_notes: orderNotes.trim() } : {}),
        ...(styleReferenceUri && /^https?:\/\//.test(styleReferenceUri)
          ? { image_references: [styleReferenceUri] }
          : {}),
        ...(voiceNoteUrl ? { voice_note_url: voiceNoteUrl } : {}),
        ...(extraItems.length > 0
          ? {
              // Backend ignores the top-level service_id/stitching_preferences/
              // addons above once items is set - the primary item's own
              // design brief/addons must ride on items[0] instead, or a
              // premium tier's brief (and any addons) silently gets
              // dropped the moment an extra tier is checked.
              items: [
                {
                  service_id: pendingService.bookableServiceId,
                  quantity: pendingService.quantity ?? 1,
                  stitching_preferences: pendingService.stitchingPreferences,
                  addons: pendingService.addons,
                },
                // Each extra tier's own selected add-ons (e.g. Sleeve
                // Repair checked as extra work, with its own Button
                // Replacement add-on picked) - previously dropped
                // entirely, so an extra tier's add-ons never reached the
                // real order even after the customer explicitly chose
                // them on this same screen.
                ...extraItems.map((e) => ({
                  service_id: e.serviceId,
                  quantity: 1,
                  addons: e.addons,
                })),
              ],
            }
          : {}),
      });

      trackOrderPlaced({
        order_id: result.orderId,
        service_id: pendingService.bookableServiceId,
        payment_method: paymentMethod,
        final_amount: result.finalAmount,
      });

      // Full reset (not just clearPendingService/clearBuyNowMode) now that
      // these Book Now fields are persisted (useCartStore.ts) - a
      // successful order is exactly the "done, nothing pending" condition
      // resetBookingFlow was built for but never actually wired up to.
      resetBookingFlow();
      useOrderStore.getState().invalidateCache();
      useCustomerOrdersStore.getState().invalidateCache();

      if (paymentMethod === "cod") {
        // COD skips the payment gateway entirely - the order is already
        // placed (backend creates it at order_placed, not pending_payment).
        safeRouterReplace(router, {
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

      // Genuinely nothing to charge (e.g. a fully-discounted order totals
      // ₹0) - the order is already placed server-side, no gateway to open.
      if (result.advanceAmount <= 0) {
        safeRouterReplace(router, {
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

      const mobile = getUserMobile(user);
      const customerName =
        user?.name?.trim() ||
        `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() ||
        undefined;

      safeRouterReplace(router, {
        pathname: "/payment",
        params: {
          orderId: String(result.orderId),
          orderCode: result.orderCode ?? "",
          paymentId: String(result.paymentId ?? 0),
          amount: String(result.advanceAmount),
          amountDisplay: result.advanceAmountDisplay,
          remainingAmount: String(result.remainingAmount),
          remainingAmountDisplay: result.remainingAmountDisplay,
          ...(customerName ? { customerName } : {}),
          ...(user?.email?.trim() ? { email: user.email.trim() } : {}),
          ...(mobile ? { phone: mobile } : {}),
        },
      } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      if (/outside our current service area/i.test(message) && selectedAddress) {
        Alert.alert("Could not place order", message, [
          {
            text: "I'm interested — notify me",
            onPress: () => {
              registerServiceAreaInterest({
                latitude: selectedAddress.latitude ?? null,
                longitude: selectedAddress.longitude ?? null,
                city: selectedAddress.city ?? null,
                pincode: selectedAddress.pincode ?? null,
                address_text: [selectedAddress.address_line_1, selectedAddress.city]
                  .filter(Boolean)
                  .join(", "),
              }).catch(() => {
                // Best-effort - the customer already saw the "could not
                // place order" message either way, don't chain a second
                // error alert on top of it if this fails silently.
              });
              Alert.alert("Thanks!", "We'll notify you when we launch in your area.");
            },
          },
          { text: "OK", style: "cancel" },
        ]);
      } else {
        Alert.alert("Could not place order", message);
      }
    } finally {
      setPlacing(false);
    }
  }, [
    pendingService, selectedAddressId, billing, appliedOffer,
    pickupType, scheduledDate, scheduledSlot, pickupTimeSlots, paymentMethod,
    orderNotes, styleReferenceUri, voiceNoteUrl,
    resetBookingFlow, user, router,
  ]);

  const handlePlaceOrder = useCallback(() => {
    if (!billing) return;
    if (styleReferenceUploading) {
      Alert.alert("Please wait", "Your style reference photo is still uploading.");
      return;
    }

    if (paymentMethod === "cod") {
      // Keep the slider's processing state on through the confirmation
      // modal so the thumb doesn't visually "unlock" mid-decision; reset it
      // explicitly if the user backs out via Cancel.
      setPlacing(true);
      setCodModalVisible(true);
      return;
    }

    void placeOrder();
  }, [billing, paymentMethod, placeOrder, styleReferenceUploading]);

  const handleCodCancel = useCallback(() => {
    setCodModalVisible(false);
    setPlacing(false);
  }, []);
  const handleCodConfirm = useCallback(() => {
    setCodModalVisible(false);
    void placeOrder();
  }, [placeOrder]);

  if (!pendingService) {
    return (
      <View style={[s.root, { paddingTop: insets.top, alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.grayBorder} />
        <Text style={{ marginTop: 12, color: COLORS.gray, fontSize: 15 }}>No service selected.</Text>
        <TouchableOpacity style={s.goBackBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={s.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader title="Bill Details" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Service card ──────────────────────────────────── */}
        <View style={s.card}>
          <LinearGradient
            colors={["#0c6c75", "#1aa3b0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.serviceHero}
          >
            {serviceImageUri ? (
              <Image
                source={{ uri: serviceImageUri }}
                style={s.serviceThumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
              />
            ) : (
              <View style={s.serviceIcon}>
                <Ionicons name="shirt-outline" size={26} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.serviceName} numberOfLines={2}>
                {pendingService.displayName}
              </Text>
              {/* Bug fix: "Custom Alterations" as a subtitle under an
                  already-specific alteration name read as redundant noise -
                  same rule as the backend's order-display fix. Regular
                  clothing categories (e.g. "Men Clothing") stay shown,
                  still genuinely informative there. */}
              {pendingService.categoryName !== "Custom Alterations" ? (
                <Text style={s.serviceCategory}>{pendingService.categoryName}</Text>
              ) : null}
            </View>
            <View style={s.pricePill}>
              <Text style={s.priceText}>
                ₹{pendingService.basePrice.toLocaleString("en-IN")}
              </Text>
            </View>
          </LinearGradient>
          {pendingService.addons && pendingService.addons.length > 0 ? (
            <View style={s.addonsSummary}>
              {pendingService.addons.map((a) => (
                <View key={a.addonId} style={s.addonSummaryRow}>
                  <View style={s.addonSummaryLabelGroup}>
                    <View style={s.addonSummaryBadge}>
                      <Ionicons name="add" size={11} color={COLORS.primaryDark} />
                    </View>
                    <Text style={s.addonSummaryName} numberOfLines={2}>
                      {a.name}
                    </Text>
                  </View>
                  <Text style={s.addonSummaryPrice}>
                    ₹{a.price.toLocaleString("en-IN")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {pendingService.extraItems && pendingService.extraItems.length > 0 ? (
            <View style={s.addonsSummary}>
              {/* Extra service tiers added via "Add more work to this
                  garment" - a distinct concept from an addon (a whole other
                  billable tier, not a small extra on this one), so it gets
                  its own icon rather than reusing the addon's plus-badge. */}
              {pendingService.extraItems.map((e) => (
                <View key={e.serviceId}>
                  <View style={s.addonSummaryRow}>
                    <View style={s.addonSummaryLabelGroup}>
                      <View style={[s.addonSummaryBadge, s.extraItemBadge]}>
                        <Ionicons name="cut-outline" size={10} color={COLORS.primaryDark} />
                      </View>
                      <Text style={s.addonSummaryName} numberOfLines={2}>
                        {e.name}
                      </Text>
                    </View>
                    <Text style={s.addonSummaryPrice}>
                      ₹{e.basePrice.toLocaleString("en-IN")}
                    </Text>
                  </View>
                  {/* This extra tier's own add-ons (e.g. Sleeve Repair's
                      Button Replacement) - nested under it so it's clear
                      which tier they belong to, matching what actually
                      gets charged now that both the billing estimate and
                      the real order include them. */}
                  {(e.addons ?? []).map((a) => (
                    <View key={a.addonId} style={[s.addonSummaryRow, s.extraItemAddonRow]}>
                      <View style={s.addonSummaryLabelGroup}>
                        <View style={s.addonSummaryBadge}>
                          <Ionicons name="add" size={10} color={COLORS.primaryDark} />
                        </View>
                        <Text style={[s.addonSummaryName, s.extraItemAddonName]} numberOfLines={2}>
                          {a.name}
                        </Text>
                      </View>
                      <Text style={s.addonSummaryPrice}>
                        ₹{a.price.toLocaleString("en-IN")}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Reference style image (matches cart, item 4.1) ─── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Reference Style Image</Text>
          <View style={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.md }}>
            <StyleReferencePicker
              uri={styleReferenceUri}
              onPick={() => void handlePickStyleReference()}
              onRemove={() => setStyleReferenceUri(null)}
              uploading={styleReferenceUploading}
            />
          </View>
        </View>

        {/* ── Billing breakdown ─────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Price breakdown</Text>
          {billingLoading ? (
            <View style={s.loadingRow}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={s.loadingText}>Calculating price…</Text>
            </View>
          ) : billingError ? (
            <Text style={s.errorText}>{billingError}</Text>
          ) : billing ? (
            <>
              {/* Labels kept consistent with the Booking Details bill so the
                  same order reads identically before and after placing. */}
              <BillingRow label="Base amount" value={billing.item_total_display} />
              <BillingRow label={`CGST (${cgstPercent}%)`} value={cgstDisplay} />
              <BillingRow label={`SGST (${sgstPercent}%)`} value={sgstDisplay} />
              <BillingRow label="Platform fee" value={billing.platform_fee_display} />
              {billing.penalty_amount > 0 ? (
                <BillingRow
                  label="Cancellation charges"
                  value={`₹${Math.round(billing.penalty_amount).toLocaleString("en-IN")}`}
                />
              ) : null}
              {estimatedDiscount > 0 ? (
                <BillingRow label="Offer discount (est.)" value={`-₹${Math.round(estimatedDiscount).toLocaleString("en-IN")}`} />
              ) : null}
              <View style={s.divider} />
              <BillingRow label="Total" value={estimatedDiscount > 0 ? displayTotalText : billing.total_amount_display} bold />

              {/* Payment method folded into the bill (matches Booking Details) -
                  no separate section, no redundant "Pay now / Pay on delivery"
                  pill that just repeated the total. */}
              <Text style={s.payMethodHeading}>Payment method</Text>
              <View style={s.paymentMethodWrap}>
                <PaymentMethodSelector
                  value={paymentMethod}
                  onChange={handleSelectPaymentMethod}
                  disabled={placing}
                />
              </View>
            </>
          ) : null}
        </View>

        {/* ── Available offers + coupon code (matches cart, previously
              missing entirely from Book Now) ───────────────────────── */}
        <CouponSection
          offers={specialOffers}
          orderTotal={billing?.total_amount ?? 0}
          appliedOffer={appliedOffer}
          onChange={setAppliedOffer}
        />

        {/* ── Pickup type ───────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Pickup Type</Text>
          <View style={s.pickupRow}>
            {(["instant", "scheduled"] as const).map((pt) => (
              <TouchableOpacity
                key={pt}
                style={[s.pickupOpt, pickupType === pt && s.pickupOptSel]}
                onPress={() => setPickupType(pt)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={pt === "instant" ? "flash-outline" : "calendar-outline"}
                  size={15}
                  color={pickupType === pt ? COLORS.primaryDark : COLORS.gray}
                />
                <Text style={[s.pickupOptText, pickupType === pt && s.pickupOptTextSel]}>
                  {pt === "instant" ? "Instant Pickup" : "Schedule Pickup"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {pickupType === "scheduled" && (
            <View style={{ marginTop: SPACING.sm, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md }}>
              <Text style={s.scheduleLabel}>Pickup Date</Text>
              <TouchableOpacity
                style={s.dateSelectBtn}
                onPress={() => setShowCalendar(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={16} color={scheduledDate ? COLORS.primaryDark : COLORS.gray} />
                <Text style={[s.dateSelectText, !scheduledDate && s.dateSelectPlaceholder]}>
                  {scheduledDate ? formatSelectedDate(scheduledDate) : "Choose a date"}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.gray} />
              </TouchableOpacity>

              <Text style={[s.scheduleLabel, { marginTop: SPACING.sm }]}>Time Slot (9 AM – 9 PM)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.slotRowContent}
              >
                {pickupTimeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.label}
                    style={[s.slotChip, scheduledSlot === slot.label && s.slotChipActive]}
                    onPress={() => setScheduledSlot(slot.label)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.slotChipText, scheduledSlot === slot.label && s.slotChipTextActive]}>
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ── Notes (matches cart, item 4.1) ────────────────── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Notes (optional)</Text>
          <View style={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.md }}>
            <TextInput
              style={s.notesInput}
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder="Any special instructions for this order?"
              placeholderTextColor={COLORS.gray}
              multiline
              numberOfLines={3}
              maxLength={1000}
              textAlignVertical="top"
            />
            <VoiceNoteRecorder
              url={voiceNoteUrl}
              onUploaded={setVoiceNoteUrl}
              onRemove={() => setVoiceNoteUrl(null)}
            />
          </View>
        </View>

        {/* ── Delivery address ──────────────────────────────── */}
        <View style={s.card}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Delivery Address</Text>
            <TouchableOpacity onPress={() => setShowAddressPicker(true)} activeOpacity={0.7}>
              <Text style={s.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>

          {addrLoading ? (
            <ActivityIndicator color={COLORS.primary} size="small" style={{ marginTop: 8 }} />
          ) : selectedAddress ? (
            <AddressLine addr={selectedAddress} />
          ) : (
            <TouchableOpacity
              style={s.addAddrRow}
              onPress={() => safeRouterPush(router, "/address")}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryDark} />
              <Text style={s.addAddrText}>Add Delivery Address</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Footer CTA - slide to confirm, same pattern as cart ─────────── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
        <View style={s.footerInfo}>
          <Text style={s.footerLabel}>Total</Text>
          <Text style={s.footerAmt}>
            {billing ? (estimatedDiscount > 0 ? displayTotalText : billing.total_amount_display) : "-"}
          </Text>
        </View>
        <View style={s.slideWrap}>
          <SlideToConfirm
            label={
              paymentMethod === "cod"
                ? PAYMENT_ACTION_LABELS.placeOrder
                : PAYMENT_ACTION_LABELS.proceedToPayment
            }
            disabled={!canProceed}
            processing={placing}
            onConfirm={handlePlaceOrder}
            icon={paymentMethod === "cod" ? "cash-outline" : "arrow-forward"}
          />
        </View>
      </View>

      {/* ── Pickup date calendar ──────────────────────────── */}
      <PickupDateCalendarModal
        visible={showCalendar}
        selectedDate={scheduledDate}
        onSelect={setScheduledDate}
        onClose={() => setShowCalendar(false)}
      />

      {/* ── Address picker modal ─────────────────────────── */}
      <Modal
        visible={showAddressPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressPicker(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setShowAddressPicker(false)}>
          <Pressable style={s.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select Address</Text>
            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={[s.addrItem, addr.id === selectedAddressId && s.addrItemSel]}
                onPress={() => {
                  setSelectedAddressId(addr.id);
                  setShowAddressPicker(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="location-outline"
                  size={15}
                  color={addr.id === selectedAddressId ? COLORS.primaryDark : COLORS.gray}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.addrName}>{addr.full_name}</Text>
                  <Text style={s.addrLine} numberOfLines={3}>
                    {[addr.address_line_1, addr.address_line_2, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                  </Text>
                </View>
                {addr.id === selectedAddressId && (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primaryDark} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.addAddrRow}
              onPress={() => {
                setShowAddressPicker(false);
                safeRouterPush(router, "/address");
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryDark} />
              <Text style={s.addAddrText}>Add New Address</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <CodConfirmModal
        visible={codModalVisible}
        // Bug fix: this always showed the pre-discount billing.total_amount_
        // display, even when a coupon was applied - the Bill Details total
        // (a few lines up) correctly falls back to the discount-aware
        // displayTotalText once estimatedDiscount > 0, but this modal was
        // missed when that pattern was added, so a customer could see e.g.
        // "Total ₹447" on the bill but "Amount to pay in cash ₹547" on the
        // very next screen for the same order.
        amountDisplay={estimatedDiscount > 0 ? displayTotalText : (billing?.total_amount_display ?? "")}
        itemCount={1}
        onCancel={handleCodCancel}
        onConfirm={handleCodConfirm}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { padding: SPACING.md, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    overflow: "hidden", ...SHADOW.card,
  },
  serviceHero: { flexDirection: "row", alignItems: "center", padding: SPACING.md, gap: SPACING.sm },
  serviceIcon: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  serviceThumb: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  serviceName: { fontSize: 15, fontWeight: "700", color: "#fff", lineHeight: 20 },
  serviceCategory: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  pricePill: {
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  priceText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  addonsSummary: {
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, paddingTop: 2,
    gap: 4,
  },
  addonSummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  addonSummaryLabelGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  addonSummaryBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#E6F5F6",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  extraItemBadge: { backgroundColor: "#E6F5F6" },
  addonSummaryName: { fontSize: 12, color: COLORS.gray, flex: 1 },
  addonSummaryPrice: { fontSize: 12, fontWeight: "700", color: COLORS.gray },
  extraItemAddonRow: { paddingLeft: 22 },
  extraItemAddonName: { fontSize: 11.5 },
  tagRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
  },
  tagText: { fontSize: 13, color: COLORS.gray },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black, padding: SPACING.md, paddingBottom: SPACING.sm },
  notesInput: { minHeight: 72, fontSize: 14, color: COLORS.black, padding: 0 },
  paymentMethodWrap: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  payMethodHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: SPACING.md },
  changeLink: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: SPACING.md, paddingTop: 0 },
  loadingText: { fontSize: 13, color: COLORS.gray },
  errorText: { fontSize: 13, color: COLORS.error, padding: SPACING.md, paddingTop: 0 },
  billingRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  billingLabel: { fontSize: 14, color: COLORS.gray },
  billingLabelBold: { color: COLORS.black, fontWeight: "700" },
  billingValue: { fontSize: 14, color: COLORS.black },
  billingValueBold: { fontWeight: "800", fontSize: 15, color: COLORS.primaryDark },
  divider: { height: 1, backgroundColor: COLORS.grayBorder, marginHorizontal: SPACING.md, marginVertical: 6 },
  advancePill: {
    flexDirection: "row", alignItems: "center",
    margin: SPACING.md, marginTop: SPACING.sm,
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  advancePillLabel: { fontSize: 13, fontWeight: "700", color: COLORS.primaryDark },
  advancePillSub: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  advancePillAmt: { fontSize: 16, fontWeight: "800", color: COLORS.primaryDark },
  pickupRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  pickupOpt: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, height: 44, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.grayBorder,
  },
  pickupOptSel: { borderColor: COLORS.primaryDark, backgroundColor: COLORS.primaryLight },
  pickupOptText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },
  pickupOptTextSel: { color: COLORS.primaryDark },
  scheduleLabel: { fontSize: 13, fontWeight: "600", color: COLORS.black, marginBottom: 4 },
  addrCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: SPACING.md, paddingTop: 0,
  },
  addrName: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  addrLine: { fontSize: 13, color: COLORS.gray, marginTop: 2, lineHeight: 18 },
  addAddrRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: SPACING.md, paddingTop: SPACING.sm,
  },
  addAddrText: { fontSize: 14, fontWeight: "600", color: COLORS.primaryDark },
  footer: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
    ...SHADOW.card,
  },
  footerInfo: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  footerLabel: { fontSize: 12, color: COLORS.gray },
  footerAmt: { fontSize: 20, fontWeight: "800", color: COLORS.primaryDark },
  slideWrap: { marginBottom: SPACING.xs },
  goBackBtn: {
    marginTop: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primaryDark, borderRadius: RADIUS.md,
  },
  goBackBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  bottomSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingBottom: SPACING.xl, maxHeight: "75%",
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.grayBorder,
    alignSelf: "center", marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  // Opens the full calendar (PickupDateCalendarModal) instead of a fixed
  // 7-day chip row, so scheduling isn't capped to the next week.
  dateSelectBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    height: 44, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.grayBorder,
    paddingHorizontal: SPACING.sm, backgroundColor: COLORS.white,
  },
  dateSelectText: { flex: 1, fontSize: 14, color: COLORS.black, fontWeight: "600" },
  dateSelectPlaceholder: { color: COLORS.gray, fontWeight: "400" },
  slotRowContent: { flexDirection: "row", gap: 8, marginTop: 4, paddingRight: 4 },
  slotChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.grayBorder,
    backgroundColor: COLORS.white,
  },
  slotChipActive: { borderColor: COLORS.primaryDark, backgroundColor: COLORS.primaryLight },
  slotChipText: { fontSize: 12.5, color: COLORS.black, fontWeight: "600" },
  slotChipTextActive: { color: COLORS.primaryDark },
  addrItem: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder,
  },
  addrItemSel: { backgroundColor: COLORS.primaryLight },
});
