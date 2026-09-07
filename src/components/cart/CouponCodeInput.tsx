import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "../../../constants/theme";
import { validateCouponCode } from "../../services/offerService";
import type { ApiSpecialOffer } from "../../types/homeApi";
import type { AppliedOffer } from "./CouponSection";

function offerToApplied(offer: ApiSpecialOffer): AppliedOffer {
  return {
    offerId: offer.Id,
    title: offer.Title,
    discountType: offer.DiscountType === "flat" ? "flat" : "percentage",
    discountValue: offer.DiscountType === "flat" ? offer.DiscountAmount ?? 0 : offer.DiscountPercent,
  };
}

/**
 * Manual coupon-code entry box - the counterpart to browsing the pre-listed
 * offers (used standalone by Cart, which already has its own browse list
 * wired to useCartStore, and composed inside CouponSection for Book Now,
 * which has neither). Calls the same GET /offers/validate the website uses.
 */
export function CouponCodeInput({ onApply }: { onApply: (offer: AppliedOffer) => void }) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setError("");
    try {
      const offer = await validateCouponCode(trimmed);
      onApply(offerToApplied(offer));
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check that code right now.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <View>
      <View style={s.codeRow}>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={(text) => {
            setCode(text.toUpperCase());
            setError("");
          }}
          placeholder="Enter coupon code"
          placeholderTextColor={COLORS.gray}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!checking}
          maxLength={50}
          onSubmitEditing={() => void handleApply()}
        />
        <TouchableOpacity
          style={[s.codeApplyBtn, (!code.trim() || checking) && s.codeApplyBtnDisabled]}
          onPress={() => void handleApply()}
          disabled={!code.trim() || checking}
          activeOpacity={0.8}
        >
          {checking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.codeApplyText}>Apply</Text>}
        </TouchableOpacity>
      </View>
      {error ? <Text style={s.codeErrorText}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  codeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 10,
  },
  codeInput: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: COLORS.black,
  },
  codeApplyBtn: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  codeApplyBtnDisabled: { opacity: 0.4 },
  codeApplyText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  codeErrorText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.error,
    paddingHorizontal: SPACING.sm + 2,
    paddingBottom: 10,
  },
});
