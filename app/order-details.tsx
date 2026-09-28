/**
 * Full order details - GET /customer/orders/{order_id}/details
 * Binds to: order, service, pricing, payment, delivery_address, measurement, tracking_timeline
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import ErrorState from "../src/components/common/ErrorState";
import ScreenHeader from "../src/components/common/ScreenHeader";
import { CancelOrderSection } from "../src/components/orders/CancelOrderSection";
import OrderScreenSection from "../src/components/orders/OrderScreenSection";
import OrderStatusModal, {
  type OrderCelebrationKind,
} from "../src/components/orders/OrderStatusModal";
import OrderTimeline from "../src/components/orders/OrderTimeline";
import ProgressGallery from "../src/components/orders/ProgressGallery";
import { RescheduleOrderSection } from "../src/components/orders/RescheduleOrderSection";
import OrderDetailsSkeleton from "../src/components/skeletons/OrderDetailsSkeleton";
import { API_BASE_URL } from "../src/config/api";
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  PHOTO_VISIBLE_STAGES,
  normalizeOrderStatus,
  type OrderStatus,
} from "../src/constants/orderStatus";
import {
  fetchCustomerOrderDetails,
  fetchOrderRating,
  submitOrderRating,
} from "../src/services/customerOrderService";
import { downloadAndShareInvoice } from "../src/services/invoiceService";
import {
  PaymentAlreadyCompletedError,
  confirmRazorpayPayment,
  parsePositiveId,
  resolveBalancePaymentSessionForOrder,
} from "../src/services/paymentService";
import { wsService } from "../src/services/wsService";
import { useCustomerOrdersStore } from "../src/store/useCustomerOrdersStore";
import type {
  CustomerOrderDetailsPayload,
} from "../src/types/customerOrders";
import { cardShadow } from "../src/utils/cardShadow";
import {
  STATUS_ICON_STYLES,
  formatCustomerOrderStatusLabel,
  getCustomerOrderStatusTone,
  getOrderStatusNarrative,
} from "../src/utils/customerOrderStatus";
import {
  DETAILS_NA,
  detailsMeasurement,
  detailsMoney,
  detailsText,
  getDetailsStatusHeadline
} from "../src/utils/orderDetailsDisplay";
import {
  PaymentCancelledError,
  openRazorpayCheckout,
} from "../src/utils/razorpayCheckout";
import { normalizeServiceImageUrl } from "../src/utils/serviceImage";
import { useAuthStore } from "../store/useAuthStore";

// Bug fix: setLayoutAnimationEnabledExperimental is a documented no-op on
// React Native's New Architecture (this app has newArchEnabled: true) -
// see StyleReferencePicker.tsx's identical comment for the full reasoning.

// Module-level cache: survives component unmount/remount within the app session.
// Key format: "<orderId>:<status>" - prevents the same popup from repeating.
const _shownPopups = new Set<string>();

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={styles.infoRow}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={5}>
        {value}
      </Text>
    </View>
  );
}

/** A selected add-on under a service line. Previously rendered through the
 * generic InfoRow with a literal "+ " prefixed onto the label text - just a
 * plain text row indistinguishable from "Base price"/"Quantity" above it,
 * reading as a raw string concatenation rather than a designed line item.
 * This gives the add-on its own visual identity (a small teal plus-circle
 * badge instead of a "+" character, slightly indented to read as nested
 * under the service rather than a peer row) - the same "included extra"
 * treatment a polished checkout/receipt UI gives optional line items. */
function AddonRow({
  name,
  price,
  note,
}: {
  name: string;
  price: string;
  note?: string | null;
}) {
  return (
    <View
      style={styles.addonRow}
      accessible
      accessibilityLabel={`Add-on: ${name}, ${price}${note ? `, note: ${note}` : ""}`}
    >
      <View style={styles.addonRowTop}>
        <View style={styles.addonLabelGroup}>
          <View style={styles.addonBadge}>
            <Ionicons name="add" size={11} color={COLORS.primaryDark} />
          </View>
          <Text style={styles.addonLabel} numberOfLines={2}>
            {name}
          </Text>
        </View>
        <Text style={styles.addonValue}>{price}</Text>
      </View>
      {note ? (
        <Text style={styles.addonNote} numberOfLines={3}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function RowDivider() {
  return <View style={styles.infoDivider} />;
}

/** Shared by both the pickup and delivery partner cards - same shape, just a
 * different title/subtitle so the customer knows which leg this person is
 * handling (a delivery broadcast can hand the order to someone different
 * than whoever did the pickup). Shows a star rating when the Bridge
 * employee has one (BridgeProfile.Rating, rolled up from real customer
 * ratings) - doorstep trust/safety: name + photo to confirm identity, phone
 * to call ahead, rating as a quick trust signal, matching the pattern any
 * rider-facing delivery app already uses. */
function BridgePartnerCard({
  title,
  subtitle,
  partner,
}: {
  title: string;
  subtitle: string;
  partner: { name: string; photo_url: string | null; mobile: string | null; rating?: number | null };
}) {
  // Tap the avatar to see the full photo - same fullscreen-viewer pattern
  // as ReferenceImagesSection below, so a customer can actually make out
  // the person's face for doorstep verification instead of just a tiny
  // thumbnail circle.
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <OrderScreenSection title={title}>
      <View style={styles.pickupPartnerRow}>
        <TouchableOpacity
          onPress={() => partner.photo_url && setViewerOpen(true)}
          disabled={!partner.photo_url}
          activeOpacity={0.8}
          accessibilityLabel={partner.photo_url ? `View full photo of ${partner.name}` : undefined}
        >
          {partner.photo_url ? (
            <Image
              source={{ uri: partner.photo_url }}
              style={styles.pickupPartnerAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.pickupPartnerAvatar, styles.pickupPartnerAvatarFallback]}>
              <Ionicons name="person" size={24} color={COLORS.gray} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.pickupPartnerInfo}>
          <Text style={styles.pickupPartnerName}>{partner.name}</Text>
          <Text style={styles.pickupPartnerSub}>{subtitle}</Text>
          {partner.rating != null ? (
            <View style={styles.pickupPartnerRatingRow}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={styles.pickupPartnerRatingText}>{partner.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        {partner.mobile ? (
          <TouchableOpacity
            style={styles.pickupPartnerCallBtn}
            onPress={() => Linking.openURL(`tel:${partner.mobile}`)}
            accessibilityLabel={`Call ${partner.name}`}
          >
            <Ionicons name="call" size={18} color={COLORS.white} />
          </TouchableOpacity>
        ) : null}
      </View>

      {partner.photo_url ? (
        <Modal
          visible={viewerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerOpen(false)}
        >
          <View style={styles.imageViewerOverlay}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              onPress={() => setViewerOpen(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: partner.photo_url }}
              style={styles.imageViewerImg}
              contentFit="contain"
            />
          </View>
        </Modal>
      ) : null}
    </OrderScreenSection>
  );
}

function BillRow({
  label,
  value,
  bold,
  discount,
}: {
  label: string;
  value: string;
  bold?: boolean;
  discount?: boolean;
}) {
  return (
    <View
      style={styles.billRow}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.billLabel, bold && styles.billLabelBold]}>
        {label}
      </Text>
      <Text
        style={[
          styles.billValue,
          bold && styles.billValueBold,
          discount && styles.billDiscount,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Reference images are stored as either absolute (ImageKit) URLs or as
 * server-relative paths (e.g. "/static/..."). Resolve relative ones against the
 * API host so they load. */
function resolveReferenceImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Reference style images the customer attached at order time. */
function ReferenceImagesSection({ urls }: { urls: string[] }) {
  const [viewer, setViewer] = useState<string | null>(null);
  if (urls.length === 0) return null;
  return (
    <OrderScreenSection title="Reference images">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {urls.map((raw, i) => {
          const uri = resolveReferenceImageUrl(raw);
          return (
            <TouchableOpacity key={`${uri}-${i}`} onPress={() => setViewer(uri)} activeOpacity={0.85}>
              <Image
                source={{ uri }}
                style={styles.referenceThumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Fullscreen viewer */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setViewer(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {viewer ? (
            <Image source={{ uri: viewer }} style={styles.imageViewerImg} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
    </OrderScreenSection>
  );
}

function DetailsStatusHero({
  payload,
}: {
  payload: CustomerOrderDetailsPayload;
}) {
  const status = payload.order.status ?? "";
  const tone = getCustomerOrderStatusTone(status);
  const iconStyle = STATUS_ICON_STYLES[tone];
  const statusBadge =
    payload.order.customer_status ?? formatCustomerOrderStatusLabel(status);
  const headline = getDetailsStatusHeadline(payload);
  const narrative = getOrderStatusNarrative(status);
  const orderCode = detailsText(payload.order.order_code);
  const urgency = detailsText(payload.order.urgency_level);

  return (
    <View
      style={[styles.heroCard, cardShadow]}
      accessible
      accessibilityLabel={`${headline}. Status: ${statusBadge}. Order ${orderCode}.`}
    >
      <View style={styles.heroTop}>
        <View style={[styles.iconBox, { backgroundColor: iconStyle.bg }]}>
          <Ionicons
            name={iconStyle.iconName}
            size={22}
            color={iconStyle.icon}
          />
        </View>
        <View style={styles.heroText}>
          {/* Status badge pill removed on request - the headline below already
              names the status (e.g. "Pickup Scheduled"), so the pill duplicated
              it. Only a meaningful Express/Urgent flag shows here now; the
              "Standard" urgency label stays hidden (Bug Report cycle 1, item 7.1). */}
          {urgency !== DETAILS_NA && urgency.trim().toLowerCase() !== "standard" ? (
            <View style={styles.badgeRow}>
              <View style={styles.urgencyBadge}>
                <Text style={styles.urgencyText}>{urgency}</Text>
              </View>
            </View>
          ) : null}
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.narrativeDetail}>{narrative.detail}</Text>
          {narrative.nextStep ? (
            <View style={styles.narrativeNextWrap}>
              <Ionicons name="arrow-forward-circle-outline" size={12} color="#0c6c75" />
              <Text style={styles.narrativeNextText}>{narrative.nextStep}</Text>
            </View>
          ) : null}
          <Text style={styles.metaLine}>
            <Text style={styles.metaKey}>Order ID: </Text>
            {orderCode}
          </Text>
        </View>
      </View>
    </View>
  );
}

type StatusCardConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bg: string;
  border: string;
  message: string;
};

function StatusContextCard({
  payload,
}: {
  payload: CustomerOrderDetailsPayload;
}) {
  const status = normalizeOrderStatus(payload.order.status);
  const pickupType = (payload.order.pickup_type ?? "instant").toLowerCase();

  const configs: Partial<Record<OrderStatus, StatusCardConfig>> = {
    order_accepted: {
      icon: "checkmark-circle",
      iconColor: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      message: "Your order is confirmed! We're finding the right tailor and arranging pickup.",
    },
    searching_tailor: {
      icon: "search-circle",
      iconColor: "#0D9488",
      bg: "#F0FDFA",
      border: "#99F6E4",
      message:
        "We're finding the perfect tailor for your order. This usually takes just a few minutes.",
    },
    broadcasted: {
      icon: "radio",
      iconColor: "#0891B2",
      bg: "#ECFEFF",
      border: "#A5F3FC",
      message:
        "We've reached out to tailors near you. A tailor will be assigned shortly.",
    },
    tailor_assigned: {
      icon: "cut",
      iconColor: "#EC4899",
      bg: "#FDF2F8",
      border: "#FBCFE8",
      message:
        "A skilled tailor has been assigned and is getting ready to start stitching your garment.",
    },
    pickup_scheduled: {
      icon: "calendar",
      iconColor: "#F59E0B",
      bg: "#FFFBEB",
      border: "#FDE68A",
      message: "Your pickup has been scheduled. Our team will arrive at the scheduled time.",
    },
    pickup_pending: {
      icon: "bicycle",
      iconColor: "#F59E0B",
      bg: "#FFFBEB",
      border: "#FDE68A",
      message:
        pickupType === "scheduled"
          ? "Our team is on the way to collect your cloth at your scheduled time."
          : "Our team is on the way to pick up your cloth. Please be available at your delivery address.",
    },
    picked_up: {
      icon: "checkmark-done-circle",
      iconColor: "#0D9488",
      bg: "#F0FDFA",
      border: "#99F6E4",
      message:
        "Your cloth has been collected and is on its way to your tailor.",
    },
    cloth_received_by_tailor: {
      icon: "shirt",
      iconColor: "#0D9488",
      bg: "#F0FDFA",
      border: "#99F6E4",
      message: "Your tailor has received the fabric and is preparing to start.",
    },
    stitching_started: {
      icon: "cut",
      iconColor: "#EC4899",
      bg: "#FDF2F8",
      border: "#FBCFE8",
      message: "Your tailor has started working on your garment.",
    },
    in_progress: {
      icon: "cut",
      iconColor: "#EC4899",
      bg: "#FDF2F8",
      border: "#FBCFE8",
      message: "Your garment is being carefully stitched by your tailor.",
    },
    final_check: {
      icon: "search-circle",
      iconColor: "#7C3AED",
      bg: "#F5F3FF",
      border: "#DDD6FE",
      message: "Your garment is undergoing a final quality check.",
    },
    ready_for_dispatch: {
      icon: "ribbon",
      iconColor: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      message:
        "Stitching is complete! Your garment will be out for delivery soon.",
    },
    out_for_delivery: {
      icon: "bicycle",
      iconColor: "#3B82F6",
      bg: "#EFF6FF",
      border: "#BFDBFE",
      message:
        "Your order is out for delivery. Please be available to receive it.",
    },
    delivered: {
      icon: "home",
      iconColor: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      message:
        "Your order has been delivered. We hope you love your new garment!",
    },
    completed: {
      icon: "ribbon",
      iconColor: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      message: "Your order is complete. Thank you for choosing BookMyDarzi!",
    },
    order_rejected: {
      icon: "close-circle",
      iconColor: "#B91C1C",
      bg: "#FEF2F2",
      border: "#FECACA",
      message:
        "Unfortunately your order could not be accepted at this time. Please contact support for assistance.",
    },
    payment_failed: {
      icon: "card",
      iconColor: "#B91C1C",
      bg: "#FEF2F2",
      border: "#FECACA",
      message:
        "Your payment could not be processed. Please try again or use a different payment method.",
    },
    cancelled: {
      icon: "close-circle-outline",
      iconColor: "#6B7280",
      bg: "#F9FAFB",
      border: "#E5E7EB",
      message:
        "This order has been cancelled. If you paid, a refund will be processed as per our cancellation policy.",
    },
  };

  const config = configs[status];
  if (!config) return null;

  const pendingPenalty =
    status === "cancelled" && payload.pendingPenaltyAmount != null && payload.pendingPenaltyAmount > 0
      ? payload.pendingPenaltyAmount
      : null;

  return (
    <>
      <View
        style={[
          statusCardStyles.card,
          { backgroundColor: config.bg, borderColor: config.border },
        ]}
      >
        <Ionicons name={config.icon} size={20} color={config.iconColor} />
        <Text style={[statusCardStyles.text, { color: config.iconColor }]}>
          {config.message}
        </Text>
      </View>
      {pendingPenalty != null ? (
        <View style={statusCardStyles.penaltyCard}>
          <Ionicons name="alert-circle" size={18} color="#B45309" />
          <Text style={statusCardStyles.penaltyText}>
            A ₹{Math.round(pendingPenalty).toLocaleString("en-IN")} cancellation charge will be
            added to your next order.
          </Text>
        </View>
      ) : null}
    </>
  );
}

const statusCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: SPACING.md,
    marginBottom: 12,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  penaltyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    padding: 14,
    marginBottom: 12,
  },
  penaltyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    color: "#92400E",
  },
});

// ─── Accordion Section ────────────────────────────────────────────────────────

function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={accordionStyles.wrap}>
      <TouchableOpacity
        style={accordionStyles.header}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${open ? "Collapse" : "Expand"} ${title}`}
      >
        <Text style={accordionStyles.title}>{title}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color="#9CA3AF"
        />
      </TouchableOpacity>
      {open ? <View style={accordionStyles.body}>{children}</View> : null}
    </View>
  );
}

const accordionStyles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EAED",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F3F4F6",
  },
});

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(width, 560);

  const orderId = parsePositiveId(
    useLocalSearchParams<{ orderId?: string }>().orderId,
  );

  const user = useAuthStore((s) => s.user);
  const [payload, setPayload] = useState<CustomerOrderDetailsPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "invoice" | "balance" | "cancel">(
    null,
  );

  // Rating state
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [existingComment, setExistingComment] = useState<string | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [existingRating, setExistingRating] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);
  // True while the submission form is shown for an order that already has a
  // rating - either mid-edit (tapped "Edit") or right after a first-time
  // submit before alreadyRated flips true. PATCH has no time limit (matches
  // the website's RatingCard), unlike the old behavior where a rating was
  // permanent the instant it was submitted.
  const [editingRating, setEditingRating] = useState(false);
  // Order tracking is collapsed by default; the "Track Order" button in the
  // first (hero) section expands it (Bug Report cycle 1, item 6.2).
  const [trackingExpanded, setTrackingExpanded] = useState(false);

  // Progress photos - null means "not loaded yet", so the section can stay
  // hidden until we actually know there's nothing to show, instead of
  // flashing an empty "No progress photos yet" card on every delivered/
  // completed order (most orders never get any tailor progress photos).
  const [hasProgressPhotos, setHasProgressPhotos] = useState<boolean | null>(null);

  const [celebration, setCelebration] = useState<{
    kind: OrderCelebrationKind;
    orderCode: string;
  } | null>(null);

  const showStatusPopup = React.useCallback(
    (status: string, orderCode: string | null) => {
      const code = orderCode ?? `#${orderId}`;
      if (status === "order_accepted" || status === "delivered" || status === "completed") {
        setCelebration({ kind: status, orderCode: code });
      }
    },
    [orderId],
  );

  const loadRequestRef = React.useRef(0);

  const load = useCallback(async () => {
    if (orderId === null) {
      setError("Invalid order reference.");
      setLoading(false);
      return;
    }
    const requestId = ++loadRequestRef.current;
    setError(null);
    setLoading(true);
    try {
      const data = await fetchCustomerOrderDetails(orderId);
      // Overlapping calls can land out of order (focus refetch + WS push);
      // only the most recently *issued* request is allowed to apply its result.
      if (requestId !== loadRequestRef.current) return;
      setPayload(data);
      const normalizedStatus = normalizeOrderStatus(data.order.status);
      // Fetch existing rating once the order is rateable - matches the
      // backend's own _RATEABLE_STATUSES (customer_orders.py): "delivered"
      // is the normal resting state after delivery, "completed" is a
      // currently-unused-but-valid terminal stage after that. This
      // previously only checked "completed", which is not the status real
      // orders actually reach - meaning the "already rated"/edit check
      // silently never ran for the vast majority of delivered orders, and
      // a customer who'd already rated would hit the submission form again
      // (then a confusing 409 on submit) instead of seeing their rating.
      if (normalizedStatus === "delivered" || normalizedStatus === "completed") {
        try {
          const ratingInfo = await fetchOrderRating(orderId);
          if (ratingInfo.already_rated) {
            setAlreadyRated(true);
            setExistingRating(ratingInfo.rating);
            setExistingComment(ratingInfo.comment);
            setRatingValue(ratingInfo.rating);
            setRatingComment(ratingInfo.comment ?? "");
          }
        } catch {
          // non-critical
        }
      }
      // Show a one-time popup per order+status combination (module-level cache persists across remounts)
      const cacheKey = `${orderId}:${normalizedStatus}`;
      if (
        (normalizedStatus === "order_accepted" ||
          normalizedStatus === "delivered" ||
          normalizedStatus === "completed") &&
        !_shownPopups.has(cacheKey)
      ) {
        _shownPopups.add(cacheKey);
        setTimeout(() => showStatusPopup(normalizedStatus, data.order.order_code), 400);
      }
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setPayload(null);
      setError(
        err instanceof Error ? err.message : "Could not load booking details.",
      );
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [orderId, showStatusPopup]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Re-fetch when the backend pushes an ORDER_STATUS_UPDATED event for this order
  React.useEffect(() => {
    if (orderId === null) return;
    return wsService.on("ORDER_STATUS_UPDATED", (data) => {
      const updatedId = data.order_id ?? data.orderId ?? data.id;
      // null/undefined updatedId means "all orders updated" - refresh anyway
      if (updatedId == null || Number(updatedId) === orderId) {
        load();
      }
    });
  }, [orderId, load]);

  // Every real order-lifecycle notification (tailor assigned, pickup,
  // stitching, dispatch, delivered, cancelled, refunds, COD) fires
  // "NOTIFICATION" with data.type "order_update" and data.data.order_id -
  // NOT "ORDER_STATUS_UPDATED" above, which only fires from the admin
  // manual-status-edit tool. Without this, a customer with this screen open
  // during a real lifecycle change never saw it update live.
  React.useEffect(() => {
    if (orderId === null) return;
    return wsService.on("NOTIFICATION", (data) => {
      const payload = (data as { type?: string; data?: { order_id?: number | string } }) ?? {};
      if (payload.type !== "order_update") return;
      const updatedId = payload.data?.order_id;
      if (updatedId == null || Number(updatedId) === orderId) {
        load();
      }
    });
  }, [orderId, load]);

  // Normalize "Advance Paid" / "advance_paid" / "balance pending" → "advancepaid" etc.
  const paymentStatus = (payload?.payment.payment_status ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const remainingAmount = Number(payload?.pricing?.remaining_amount ?? 0);
  const orderStatusKey = (payload?.order.status ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const isCodOrder = payload?.payment.payment_method?.toLowerCase() === "cod";
  // Mirrors the backend's _BALANCE_BLOCKED_ORDER_STATES (payment_service.py) -
  // once an order is delivered/cancelled/payment-failed there's no "pay now"
  // window left, matching what create_balance_payment will actually allow.
  const codPayNowBlockedStatuses = new Set([
    "cancelled",
    "delivered",
    "pending_payment",
    "payment_failed",
  ]);
  const isCodPayNowEligible =
    isCodOrder &&
    remainingAmount > 0 &&
    !codPayNowBlockedStatuses.has(orderStatusKey);
  // Online orders always collect the full amount in one charge (see
  // compute_billing in billing_breakdown.py) - there is no advance/remaining
  // split for them anymore, so "balance due" can only ever apply to COD,
  // where the full amount is genuinely collected later, on delivery.
  const isBalanceDue = isCodPayNowEligible;
  // Whether the relocated Pay Now button (now inside Price breakdown, item 6.1)
  // should render - same gate the old COD section's button used.
  const onPayBalanceEligible = isBalanceDue;

  // Payment method + status, folded into the Price breakdown so the standalone
  // Cash-on-Delivery card (which duplicated method + amount) could be removed.
  const paymentMethodLabel = isCodOrder
    ? "Cash on Delivery"
    : payload?.payment.payment_method?.toLowerCase() === "online"
      ? "Online"
      : null;
  const onlineFailed = !isCodOrder && ["paymentfailed", "advancefailed", "failed"].includes(paymentStatus);
  const onlinePending = !isCodOrder && ["paymentpending", "advancepending", "pending", "initiated"].includes(paymentStatus);
  const onlinePaid = !isCodOrder && ["fullypaid", "paid", "success"].includes(paymentStatus);
  // Show a Pay/Retry button for an online order that isn't settled yet.
  const showOnlinePayBtn = (onlineFailed || onlinePending) && !!payload;

  // Backend issues invoices only once the order is placed - not while it is
  // pending payment, payment-failed, or cancelled.
  const invoiceAvailable = !!payload && orderStatusKey === "delivered";

  const handleDownloadInvoice = async () => {
    if (orderId === null || busy) return;
    setBusy("invoice");
    try {
      await downloadAndShareInvoice(orderId, payload?.order.order_code ?? null);
    } catch (err) {
      Alert.alert(
        "Invoice",
        err instanceof Error ? err.message : "Could not download the invoice.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handlePayNow = () => {
    if (orderId === null || busy) return;
    // Online orders collect the full amount in one charge - advance_amount
    // equals the full order total here (see compute_billing in
    // billing_breakdown.py), so this is simply "pay the order total now."
    const amountRupees = Number(
      payload?.pricing?.advance_amount ??
        payload?.payment.amount ??
        payload?.pricing.final_amount ??
        0,
    );
    router.push({
      pathname: "/payment" as never,
      params: {
        orderId: String(orderId),
        amount: String(amountRupees),
        customerName: user?.name ?? "",
        email: user?.email ?? "",
        phone: user?.phone_number ?? "",
      },
    });
  };

  const handlePayBalance = async () => {
    if (orderId === null || busy) return;
    setBusy("balance");
    try {
      const { session } = await resolveBalancePaymentSessionForOrder(orderId);
      const result = await openRazorpayCheckout({
        key: session.razorpay_key,
        amount: session.amount,
        currency: session.currency,
        order_id: session.razorpay_order_id,
        description: "Remaining balance payment",
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone_number,
        },
      });
      await confirmRazorpayPayment(session.payment_id, orderId, result);
      useCustomerOrdersStore.getState().invalidateCache();
      Alert.alert(
        "Payment successful",
        "Your remaining balance has been paid.",
      );
      await load();
    } catch (err) {
      if (err instanceof PaymentCancelledError) {
        setBusy(null);
        return;
      }
      if (err instanceof PaymentAlreadyCompletedError) {
        Alert.alert("Already paid", "This order is already fully paid.");
        await load();
        setBusy(null);
        return;
      }
      Alert.alert(
        "Payment failed",
        err instanceof Error
          ? err.message
          : "Could not complete the payment. If any amount was deducted, it will be refunded automatically - we never double-charge you. Please try again in a moment.",
      );
    } finally {
      setBusy(null);
    }
  };

  const orderStatusRaw = payload?.order.status ?? "";
  // Client-side cancellability check for gating the CancelOrderSection's
  // render - the section itself independently verifies via the
  // cancellation-preview endpoint before allowing an actual cancel, so this
  // is a display-only guard using the shared status source of truth (mirrors
  // backend's OrderStatus.CANCELLABLE_BY_CUSTOMER), not the last word.
  const canCancelOrder = CUSTOMER_CANCELLABLE_STATUSES.has(
    normalizeOrderStatus(orderStatusRaw),
  );
  // Bug fix: this used to be its own hand-maintained RESCHEDULABLE_STATUSES
  // set, kept in sync with the backend's RESCHEDULABLE_FROM only by
  // developer discipline - no shared source of truth, and the two could
  // drift. The backend now exposes can_reschedule directly on this same
  // /customer/orders/{id}/details response (mirroring the can_report_issue
  // pattern already used elsewhere), so read that instead. The reschedule
  // endpoint still independently re-validates server-side either way - this
  // is a display gate, not the last word.
  const canRescheduleOrder = payload?.order.can_reschedule ?? false;

  const handleSubmitRating = async () => {
    if (orderId === null || ratingValue < 1 || ratingBusy) return;
    if (alreadyRated && !editingRating) return;
    setRatingBusy(true);
    try {
      await submitOrderRating(
        orderId,
        ratingValue,
        ratingComment.trim() || undefined,
        alreadyRated, // PATCH when editing an existing rating, POST otherwise
      );
      setAlreadyRated(true);
      setExistingRating(ratingValue);
      setExistingComment(ratingComment.trim() || null);
      setEditingRating(false);
      Alert.alert("Thank you!", "Your rating has been submitted.");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not submit rating.",
      );
    } finally {
      setRatingBusy(false);
    }
  };

  const startEditRating = () => {
    setRatingValue(existingRating);
    setRatingComment(existingComment ?? "");
    setEditingRating(true);
  };

  const isDelivered =
    (payload?.order.status ?? "").toLowerCase() === "delivered";

  // pricing.base_amount already has any selected add-ons folded into it
  // (backend: unit_price = base + addons) - shown alone as one "Base
  // amount" row it didn't reconcile with the per-item add-on tags shown
  // higher up on this same screen. Split it back out purely for display so
  // the two sections agree instead of looking like conflicting numbers.
  const addonsTotal =
    payload?.line_items.reduce(
      (sum, item) =>
        sum +
        (item.addons ?? []).reduce((s, a) => s + a.price * item.quantity, 0),
      0,
    ) ?? 0;
  const serviceSubtotal = (Number(payload?.pricing.base_amount) || 0) - addonsTotal;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Booking details" />

      {loading ? (
        <OrderDetailsSkeleton />
      ) : error ? (
        <View style={styles.center}>
          <ErrorState message={error} onRetry={load} />
        </View>
      ) : payload ? (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: insets.bottom + SPACING.xl,
              maxWidth: contentMaxWidth,
              alignSelf: "center",
              width: "100%",
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <DetailsStatusHero payload={payload} />

          {/* Track Order toggle in the first section - expands the (collapsed
              by default) Order tracking section below (Bug Report cycle 1,
              item 6.2). */}
          <TouchableOpacity
            style={styles.trackOrderBtn}
            onPress={() => setTrackingExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={trackingExpanded ? "Hide order tracking" : "Track order"}
          >
            <Ionicons name="navigate-outline" size={16} color={COLORS.primaryDark} />
            <Text style={styles.trackOrderBtnText}>
              {trackingExpanded ? "Hide tracking" : "Track Order"}
            </Text>
            <Ionicons
              name={trackingExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={COLORS.primaryDark}
            />
          </TouchableOpacity>

          {/* Order tracking renders directly below the Track Order button when
              expanded (collapsed by default, item 6.2). */}
          {trackingExpanded ? (
            <OrderScreenSection title="Order tracking">
              {orderId !== null ? <OrderTimeline orderId={orderId} /> : null}
            </OrderScreenSection>
          ) : null}

          {/* The standalone Cash-on-Delivery / payment card was removed - it
              duplicated the payment method and order amount that now live in
              the Price breakdown section below (payment method row + Pay Now). */}

          {/* Who's coming to the door for pickup - doorstep trust/safety.
              Only present once the backend has an assigned employee AND the
              order has reached a pickup-relevant status (never earlier). */}
          {payload.order.pickup_partner ? (
            <BridgePartnerCard
              title="Your pickup partner"
              subtitle="Coming to your doorstep for pickup"
              partner={payload.order.pickup_partner}
            />
          ) : null}

          {/* Delivery-leg equivalent - a different employee may deliver
              than picked up (delivery broadcast), so this is deliberately
              a separate card, not a reuse of the pickup partner's data. */}
          {payload.order.delivery_partner ? (
            <BridgePartnerCard
              title="Your delivery partner"
              subtitle="Bringing your order to your doorstep"
              partner={payload.order.delivery_partner}
            />
          ) : null}

          {/* Return-leg equivalent - who's bringing the garment back after
              a cancellation past custody. Same doorstep trust/safety
              reasoning as pickup/delivery. */}
          {payload.order.return_partner ? (
            <BridgePartnerCard
              title="Your return partner"
              subtitle="Bringing your garment back to your doorstep"
              partner={payload.order.return_partner}
            />
          ) : null}

          {/* Reference style images the customer attached at order time. */}
          {payload.order.image_references && payload.order.image_references.length > 0 ? (
            <ReferenceImagesSection urls={payload.order.image_references} />
          ) : null}

          {/* StatusContextCard (the yellow "Your pickup has been scheduled…"
              info banner) removed on request - the hero above already shows
              the current status, so this second status message was redundant. */}

          {/* Instant/Scheduled Pickup section removed from Booking Details
              (Bug Report cycle 1, item 13.1). */}

          {/* (Order tracking now renders directly below the Track Order button
              above, per user request.) */}

          {/* Progress photos - shown once cloth has reached the tailor AND
              the tailor has actually uploaded at least one photo. Most
              orders never get any, so keeping the section around with a
              permanent "No progress photos yet" empty state on every
              delivered/completed order just adds a dead-looking card;
              render it only once we know there's something to show. */}
          {orderId !== null &&
          PHOTO_VISIBLE_STAGES.has(normalizeOrderStatus(payload.order.status)) &&
          hasProgressPhotos !== false ? (
            <OrderScreenSection title="Your garment in progress">
              <ProgressGallery
                orderId={orderId}
                onLoaded={(photos) => setHasProgressPhotos(photos.length > 0)}
              />
            </OrderScreenSection>
          ) : null}

          {/* Secondary sections - collapsed by default */}
          {/* Multi-service cart orders (e.g. one Men's Shirt + one Kids
              Clothing + one Alteration in the same booking) each get their
              own card - line_items always has at least one entry. */}
          {(payload.line_items.length > 0
            ? payload.line_items
            : [
                {
                  order_item_id: null,
                  person_name: null,
                  service_id: null,
                  service_name: payload.service.service_name,
                  category_name: payload.service.category_name,
                  quantity: 1,
                  unit_price: payload.service.base_price,
                  line_total: null,
                  measurement: null,
                  addons: [],
                },
              ]
          ).map((item, idx, arr) => (
            <AccordionSection
              key={item.order_item_id ?? idx}
              defaultOpen={idx === 0}
              title={
                arr.length > 1
                  ? `Service ${idx + 1} of ${arr.length}`
                  : "Service details"
              }
            >
              <View style={styles.serviceHeaderRow}>
                {normalizeServiceImageUrl(item.image_url) ? (
                  <Image
                    source={{ uri: normalizeServiceImageUrl(item.image_url)! }}
                    style={styles.serviceThumb}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                ) : (
                  <View style={styles.serviceThumbFallback}>
                    <Ionicons name="cut-outline" size={20} color={COLORS.primaryDark} />
                  </View>
                )}
                <View style={styles.serviceHeaderText}>
                  <Text style={styles.serviceTitle}>
                    {detailsText(item.service_name)}
                  </Text>
                  {item.category_name ? (
                    <Text style={styles.serviceSubtitle}>
                      {detailsText(item.category_name)}
                    </Text>
                  ) : null}
                </View>
              </View>
              {/* Only show "For" when it's a named family member, not the
                  default "Self"/"Me" (booking for yourself needs no label). */}
              {item.person_name &&
              !["self", "me"].includes(item.person_name.trim().toLowerCase()) ? (
                <>
                  <InfoRow label="For" value={detailsText(item.person_name)} />
                  <RowDivider />
                </>
              ) : null}
              <InfoRow
                label="Service Price"
                // item.unit_price is base + this item's own addons combined
                // (backend: unit_price = base + selected addons) - showing
                // it raw here read as "Base price ₹228" with the addon rows
                // below implying they were additional, when they were
                // already folded in. Subtract this item's own addon total so
                // "Base price" here actually means base-only, consistent
                // with the "Service subtotal" row in the breakdown below.
                value={detailsMoney(
                  (Number(item.unit_price) || 0) -
                    (item.addons ?? []).reduce((s, a) => s + a.price, 0),
                )}
              />
              {item.addons.map((addon, ai) => (
                <React.Fragment key={addon.addon_id ?? ai}>
                  <RowDivider />
                  <AddonRow
                    name={detailsText(addon.name)}
                    price={detailsMoney(addon.price)}
                    note={addon.note}
                  />
                </React.Fragment>
              ))}
              {item.quantity > 1 ? (
                <>
                  <RowDivider />
                  <InfoRow label="Quantity" value={String(item.quantity)} />
                </>
              ) : null}
              {idx === 0 && payload.order.pickup_type ? (
                <>
                  <RowDivider />
                  <InfoRow
                    label="Pickup preference"
                    value={
                      payload.order.pickup_type.toLowerCase() === "scheduled"
                        ? "Scheduled pickup"
                        : "Instant pickup"
                    }
                  />
                  {payload.order.pickup_time_slot ? (
                    <>
                      <RowDivider />
                      <InfoRow
                        label="Pickup slot"
                        value={payload.order.pickup_time_slot}
                      />
                    </>
                  ) : null}
                  {payload.order.scheduled_pickup_at ? (
                    <>
                      <RowDivider />
                      <InfoRow
                        label="Scheduled for"
                        value={new Date(
                          payload.order.scheduled_pickup_at,
                        ).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              {item.measurement ? (
                <>
                  <RowDivider />
                  <InfoRow
                    label="Profile"
                    value={detailsText(item.measurement.profile_name)}
                  />
                  <RowDivider />
                  <InfoRow
                    label="Gender"
                    value={detailsText(item.measurement.gender)}
                  />
                  <RowDivider />
                  <InfoRow label="Fit" value={detailsText(item.measurement.fit)} />
                  <RowDivider />
                  <InfoRow
                    label="Chest"
                    value={detailsMeasurement(item.measurement.chest)}
                  />
                  <RowDivider />
                  <InfoRow
                    label="Waist"
                    value={detailsMeasurement(item.measurement.waist)}
                  />
                  {item.measurement.hips != null ? (
                    <>
                      <RowDivider />
                      <InfoRow
                        label="Hips"
                        value={detailsMeasurement(item.measurement.hips)}
                      />
                    </>
                  ) : null}
                  {item.measurement.shoulder != null ? (
                    <>
                      <RowDivider />
                      <InfoRow
                        label="Shoulder"
                        value={detailsMeasurement(item.measurement.shoulder)}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              {item.stitching_preferences &&
              (item.stitching_preferences.design_style ||
                item.stitching_preferences.embellishment_level ||
                item.stitching_preferences.design_notes) ? (
                <>
                  <RowDivider />
                  <View style={styles.designBriefBadgeRow}>
                    <Ionicons name="diamond-outline" size={13} color="#C9A84C" />
                    <Text style={styles.designBriefBadgeText}>Your Design Brief</Text>
                  </View>
                  {item.stitching_preferences.design_style ? (
                    <>
                      <RowDivider />
                      <InfoRow
                        label="Design style"
                        value={
                          item.stitching_preferences.design_style.charAt(0).toUpperCase() +
                          item.stitching_preferences.design_style.slice(1)
                        }
                      />
                    </>
                  ) : null}
                  {item.stitching_preferences.embellishment_level ? (
                    <>
                      <RowDivider />
                      <InfoRow
                        label="Embellishment"
                        value={
                          item.stitching_preferences.embellishment_level.charAt(0).toUpperCase() +
                          item.stitching_preferences.embellishment_level.slice(1)
                        }
                      />
                    </>
                  ) : null}
                  {item.stitching_preferences.design_notes ? (
                    <>
                      <RowDivider />
                      <InfoRow
                        label="Your notes"
                        value={item.stitching_preferences.design_notes}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              {item.notes ? (
                <>
                  <RowDivider />
                  <InfoRow label="Note for this item" value={item.notes} />
                </>
              ) : null}
            </AccordionSection>
          ))}

          <AccordionSection title="Price breakdown" defaultOpen>
            {addonsTotal > 0 ? (
              <>
                <BillRow
                  label="Service subtotal"
                  value={detailsMoney(serviceSubtotal)}
                />
                <RowDivider />
                <BillRow label="Add-ons" value={detailsMoney(addonsTotal)} />
                <RowDivider />
                {/* pricing.base_amount is Service subtotal + Add-ons combined
                    (order-wide, same "base + addons" semantics as
                    item.unit_price above) - "Order subtotal" here instead of
                    "Base amount" so it doesn't read as yet another base-only
                    figure right below two rows that already are. */}
                <BillRow
                  label="Order subtotal"
                  value={detailsMoney(payload.pricing.base_amount)}
                />
              </>
            ) : (
              <BillRow
                label="Base amount"
                value={detailsMoney(payload.pricing.base_amount)}
              />
            )}
            {Number(payload.pricing.discount_amount) > 0 ? (
              <>
                <RowDivider />
                <BillRow
                  label="Discount"
                  value={`− ${detailsMoney(payload.pricing.discount_amount)}`}
                  discount
                />
              </>
            ) : null}
            {payload.pricing.cgst_amount != null &&
            payload.pricing.sgst_amount != null ? (
              <>
                <RowDivider />
                <BillRow
                  label="CGST (2.5%)"
                  value={detailsMoney(payload.pricing.cgst_amount)}
                />
                <RowDivider />
                <BillRow
                  label="SGST (2.5%)"
                  value={detailsMoney(payload.pricing.sgst_amount)}
                />
              </>
            ) : (
              <>
                <RowDivider />
                <BillRow
                  label="GST (5%)"
                  value={detailsMoney(payload.pricing.gst_amount)}
                />
              </>
            )}
            {payload.pricing.service_fee != null &&
            Number(payload.pricing.service_fee) > 0 ? (
              <>
                <RowDivider />
                <BillRow
                  label="Platform fee"
                  value={detailsMoney(payload.pricing.service_fee)}
                />
              </>
            ) : null}
            {payload.pricing.penalty_amount != null &&
            Number(payload.pricing.penalty_amount) > 0 ? (
              <>
                <RowDivider />
                <BillRow
                  label="Cancellation charges"
                  value={detailsMoney(payload.pricing.penalty_amount)}
                />
              </>
            ) : null}
            <RowDivider />
            <BillRow
              label="Total"
              value={detailsMoney(payload.pricing.final_amount)}
              bold
            />

            {/* Payment method + status folded in here (no separate payment card).
                For COD the total IS what's due on delivery, so we don't repeat
                it as a second "Amount due" row - the method line says it. */}
            {paymentMethodLabel ? (
              <>
                <RowDivider />
                <View style={styles.payMethodRow}>
                  <View style={styles.payMethodLeft}>
                    <Ionicons
                      name={isCodOrder ? "cash-outline" : "card-outline"}
                      size={15}
                      color={COLORS.primaryDark}
                    />
                    <Text style={styles.payMethodLabel}>Payment method</Text>
                  </View>
                  <View style={styles.payMethodRight}>
                    <Text style={styles.payMethodValue}>{paymentMethodLabel}</Text>
                    {/* No "Pay on delivery" hint for COD - the value already
                        says "Cash on Delivery", so repeating it is redundant.
                        Only show a meaningful online payment status here. */}
                    {onlinePaid ? (
                      <Text style={[styles.payMethodHint, { color: COLORS.success }]}>Paid</Text>
                    ) : onlineFailed ? (
                      <Text style={[styles.payMethodHint, { color: COLORS.error }]}>Payment failed</Text>
                    ) : onlinePending ? (
                      <Text style={styles.payMethodHint}>Payment pending</Text>
                    ) : null}
                  </View>
                </View>
              </>
            ) : null}

            {/* Single Pay Now: COD balance (pay early) or online retry/resume. */}
            {onPayBalanceEligible || showOnlinePayBtn ? (
              <TouchableOpacity
                style={[styles.breakdownPayBtn, busy !== null && styles.actionDisabled]}
                onPress={onPayBalanceEligible ? handlePayBalance : handlePayNow}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={onlineFailed ? "Retry payment" : "Pay now"}
              >
                {busy === "balance" ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={16} color="#fff" />
                    <Text style={styles.breakdownPayBtnText}>
                      {onlineFailed ? "Retry Payment" : "Pay Now"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </AccordionSection>

          {payload.order.customization_notes ? (
            <AccordionSection title="Order notes">
              <Text style={styles.orderNotesText}>{payload.order.customization_notes}</Text>
            </AccordionSection>
          ) : null}

          <AccordionSection title="Delivery address">
            <InfoRow
              label="Name"
              value={detailsText(payload.delivery_address.name)}
            />
            <RowDivider />
            <InfoRow
              label="Mobile"
              value={detailsText(payload.delivery_address.mobile)}
            />
            <RowDivider />
            {/* Full address as a single row - the address line and its
                city/state/pincode are one address, not two separate things
                (they previously showed as "Address" + "Location" rows). */}
            <InfoRow
              label="Address"
              value={
                [
                  payload.delivery_address.address_line_1,
                  payload.delivery_address.city,
                  payload.delivery_address.state,
                  payload.delivery_address.pincode,
                ]
                  .filter(Boolean)
                  .join(", ") || detailsText(payload.delivery_address.address_line_1)
              }
            />
          </AccordionSection>

          {isDelivered ? (
            <OrderScreenSection title="Rate your experience">
              {alreadyRated && !editingRating ? (
                <View>
                  <View style={ratingStyles.doneWrap}>
                    <Ionicons name="star" size={22} color="#F59E0B" />
                    <Text style={ratingStyles.doneText}>
                      You rated this order {existingRating} star
                      {existingRating !== 1 ? "s" : ""}. Thank you!
                    </Text>
                  </View>
                  {existingComment ? (
                    <Text style={ratingStyles.doneComment}>
                      &ldquo;{existingComment}&rdquo;
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={startEditRating}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Edit your rating"
                  >
                    <Text style={ratingStyles.editLink}>Edit rating</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={ratingStyles.prompt}>
                    How was your experience?
                  </Text>
                  <View style={ratingStyles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setRatingValue(star)}
                        hitSlop={8}
                        accessibilityLabel={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                      >
                        <Ionicons
                          name={star <= ratingValue ? "star" : "star-outline"}
                          size={32}
                          color={star <= ratingValue ? "#F59E0B" : "#D1D5DB"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  {ratingValue > 0 ? (
                    <TextInput
                      style={ratingStyles.commentInput}
                      placeholder="Add a comment (optional)"
                      placeholderTextColor="#9CA3AF"
                      value={ratingComment}
                      onChangeText={setRatingComment}
                      multiline
                      maxLength={500}
                      numberOfLines={3}
                    />
                  ) : null}
                  <TouchableOpacity
                    style={[
                      ratingStyles.submitBtn,
                      (ratingValue < 1 || ratingBusy) &&
                        ratingStyles.submitDisabled,
                    ]}
                    onPress={handleSubmitRating}
                    disabled={ratingValue < 1 || ratingBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Submit rating"
                  >
                    {ratingBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={ratingStyles.submitText}>
                        {editingRating ? "Save changes" : "Submit rating"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </OrderScreenSection>
          ) : null}

          <OrderScreenSection title="Actions">
            <TouchableOpacity
              style={[
                styles.actionSecondary,
                busy !== null && styles.actionDisabled,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/chat" as never,
                  params: { orderId: String(orderId) },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Quick chat about this order"
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={COLORS.primaryDark}
              />
              <Text style={styles.actionSecondaryText}>Quick chat</Text>
            </TouchableOpacity>

            {invoiceAvailable ? (
              <TouchableOpacity
                style={[
                  styles.actionSecondary,
                  busy !== null && styles.actionDisabled,
                ]}
                onPress={handleDownloadInvoice}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="Download invoice"
              >
                {busy === "invoice" ? (
                  <ActivityIndicator size="small" color={COLORS.primaryDark} />
                ) : (
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color={COLORS.primaryDark}
                  />
                )}
                <Text style={styles.actionSecondaryText}>Download invoice</Text>
              </TouchableOpacity>
            ) : null}

            {/* "Report an issue" removed (Bug Report cycle 1, item 8.1);
                Quick chat is the single support entry point now. */}

            {orderId !== null && canRescheduleOrder && (
              <RescheduleOrderSection
                orderId={orderId}
                currentPickupAt={payload?.order.scheduled_pickup_at ?? null}
                onRescheduled={() => {
                  useCustomerOrdersStore.getState().invalidateCache();
                  load();
                }}
              />
            )}

            {orderId !== null && canCancelOrder && (
              <CancelOrderSection
                orderId={orderId}
                orderStatus={orderStatusRaw}
                onCancelled={() => {
                  useCustomerOrdersStore.getState().invalidateCache();
                  load();
                }}
                onContactSupport={() => {
                  router.push({ pathname: "/support-chat", params: { orderId: String(orderId) } } as never);
                }}
              />
            )}
          </OrderScreenSection>
        </ScrollView>
      ) : null}

      <OrderStatusModal
        visible={celebration !== null}
        kind={celebration?.kind ?? null}
        orderCode={celebration?.orderCode ?? ""}
        onDismiss={() => setCelebration(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FA" },
  orderNotesText: {
    fontSize: 13.5,
    color: "#374151",
    lineHeight: 20,
  },
  // Single source of truth for vertical rhythm between sections - each section
  // no longer sets its own marginBottom, so the spacing is uniform everywhere.
  scroll: { padding: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.md },
  referenceThumb: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: "#EEF1F1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E1E5E5",
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageViewerClose: {
    position: "absolute",
    top: 48,
    right: 20,
    zIndex: 2,
    padding: 6,
  },
  imageViewerImg: { width: "100%", height: "80%" },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EAED",
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, minWidth: 0 },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  urgencyBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#F3F4F6",
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "capitalize",
  },
  headline: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 22,
    marginBottom: 6,
  },
  narrativeDetail: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 19,
    marginBottom: 8,
    marginTop: 2,
  },
  narrativeNextWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    backgroundColor: "#E6F7F7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  narrativeNextText: {
    flex: 1,
    fontSize: 12,
    color: "#0c6c75",
    lineHeight: 17,
    fontWeight: "500",
  },
  metaLine: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  metaKey: { fontWeight: "600", color: "#9CA3AF" },
  payStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginHorizontal: 14,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountLabel: { fontSize: 13, color: "#6B7280" },
  amountValue: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  serviceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: 10,
  },
  serviceThumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: "#F3F4F6",
    flexShrink: 0,
  },
  serviceThumbFallback: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  serviceHeaderText: { flex: 1 },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  serviceSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  designBriefBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 6,
  },
  designBriefBadgeText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#8A6D1F",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 7,
  },
  infoLabel: {
    flex: 0.9,
    fontSize: 13,
    color: "#6B7280",
  },
  infoValue: {
    flex: 1.3,
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "right",
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginVertical: 2,
  },
  addonRow: {
    paddingVertical: 7,
    // Indented under the service's own rows above it (Base price, etc) -
    // reads as "part of this line item" rather than a sibling row at the
    // same visual weight as the service's core price.
    paddingLeft: 6,
  },
  addonRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  addonLabelGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addonBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E6F5F6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addonLabel: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
  },
  addonValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  // Bug fix: the customer's own add-on note (typed on service-details.tsx's
  // "Add extras" checklist, e.g. "Note test" under Hook & Eye Replacement)
  // was captured, saved, and already returned by the backend
  // (SelectedAddonSummary.note) - AddonRow just never rendered it at all.
  addonNote: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 3,
    marginLeft: 26,
  },
  pickupPartnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pickupPartnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  pickupPartnerAvatarFallback: {
    backgroundColor: COLORS.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pickupPartnerInfo: {
    flex: 1,
  },
  pickupPartnerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  pickupPartnerSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  pickupPartnerRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  pickupPartnerRatingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  pickupPartnerCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  billLabel: { fontSize: 13, color: "#6B7280", flex: 1 },
  billLabelBold: { fontWeight: "700", color: "#1F2937", fontSize: 14 },
  billValue: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  billValueBold: { fontSize: 15, fontWeight: "800" },
  billDiscount: { color: "#16A34A" },
  naText: { fontSize: 13, color: "#6B7280" },
  actionPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    marginBottom: SPACING.sm,
    ...SHADOW.card,
  },
  actionPrimaryText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  actionSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingVertical: 13,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  actionSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
  actionDanger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  actionDangerText: { fontSize: 14, fontWeight: "600", color: "#B91C1C" },
  actionDisabled: { opacity: 0.55 },
  trackOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#F0FDFC",
    borderWidth: 1,
    borderColor: "#C7F0EE",
    borderRadius: 12,
    paddingVertical: 12,
  },
  trackOrderBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  payMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  payMethodLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  payMethodLabel: { fontSize: 13.5, color: COLORS.gray, fontWeight: "600" },
  payMethodRight: { alignItems: "flex-end" },
  payMethodValue: { fontSize: 13.5, fontWeight: "700", color: COLORS.black },
  payMethodHint: { fontSize: 11, color: COLORS.gray, marginTop: 1 },
  breakdownPayBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  breakdownPayBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  cancelLockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F9FAFB",
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cancelLockedText: { fontSize: 13, color: "#6B7280", flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
});

const ratingStyles = StyleSheet.create({
  prompt: { fontSize: 14, color: COLORS.gray, marginBottom: 12 },
  starsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
    color: COLORS.black,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
  doneWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  doneText: { fontSize: 14, fontWeight: "600", color: "#92400E", flex: 1 },
  doneComment: {
    fontSize: 13,
    color: COLORS.gray,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 19,
  },
  editLink: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primaryDark,
    marginTop: 10,
    textDecorationLine: "underline",
  },
});
