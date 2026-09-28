/**
 * Cart tab - live cart from GET /cart
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
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import CartItemCard from "../../src/components/cart/CartItemCard";
import CodConfirmModal from "../../src/components/cart/CodConfirmModal";
import { CouponCodeInput } from "../../src/components/cart/CouponCodeInput";
import SlideToConfirm from "../../src/components/cart/SlideToConfirm";
import StyleReferencePicker from "../../src/components/cart/StyleReferencePicker";
import ErrorState from "../../src/components/common/ErrorState";
import PickupDateCalendarModal from "../../src/components/common/PickupDateCalendarModal";
import PaymentMethodSelector from "../../src/components/orders/PaymentMethodSelector";
import { useAppLanguage } from "../../src/i18n/useAppLanguage";
import { uploadOrderStyleReference } from "../../src/services/apiOrderService";
import { useAddressStore } from "../../src/store/useAddressStore";
import { useCartStore } from "../../src/store/useCartStore";
import { useCheckoutPreferencesStore } from "../../src/store/useCheckoutPreferencesStore";
import { listOffers } from "../../src/services/offerService";
import type { ApiAddress } from "../../src/types/api";
import type { CartServiceEntry } from "../../src/types/cart";
import type { ApiSpecialOffer } from "../../src/types/homeApi";
import type { PaymentMethodOption } from "../../src/types/payment";
import {
  executeCheckoutFromCart,
  resolveCheckoutAddressId,
} from "../../src/utils/checkoutNavigation";
import { estimateCouponDiscount } from "../../src/utils/couponDiscount";
import { formatCurrency } from "../../src/utils/formatters";
import { buildPickupTimeSlots } from "../../src/utils/pickupTimeSlots";

// ─── Scheduled-pickup helpers ─────────────────────────────────────────────────

function formatSelectedPickupDate(iso: string): string {
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
              size={13}
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
          <Text style={addrStyles.editText}>{address ? "Change" : "Add"}</Text>
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
          Tap &quot;Add&quot; to set a delivery address before checkout
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
      <Text style={[billStyles.label, bold && billStyles.labelBold]}>
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

// ─── Offer row ───────────────────────────────────────────────────────────────
function OfferRow({
  offer,
  applied,
  eligible,
  onApply,
  onRemove,
}: {
  offer: ApiSpecialOffer;
  applied: boolean;
  eligible: boolean;
  onApply: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={offerStyles.row}>
      <View style={offerStyles.left}>
        <View style={[offerStyles.badge, !eligible && offerStyles.badgeDisabled]}>
          <Text style={offerStyles.badgeText}>
            {offer.DiscountType === "flat"
              ? formatCurrency(offer.DiscountAmount)
              : `${offer.DiscountPercent}%`}
          </Text>
        </View>
        <View style={offerStyles.textWrap}>
          <Text style={[offerStyles.title, !eligible && offerStyles.titleDisabled]} numberOfLines={1}>
            {offer.Title}
          </Text>
          {!eligible ? (
            <Text style={offerStyles.desc} numberOfLines={1}>
              Min. order {formatCurrency(offer.MinOrderValue)}
            </Text>
          ) : offer.Description ? (
            <Text style={offerStyles.desc} numberOfLines={1}>
              {offer.Description}
            </Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={[offerStyles.applyBtn, applied && offerStyles.applyBtnActive, !eligible && offerStyles.applyBtnDisabled]}
        onPress={applied ? onRemove : onApply}
        activeOpacity={0.8}
        hitSlop={8}
        disabled={!eligible && !applied}
      >
        {applied ? (
          <Ionicons name="checkmark" size={14} color={offerStyles.applyTextActive.color} style={{ marginRight: 3 }} />
        ) : null}
        <Text
          style={[
            offerStyles.applyText,
            applied && offerStyles.applyTextActive,
          ]}
        >
          {applied ? "Applied" : "Apply"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CartScreen() {
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  // Responsive scale - same inline useWindowDimensions-derived approach used
  // on the Home screen (no separate scaling library in this project).
  const isTablet = screenWidth >= 768;
  const horizontalPad = isTablet ? Math.max(SPACING.lg, screenWidth * 0.05) : SPACING.lg;
  const contentMaxWidth = isTablet ? 720 : screenWidth;

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
  const pickupType = useCartStore((s) => s.pickupType);
  const setPickupType = useCartStore((s) => s.setPickupType);

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

  const { addresses, fetchAddresses } = useAddressStore();

  // Bug fix: this used to read useHomeStore's specialOffers (GET /home) -
  // a globally Redis-cached, unauthenticated homepage payload with no
  // per-user filtering, so an already-used coupon kept showing as
  // "Available" here even after GET /offers itself was fixed to exclude
  // it. Now fetches GET /offers directly (offerService.listOffers), which
  // IS scoped to the logged-in customer.
  const [specialOffers, setSpecialOffers] = useState<ApiSpecialOffer[]>([]);
  const loadHomeData = useCallback(async () => {
    const offers = await listOffers();
    setSpecialOffers(offers);
  }, []);
  const appliedOfferId = useCartStore((s) => s.appliedOfferId);
  const appliedOfferDiscountType = useCartStore((s) => s.appliedOfferDiscountType);
  const appliedOfferDiscountValue = useCartStore((s) => s.appliedOfferDiscountValue);
  const appliedOfferMaxDiscountAmount = useCartStore((s) => s.appliedOfferMaxDiscountAmount);
  const setAppliedOffer = useCartStore((s) => s.setAppliedOffer);
  const clearAppliedOffer = useCartStore((s) => s.clearAppliedOffer);

  const [refreshing, setRefreshing] = useState(false);
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  // Available Offers: show only 2 by default, "View All" reveals the rest
  // (Bug Report cycle 1, item 2.1).
  const [offersExpanded, setOffersExpanded] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [scheduledSlot, setScheduledSlot] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const pickupTimeSlots = useMemo(() => buildPickupTimeSlots(), []);
  // styleReferenceUri holds the local picker preview immediately, then the
  // uploaded https:// url once uploadOrderStyleReference resolves - the
  // checkout call below only sends it once it's the uploaded url (see the
  // /^https?:\/\// check further down), so this used to silently drop the
  // photo entirely: nothing here ever uploaded it.
  const [styleReferenceUri, setStyleReferenceUri] = useState<string | null>(null);
  const [styleReferenceUploading, setStyleReferenceUploading] = useState(false);
  // Order-level free-text notes (Bug Report cycle 1, item 3.1).
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [codModalVisible, setCodModalVisible] = useState(false);

  const handlePickStyleReference = async () => {
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
      // Forced crop UI was overlapping the photo / behaving badly; a style
      // reference doesn't need cropping, so just take the picked image as-is.
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
  };

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
      void loadHomeData().catch(() => {});
    }, [entries.length, refreshCart, fetchAddresses, loadHomeData]),
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

  const runCheckout = useCallback(() => {
    setCheckingOut(true);
    const finish = () => setCheckingOut(false);
    // Order-level notes go straight through. handlePickStyleReference now
    // uploads the picked photo immediately (uploadOrderStyleReference), so
    // by the time checkout can run, styleReferenceUri is either null or
    // already the uploaded https:// url - this check stays as a defensive
    // guard (never send a local file:// path to the backend), not the
    // primary gate it used to be before the upload step existed.
    const extras = {
      customizationNotes: orderNotes.trim() || undefined,
      imageReferences:
        styleReferenceUri && /^https?:\/\//.test(styleReferenceUri)
          ? [styleReferenceUri]
          : undefined,
    };
    if (pickupType === "scheduled" && scheduledDate && scheduledSlot) {
      const slot = pickupTimeSlots.find((s) => s.label === scheduledSlot);
      const dt = new Date(scheduledDate);
      dt.setHours(slot?.hour ?? 9, slot?.minute ?? 0, 0, 0);
      void executeCheckoutFromCart(
        router,
        { scheduledPickupAt: dt.toISOString(), pickupTimeSlot: scheduledSlot },
        paymentMethod,
        extras,
      ).finally(finish);
    } else {
      void executeCheckoutFromCart(router, undefined, paymentMethod, extras).finally(finish);
    }
  }, [pickupType, scheduledDate, scheduledSlot, pickupTimeSlots, paymentMethod, router, orderNotes, styleReferenceUri]);

  const handleConfirmSlide = useCallback(() => {
    if (styleReferenceUploading) {
      Alert.alert("Please wait", "Your style reference photo is still uploading.");
      return;
    }
    if (paymentMethod === "cod") {
      // Keep the slider's processing state on through the confirmation
      // sheet so the thumb doesn't visually "unlock" mid-decision; reset it
      // explicitly if the user backs out via Cancel.
      setCheckingOut(true);
      setCodModalVisible(true);
      return;
    }
    runCheckout();
  }, [paymentMethod, runCheckout, styleReferenceUploading]);

  const handleCodCancel = useCallback(() => {
    setCodModalVisible(false);
    setCheckingOut(false);
  }, []);

  const handleCodConfirm = useCallback(() => {
    setCodModalVisible(false);
    runCheckout();
  }, [runCheckout]);

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
            void updateEntryQuantity(item.id, item.quantity + 1).catch(
              () => {},
            );
          }}
          onDecrease={() => {
            void updateEntryQuantity(item.id, item.quantity - 1).catch(
              () => {},
            );
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

  // Filter to valid, started, non-expired offers with a real discount of
  // EITHER type - previously only checked DiscountPercent > 0, which
  // silently hid every flat-amount offer (DiscountPercent is 0 for those;
  // the real value is in DiscountAmount - see app/models/offer.py).
  // Must be declared BEFORE listFooter which references it
  //
  // react-hooks/purity (React Compiler) correctly flags a bare Date.now()
  // read during render as impure - the compiler can't safely memoize
  // anything derived from it, and worse, a useMemo keyed only on
  // specialOffers would never re-derive once time alone makes an offer
  // expire, silently keeping it marked "valid" for as long as the cart
  // screen stays mounted. useState's lazy initializer is the documented
  // exception (runs exactly once, on mount) - refreshed every minute so an
  // offer that expires while the customer is sitting on this screen
  // disappears within a minute rather than needing a remount, matching
  // the precision PickupInfoCard's useCountdown already uses for the same
  // "time keeps moving during this screen's lifetime" problem.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const validOffers = useMemo(() => {
    return (specialOffers ?? []).filter(
      (o) =>
        (o.DiscountType === "flat" ? (o.DiscountAmount ?? 0) > 0 : o.DiscountPercent > 0) &&
        (!o.ValidFrom || new Date(o.ValidFrom).getTime() <= now) &&
        (!o.ValidUntil || new Date(o.ValidUntil).getTime() > now),
    );
  }, [specialOffers, now]);

  const listFooter = useMemo(
    () => (
      <Animated.View
        entering={FadeInDown.delay(60 + entries.length * 30).duration(250)}
        style={{ paddingBottom: SPACING.xs }}
      >
        {/* Section order per Bug Report cycle 1, item 3.1:
            (Order Items = the FlatList above) → Reference Style Image →
            Delivery Address → Available Offers → Pickup Type → Notes →
            (Order Summary = the bottom checkout sheet). */}

        {/* ── Reference Style Image ───────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Reference style image</Text>
        <View style={styles.footerCard}>
          <StyleReferencePicker
            uri={styleReferenceUri}
            onPick={() => void handlePickStyleReference()}
            onRemove={() => setStyleReferenceUri(null)}
            uploading={styleReferenceUploading}
          />
        </View>

        {/* ── Delivery Address ────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Delivery address</Text>
        <CartDeliveryAddressCard
          address={deliveryAddress}
          onEdit={handleEditAddress}
        />

        {/* ── Available Offers ─────────────────────────────────────────── */}
        <View style={offerStyles.section}>
          <View style={offerStyles.sectionHeader}>
            <Ionicons
              name="pricetag-outline"
              size={13}
              color={COLORS.primaryDark}
            />
            <Text style={offerStyles.sectionTitle}>Available Offers</Text>
          </View>
          {validOffers.length === 0 ? (
            <Text style={offerStyles.emptyText}>
              No offers available right now — got a code? Enter it below.
            </Text>
          ) : (
            <>
              {(offersExpanded ? validOffers : validOffers.slice(0, 2)).map((offer) => (
                <OfferRow
                  key={offer.Id}
                  offer={offer}
                  applied={appliedOfferId === offer.Id}
                  eligible={billing.totalAmount >= (offer.MinOrderValue ?? 0)}
                  onApply={() =>
                    setAppliedOffer(
                      offer.Id,
                      offer.DiscountType === "flat" ? "flat" : "percentage",
                      offer.DiscountType === "flat" ? (offer.DiscountAmount ?? 0) : offer.DiscountPercent,
                      offer.Title,
                      offer.MaxDiscountAmount ?? null,
                      offer.MinOrderValue ?? 0,
                    )
                  }
                  onRemove={clearAppliedOffer}
                />
              ))}
              {validOffers.length > 2 && (
                <TouchableOpacity
                  onPress={() => setOffersExpanded((v) => !v)}
                  style={offerStyles.viewAllBtn}
                  accessibilityRole="button"
                  accessibilityLabel={offersExpanded ? "Show fewer offers" : "View all offers"}
                >
                  <Text style={offerStyles.viewAllText}>
                    {offersExpanded ? "Show less" : `View all (${validOffers.length})`}
                  </Text>
                  <Ionicons
                    name={offersExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={COLORS.primaryDark}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
          {/* Manual coupon-code entry - previously missing entirely; the
              screen only ever let a customer browse and tap a pre-listed
              offer. Applies through the same useCartStore mechanism the
              browse list uses, so checkoutNavigation.ts's existing
              cart.appliedOfferId read-path needs no changes. */}
          <CouponCodeInput
            orderTotal={billing.totalAmount}
            onApply={(offer) =>
              setAppliedOffer(
                offer.offerId,
                offer.discountType,
                offer.discountValue,
                offer.title,
                offer.maxDiscountAmount,
                offer.minOrderValue,
              )
            }
          />
        </View>

        {/* ── Pickup Type (Instant / Scheduled) - standalone section ───── */}
        <Text style={styles.sectionLabel}>Pickup type</Text>
        <View style={styles.footerCard}>
          <View style={styles.pickupToggle}>
            <TouchableOpacity
              style={[styles.pickupOption, pickupType === "instant" && styles.pickupOptionActive]}
              onPress={() => setPickupType("instant")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash"
                size={15}
                color={pickupType === "instant" ? COLORS.primaryDark : COLORS.gray}
              />
              <Text style={[styles.pickupOptionText, pickupType === "instant" && styles.pickupOptionTextActive]}>
                Instant
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickupOption, pickupType === "scheduled" && styles.pickupOptionActive]}
              onPress={() => setPickupType("scheduled")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="calendar"
                size={15}
                color={pickupType === "scheduled" ? COLORS.primaryDark : COLORS.gray}
              />
              <Text style={[styles.pickupOptionText, pickupType === "scheduled" && styles.pickupOptionTextActive]}>
                Scheduled
              </Text>
            </TouchableOpacity>
          </View>

          {pickupType === "scheduled" ? (
            <View style={styles.scheduledPicker}>
              <Text style={styles.scheduledPickerTitle}>Pickup date</Text>
              <TouchableOpacity
                style={styles.dateSelectBtn}
                onPress={() => setShowCalendar(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={scheduledDate ? COLORS.primaryDark : COLORS.gray}
                />
                <Text style={[styles.dateSelectText, !scheduledDate && styles.dateSelectPlaceholder]}>
                  {scheduledDate ? formatSelectedPickupDate(scheduledDate) : "Choose a date"}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={[styles.scheduledPickerTitle, { marginTop: 8 }]}>
                Time slot (9 AM – 9 PM)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.slotRow}
              >
                {pickupTimeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.label}
                    style={[styles.slotChip, scheduledSlot === slot.label && styles.slotChipActive]}
                    onPress={() => setScheduledSlot(slot.label)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.slotChipText, scheduledSlot === slot.label && styles.slotChipTextActive]}>
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* ── Notes ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <View style={styles.footerCard}>
          <View style={styles.notesBox}>
            <TextInput
              style={styles.notesInput}
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder="Any special instructions for this order?"
              placeholderTextColor={COLORS.gray}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
          </View>
          {orderNotes.length > 0 ? (
            <Text style={styles.notesCounter}>{orderNotes.length}/1000</Text>
          ) : null}
        </View>
      </Animated.View>
    ),
    [
      validOffers,
      offersExpanded,
      appliedOfferId,
      setAppliedOffer,
      clearAppliedOffer,
      deliveryAddress,
      entries.length,
      handleEditAddress,
      styleReferenceUri,
      handlePickStyleReference,
      pickupType,
      setPickupType,
      scheduledDate,
      scheduledSlot,
      pickupTimeSlots,
      orderNotes,
    ],
  );

  // Client-side discount estimate for display only; backend is authoritative
  // (checkout only ever sends offer_id, recomputes the real discount server
  // -side - see checkout_service.py). Shared with buy-now-review.tsx via
  // estimateCouponDiscount() so the two screens can't drift again.
  const estimatedDiscount = appliedOfferId
    ? estimateCouponDiscount(
        {
          discountType: appliedOfferDiscountType,
          discountValue: appliedOfferDiscountValue,
          maxDiscountAmount: appliedOfferMaxDiscountAmount,
        },
        billing.totalAmount,
      )
    : 0;

  // Derive GST split percentages from actual amounts so labels always match config
  const taxableBase = billing.itemTotal - (billing.discount || 0);
  const cgstPercent =
    taxableBase > 0
      ? +((billing.cgstAmount / taxableBase) * 100).toFixed(2)
      : 0;
  const sgstPercent =
    taxableBase > 0
      ? +((billing.sgstAmount / taxableBase) * 100).toFixed(2)
      : 0;

  const displayTotal =
    estimatedDiscount > 0
      ? `₹${Math.max(billing.totalAmount - estimatedDiscount, 1).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
      : billing.totalAmountDisplay;

  const isEmpty = !loading && entries.length === 0;
  const scheduledReady =
    pickupType !== "scheduled" ||
    (scheduledDate !== null && scheduledSlot !== null);
  // hasAdvance only matters for online payment (nothing is paid upfront for
  // COD - a zero advance/platform-fee is a perfectly valid COD order, not a
  // reason to block checkout). Gating COD on it left the slide-to-confirm
  // permanently disabled whenever the advance amount happened to be 0.
  const canPay =
    itemCount > 0 &&
    entries.length > 0 &&
    !mutating &&
    (paymentMethod === "cod" || hasAdvance) &&
    scheduledReady;

  const slideLabel =
    paymentMethod === "cod"
      ? "Slide to Place Order"
      : hasAdvance
        // Use displayTotal (which subtracts the applied discount), not the
        // pre-discount advanceAmountDisplay, so the slider matches the "To Pay"
        // amount the customer actually gets charged.
        ? `Slide to Pay ${displayTotal}`
        : "Slide to Proceed to Payment";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons
              name="bag-handle-outline"
              size={18}
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
            <Ionicons
              name="cart-outline"
              size={48}
              color={COLORS.primaryDark}
            />
          </View>
          <Text style={styles.emptyTitle}>{t("cart.emptyTitle")}</Text>
          <Text style={styles.emptySub}>{t("cart.emptySub")}</Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => router.push("/(tabs)")}
            activeOpacity={0.85}
          >
            <Ionicons name="grid-outline" size={17} color={COLORS.white} />
            <Text style={styles.browseBtnText}>
              {t("common.browseServices")}
            </Text>
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
            contentContainerStyle={[
              styles.listContent,
              {
                paddingHorizontal: horizontalPad,
                maxWidth: contentMaxWidth,
                alignSelf: "center",
                width: "100%",
              },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
          />

          {/* ── Compact checkout sheet ───────────────────────────────────
              Bottom-sheet style panel (Swiggy/Blinkit/Uber Eats pattern):
              default state shows only Order Total + Payment Method +
              Slide to Confirm. Pickup, scheduled date/slot, style
              reference, and the full price breakdown are all collapsed
              or minimal by default so the cart items stay primary. */}
          {/* No insets.bottom padding here - the persistent tab bar
              (app/_layout.tsx's PersistentTabBar, always visible on this
              screen) already reserves the home-indicator safe area right
              below this sheet. Adding it again here double-reserved that
              space and left a large empty gap between "Slide to Pay" and
              the tab bar. */}
          <View style={[styles.sheet, { paddingBottom: SPACING.sm }]}>
            <View style={styles.sheetGrabber} />

            <View
              style={{
                width: "100%",
                maxWidth: contentMaxWidth,
                alignSelf: "center",
                paddingHorizontal: horizontalPad,
              }}
            >
              {/* Order summary card - total is always visible, tap to expand full breakdown */}
              <View style={styles.summaryCard}>
                <TouchableOpacity
                  style={styles.totalRow}
                  onPress={() => setBreakdownExpanded((v) => !v)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: breakdownExpanded }}
                >
                  <View style={styles.totalRowLeft}>
                    <Text style={styles.totalRowLabel}>Total</Text>
                    <View style={styles.totalRowHintRow}>
                      <Text style={styles.totalRowHint}>
                        {breakdownExpanded ? "Hide breakdown" : "Tap to view breakdown"}
                      </Text>
                      <Ionicons
                        name={breakdownExpanded ? "chevron-up" : "chevron-down"}
                        size={11}
                        color={COLORS.primaryDark}
                      />
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.totalRowValue}>{displayTotal}</Text>
                    {estimatedDiscount > 0 ? (
                      <Text style={styles.savingsBadge}>
                        You save ₹{estimatedDiscount.toLocaleString("en-IN")}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

              {breakdownExpanded ? (
                <View style={styles.breakdown}>
                  <BillRow
                    label="Services subtotal"
                    value={billing.itemTotalDisplay}
                  />
                  <BillRow
                    label="Convenience fee"
                    value={billing.platformFeeDisplay}
                  />
                  <BillRow
                    label={`CGST (${cgstPercent}%)`}
                    value={billing.cgstDisplay}
                  />
                  <BillRow
                    label={`SGST (${sgstPercent}%)`}
                    value={billing.sgstDisplay}
                  />
                  {billing.penaltyAmount > 0 ? (
                    <BillRow
                      label="Cancellation Charges"
                      value={`₹${Math.round(billing.penaltyAmount).toLocaleString("en-IN")}`}
                    />
                  ) : null}
                  <View style={styles.breakdownDivider} />
                  {billing.discount > 0 ? (
                    <>
                      <BillRow
                        label="Total before discount"
                        value={billing.totalAmountDisplay}
                      />
                      <BillRow
                        label="Discount"
                        value={`−₹${billing.discount.toLocaleString("en-IN")}`}
                        discount
                      />
                      <View style={styles.breakdownDivider} />
                    </>
                  ) : estimatedDiscount > 0 ? (
                    <>
                      <BillRow
                        label="Total before offer"
                        value={billing.totalAmountDisplay}
                      />
                      <BillRow
                        label="Offer discount (est.)"
                        value={`−₹${estimatedDiscount.toLocaleString("en-IN")}`}
                        discount
                      />
                      <View style={styles.breakdownDivider} />
                    </>
                  ) : null}
                  <BillRow label="Total" value={displayTotal} bold accent />

                  {/* COD: a short "pay in cash on delivery" note adds real info.
                      Online: the full amount IS the grand total (no advance/
                      remaining split), so a separate "Payable Amount" row just
                      repeated Grand total - removed as redundant. */}
                  {hasAdvance && paymentMethod === "cod" ? (
                    <>
                      <View style={styles.breakdownDivider} />
                      <View style={styles.codNotice}>
                        <Ionicons name="cash-outline" size={14} color={COLORS.primaryDark} />
                        <Text style={styles.codNoticeText}>
                          Pay {displayTotal} in cash on delivery. No payment needed now.
                        </Text>
                      </View>
                    </>
                  ) : null}

                  {/* Pickup type + style reference moved OUT of this collapsed
                      breakdown into standalone scrollable sections above
                      (Bug Report cycle 1, item 3.1). */}
                </View>
              ) : null}
              </View>

              {/* Payment method - always visible, compact */}
              {entries.length > 0 ? (
                <View style={styles.paymentMethodSection}>
                  <PaymentMethodSelector
                    value={paymentMethod}
                    onChange={handleSelectPaymentMethod}
                    disabled={mutating}
                  />
                </View>
              ) : null}

              {/* Slide to confirm */}
              <View style={styles.slideWrap}>
                <SlideToConfirm
                  label={slideLabel}
                  disabled={!canPay}
                  processing={checkingOut}
                  onConfirm={handleConfirmSlide}
                  icon={paymentMethod === "cod" ? "bag-check-outline" : "shield-checkmark-outline"}
                />
              </View>

              {paymentMethod !== "cod" && !hasAdvance && entries.length > 0 && !loading ? (
                <Text style={styles.payHint}>
                  Refreshing pricing... pull down to reload
                </Text>
              ) : !scheduledReady ? (
                <Text style={styles.payHint}>
                  Select a pickup date and time slot to continue
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      )}

      <CodConfirmModal
        visible={codModalVisible}
        // Bug fix: this always showed the pre-discount billing.totalAmount
        // Display, even with a coupon applied - the bill rows above already
        // correctly use displayTotal (which subtracts the applied discount)
        // in the same scenario, this modal was just missed.
        amountDisplay={displayTotal}
        itemCount={itemCount}
        onCancel={handleCodCancel}
        onConfirm={handleCodConfirm}
      />

      <PickupDateCalendarModal
        visible={showCalendar}
        selectedDate={scheduledDate}
        onSelect={setScheduledDate}
        onClose={() => setShowCalendar(false)}
      />
    </View>
  );
}

// ─── Address card styles ──────────────────────────────────────────────────────
const addrStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.12)",
    ...SHADOW.card,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  editBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.2)",
  },
  editText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  body: { gap: 2 },
  name: {
    fontSize: 12.5,
    fontWeight: "700",
    color: COLORS.black,
  },
  detail: {
    fontSize: 11.5,
    color: COLORS.gray,
    lineHeight: 16,
  },
  missingText: {
    fontSize: 11.5,
    color: COLORS.error,
    lineHeight: 16,
    fontStyle: "italic",
  },
});

// ─── Bill row styles ──────────────────────────────────────────────────────────
const billStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  label: { fontSize: 12.5, color: COLORS.gray, fontWeight: "500" },
  labelBold: { color: COLORS.black, fontWeight: "700" },
  value: { fontSize: 12.5, fontWeight: "600", color: COLORS.black },
  valueBold: { fontSize: 13.5, fontWeight: "800" },
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
    paddingVertical: SPACING.sm + 2,
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
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.black },
  headerSub: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 1,
    fontWeight: "500",
  },

  body: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.gray,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: SPACING.xs + 2,
    // Uniform gap above every section label so sections are evenly spaced
    // (was too tight below the offers card, which sets its own top margin).
    marginTop: SPACING.md,
  },
  footerCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ECEEF2",
    ...SHADOW.card,
  },
  notesBox: {
    backgroundColor: "#F7F9F9",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#EAEEEE",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notesInput: {
    minHeight: 52,
    maxHeight: 120,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.black,
    padding: 0,
  },
  notesCounter: {
    alignSelf: "flex-end",
    marginTop: 6,
    fontSize: 11,
    color: COLORS.gray,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  loadingText: { fontSize: 13, color: COLORS.gray },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  emptyIconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.12)",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12.5,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: SPACING.md,
    maxWidth: 300,
  },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 11,
    ...SHADOW.card,
  },
  browseBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.white },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.xs,
    ...SHADOW.strong,
  },
  sheetGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.grayBorder,
    alignSelf: "center",
    marginBottom: SPACING.xs + 2,
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.12)",
    paddingHorizontal: SPACING.sm + 2,
    marginBottom: SPACING.sm,
    ...SHADOW.card,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  totalRowLeft: { flex: 1, gap: 2 },
  totalRowLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: COLORS.black,
  },
  totalRowHintRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  totalRowHint: {
    fontSize: 10.5,
    fontWeight: "500",
    color: COLORS.gray,
  },
  totalRowValue: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primaryDark,
    letterSpacing: -0.4,
  },
  savingsBadge: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#16a34a",
    marginTop: 1,
  },

  breakdown: {
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm + 2,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: COLORS.grayBorder,
    marginVertical: 4,
  },
  codNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  codNoticeText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "600",
    color: COLORS.primaryDark,
    lineHeight: 15,
  },

  paymentMethodSection: {
    marginBottom: SPACING.sm,
  },
  slideWrap: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },

  payHint: {
    fontSize: 11,
    color: COLORS.gray,
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: SPACING.xs,
  },

  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  pickupLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.black,
  },
  pickupToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F5",
    borderRadius: RADIUS.md,
    padding: 4,
    gap: 4,
  },
  pickupOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: RADIUS.sm,
  },
  pickupOptionActive: {
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  pickupOptionText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: COLORS.gray,
  },
  pickupOptionTextActive: {
    color: COLORS.primaryDark,
    fontWeight: "700",
  },

  // Scheduled pickup date/slot picker
  scheduledPicker: {
    marginTop: 8,
  },
  scheduledPickerTitle: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: COLORS.primaryDark,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  // Opens the full calendar (PickupDateCalendarModal) instead of a fixed
  // 7-day chip row, so scheduling isn't capped to the next week.
  dateSelectBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    height: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  dateSelectText: { flex: 1, fontSize: 13, color: COLORS.black, fontWeight: "600" as const },
  dateSelectPlaceholder: { color: COLORS.gray, fontWeight: "400" as const },
  slotRow: { flexDirection: "row" as const, gap: 8, paddingRight: 4 },
  slotChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
  },
  slotChipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  slotChipText: {
    fontSize: 12.5,
    fontWeight: "600" as const,
    color: COLORS.black,
  },
  slotChipTextActive: { color: COLORS.white },
});

// ─── Offer section styles ─────────────────────────────────────────────────────
const offerStyles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.12)",
    // Matches sectionLabel's marginTop so the gap before the offers card equals
    // the gap before every other labelled section (uniform rhythm).
    marginTop: SPACING.md,
    overflow: "hidden",
    ...SHADOW.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
    backgroundColor: COLORS.primaryLight,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.gray,
    paddingHorizontal: SPACING.sm + 2,
    paddingTop: 10,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    marginTop: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
    marginRight: SPACING.sm,
  },
  badge: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: COLORS.white },
  badgeDisabled: { backgroundColor: COLORS.grayBorder },
  textWrap: { flex: 1 },
  title: { fontSize: 12.5, fontWeight: "700", color: COLORS.black },
  titleDisabled: { color: COLORS.gray },
  desc: { fontSize: 10.5, color: COLORS.gray, marginTop: 1 },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primaryDark,
    backgroundColor: "transparent",
  },
  applyBtnActive: {
    backgroundColor: COLORS.primaryDark,
  },
  applyBtnDisabled: { borderColor: COLORS.grayBorder, opacity: 0.5 },
  applyText: { fontSize: 11, fontWeight: "700", color: COLORS.primaryDark },
  applyTextActive: { color: COLORS.white },
});
