import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";
import type { CartServiceEntry } from "../../types/cart";
import { normalizeProfileImageUrl } from "../../utils/profileImage";

interface CartItemCardProps {
  item: CartServiceEntry;
  mutating?: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}

function genderLabel(gender: string | null): string | null {
  if (!gender) return null;
  const key = gender.trim().toLowerCase();
  if (!key) return null;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function CartItemCard({
  item,
  mutating,
  onIncrease,
  onDecrease,
  onRemove,
}: CartItemCardProps) {
  const handleRemove = () => {
    Alert.alert(
      "Remove service",
      `Remove "${item.serviceName}" from your cart?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: onRemove },
      ],
    );
  };

  const gender = genderLabel(item.gender);
  // Only show the person chip for a real, named family member - not the
  // default "Self"/"Me" (booking for yourself needs no label).
  const personLower = (item.personName ?? "").trim().toLowerCase();
  const showPersonChip =
    !!item.personName?.trim() && personLower !== "self" && personLower !== "me";
  const showPerItem = item.quantity > 1;

  const prefs = item.stitchingPreferences;
  const hasDesignBrief =
    !!prefs && (!!prefs.design_style || !!prefs.embellishment_level || !!prefs.design_notes);

  const imageUri = normalizeProfileImageUrl(item.imageUrl);

  return (
    <View style={styles.card}>
      {/* Header strip */}
      <View style={styles.header}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.serviceThumb}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={styles.serviceIconBox}>
            <Ionicons name="cut-outline" size={22} color={COLORS.primaryDark} />
          </View>
        )}
        <View style={styles.nameBlock}>
          <Text style={styles.serviceName} numberOfLines={2}>{item.serviceName}</Text>
          {item.categoryName ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{item.categoryName}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={handleRemove} hitSlop={12} disabled={mutating}
          style={styles.removeBtn} accessibilityLabel={`Remove ${item.serviceName}`}>
          <Ionicons name="trash-outline" size={13} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Person / notes meta. The person chip is only useful when the order is
          for a NAMED person (a family member) - booking for yourself is the
          default, so a "Self" chip is just noise and is hidden. */}
      {(showPersonChip || item.notes) ? (
        <View style={styles.metaRow}>
          {showPersonChip ? (
            <View style={styles.metaChip}>
              <Ionicons name="person-outline" size={11} color={COLORS.gray} />
              <Text style={styles.metaText}>
                {item.personName}{gender ? ` · ${gender}` : ""}
              </Text>
            </View>
          ) : null}
          {item.notes ? (
            <View style={styles.metaChip}>
              <Ionicons name="document-text-outline" size={11} color={COLORS.gray} />
              <Text style={styles.metaText} numberOfLines={1}>{item.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Design brief (Designer-tier stitching preferences) */}
      {hasDesignBrief ? (
        <View style={styles.designBriefWrap}>
          <View style={styles.designBriefBadgeRow}>
            <Ionicons name="diamond-outline" size={12} color="#8A6D1F" />
            <Text style={styles.designBriefBadgeText}>Your Design Brief</Text>
          </View>
          <View style={styles.chipsRow}>
            {prefs!.design_style ? (
              <View style={[styles.chip, styles.designChip]}>
                <Text style={[styles.chipText, styles.designChipText]}>
                  Style: {prefs!.design_style.charAt(0).toUpperCase() + prefs!.design_style.slice(1)}
                </Text>
              </View>
            ) : null}
            {prefs!.embellishment_level ? (
              <View style={[styles.chip, styles.designChip]}>
                <Text style={[styles.chipText, styles.designChipText]}>
                  Embellishment: {prefs!.embellishment_level.charAt(0).toUpperCase() + prefs!.embellishment_level.slice(1)}
                </Text>
              </View>
            ) : null}
          </View>
          {prefs!.design_notes ? (
            <Text style={styles.designNotesText} numberOfLines={2}>
              "{prefs!.design_notes}"
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.lineTotal}>{item.lineTotalDisplay}</Text>
          {showPerItem ? (
            <Text style={styles.perItem}>{item.unitPriceDisplay} × {item.quantity}</Text>
          ) : (
            <Text style={styles.perItem}>{item.unitPriceDisplay}</Text>
          )}
        </View>

        <View style={styles.qtyWrap}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={item.quantity <= 1 ? onRemove : onDecrease}
            disabled={mutating}
            hitSlop={7} accessibilityLabel="Decrease quantity">
            <Ionicons name="remove" size={15} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn} onPress={onIncrease} disabled={mutating}
            hitSlop={7} accessibilityLabel="Increase quantity">
            <Ionicons name="add" size={15} color={COLORS.primaryDark} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.sm,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    overflow: "hidden",
    ...SHADOW.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EAED",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: SPACING.sm + 2,
    paddingBottom: SPACING.xs + 2,
    backgroundColor: "#FAFBFC",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECEEF2",
  },
  serviceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  serviceThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.grayLight,
    flexShrink: 0,
  },
  nameBlock: { flex: 1, gap: 4 },
  serviceName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.black,
    lineHeight: 18,
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  categoryText: { fontSize: 9.5, fontWeight: "700", color: COLORS.primaryDark },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: SPACING.sm + 2,
    paddingTop: SPACING.xs + 2,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  metaText: {
    fontSize: 10.5,
    color: COLORS.gray,
    fontWeight: "500",
    maxWidth: 180,
  },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingHorizontal: SPACING.sm + 2,
    paddingTop: SPACING.xs + 2,
  },
  chip: {
    backgroundColor: "#F0FAFB",
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.15)",
  },
  chipMore: { backgroundColor: COLORS.grayLight, borderColor: COLORS.grayBorder },
  chipText: { fontSize: 9.5, fontWeight: "600", color: COLORS.primaryDark },

  designBriefWrap: {
    paddingHorizontal: SPACING.sm + 2,
    paddingTop: SPACING.xs + 4,
    gap: 6,
  },
  designBriefBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  designBriefBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#8A6D1F",
    letterSpacing: 0.2,
  },
  designChip: { backgroundColor: "#FBF6E8", borderColor: "rgba(201,168,76,0.3)" },
  designChipText: { color: "#8A6D1F" },
  designNotesText: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: "italic",
    lineHeight: 15,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    marginTop: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ECEEF2",
  },
  priceBlock: { gap: 1 },
  lineTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primaryDark,
    letterSpacing: -0.3,
  },
  perItem: { fontSize: 10.5, color: COLORS.gray, fontWeight: "500" },

  qtyWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 2,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnDisabled: { opacity: 0.3, backgroundColor: COLORS.grayLight },
  qtyValue: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.black,
  },
});
