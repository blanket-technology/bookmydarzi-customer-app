import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "../../../constants/theme";
import type { ApiSpecialOffer } from "../../types/homeApi";
import { formatCurrency } from "../../utils/formatters";
import { CouponCodeInput } from "./CouponCodeInput";

export interface AppliedOffer {
  offerId: number;
  title: string;
  discountType: "flat" | "percentage";
  discountValue: number;
}

function offerToApplied(offer: ApiSpecialOffer): AppliedOffer {
  return {
    offerId: offer.Id,
    title: offer.Title,
    discountType: offer.DiscountType === "flat" ? "flat" : "percentage",
    discountValue: offer.DiscountType === "flat" ? offer.DiscountAmount ?? 0 : offer.DiscountPercent,
  };
}

function OfferRow({
  offer,
  applied,
  onApply,
  onRemove,
}: {
  offer: ApiSpecialOffer;
  applied: boolean;
  onApply: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={s.row}>
      <View style={s.left}>
        <View style={s.badge}>
          <Text style={s.badgeText}>
            {offer.DiscountType === "flat" ? formatCurrency(offer.DiscountAmount) : `${offer.DiscountPercent}%`}
          </Text>
        </View>
        <View style={s.textWrap}>
          <Text style={s.title} numberOfLines={1}>
            {offer.Title}
          </Text>
          {offer.Description ? (
            <Text style={s.desc} numberOfLines={1}>
              {offer.Description}
            </Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={[s.applyBtn, applied && s.applyBtnActive]}
        onPress={applied ? onRemove : onApply}
        activeOpacity={0.8}
        hitSlop={8}
      >
        {applied ? <Ionicons name="checkmark" size={14} color={s.applyTextActive.color} style={{ marginRight: 3 }} /> : null}
        <Text style={[s.applyText, applied && s.applyTextActive]}>{applied ? "Applied" : "Apply"}</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Browsable offers list + manual coupon-code entry, used by Book Now
 * (buy-now-review.tsx), which previously had neither. Owns its own
 * applied-offer state independently of useCartStore, since Book Now
 * bypasses the cart entirely and has no business touching cart-domain
 * state - the caller reads `appliedOffer` back via onChange to fold the
 * discount into its own billing calculation (client-side estimate only;
 * the backend recomputes and validates the real discount server-side
 * either way, same contract as the website's cart).
 *
 * Cart itself (app/(tabs)/cart.tsx) keeps its own pre-existing browse-list
 * wiring to useCartStore's appliedOfferId/setAppliedOffer (read by
 * checkoutNavigation.ts) rather than switching to this component, to avoid
 * touching that already-working, multi-consumer state - it uses
 * CouponCodeInput directly instead for the manual-entry box this file
 * shares with it.
 */
export function CouponSection({
  offers,
  appliedOffer,
  onChange,
}: {
  offers: ApiSpecialOffer[];
  appliedOffer: AppliedOffer | null;
  onChange: (offer: AppliedOffer | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const validOffers = useMemo(() => {
    const now = Date.now();
    return offers.filter(
      (o) =>
        (o.DiscountType === "flat" ? (o.DiscountAmount ?? 0) > 0 : o.DiscountPercent > 0) &&
        (!o.ValidFrom || new Date(o.ValidFrom).getTime() <= now) &&
        (!o.ValidUntil || new Date(o.ValidUntil).getTime() > now),
    );
  }, [offers]);

  const visible = expanded ? validOffers : validOffers.slice(0, 2);

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Ionicons name="pricetag-outline" size={13} color={COLORS.primaryDark} />
        <Text style={s.sectionTitle}>Available Offers</Text>
      </View>

      {validOffers.length === 0 ? (
        <Text style={s.emptyText}>No offers available right now — got a code? Enter it below.</Text>
      ) : (
        <>
          {visible.map((offer) => (
            <OfferRow
              key={offer.Id}
              offer={offer}
              applied={appliedOffer?.offerId === offer.Id}
              onApply={() => onChange(offerToApplied(offer))}
              onRemove={() => onChange(null)}
            />
          ))}
          {validOffers.length > 2 && (
            <TouchableOpacity
              onPress={() => setExpanded((v) => !v)}
              style={s.viewAllBtn}
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Show fewer offers" : "View all offers"}
            >
              <Text style={s.viewAllText}>{expanded ? "Show less" : `View all (${validOffers.length})`}</Text>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={COLORS.primaryDark} />
            </TouchableOpacity>
          )}
        </>
      )}

      <CouponCodeInput onApply={onChange} />
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.12)",
    marginTop: SPACING.md,
    overflow: "hidden",
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
  viewAllText: { fontSize: 12, fontWeight: "700", color: COLORS.primaryDark },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  left: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1, marginRight: SPACING.sm },
  badge: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: COLORS.white },
  textWrap: { flex: 1 },
  title: { fontSize: 12.5, fontWeight: "700", color: COLORS.black },
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
  applyBtnActive: { backgroundColor: COLORS.primaryDark },
  applyText: { fontSize: 11, fontWeight: "700", color: COLORS.primaryDark },
  applyTextActive: { color: COLORS.white },
});
