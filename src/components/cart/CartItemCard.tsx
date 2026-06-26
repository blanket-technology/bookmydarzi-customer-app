import { Ionicons } from "@expo/vector-icons";
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
  const previewChips = item.measurementPreview.filter((m) => {
    const v = m.value?.trim();
    if (!v) return false;
    const n = Number(v);
    return Number.isNaN(n) || n > 0;
  });

  const showPerItem = item.quantity > 1;

  return (
    <View style={styles.card}>
      {/* ── Top row: name + remove ─────────────────────────────────────── */}
      <View style={styles.topRow}>
        <View style={styles.nameBlock}>
          <Text style={styles.serviceName} numberOfLines={2}>
            {item.serviceName}
          </Text>
          {item.categoryName ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{item.categoryName}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={handleRemove}
          hitSlop={10}
          disabled={mutating}
          style={styles.removeBtn}
          accessibilityLabel={`Remove ${item.serviceName}`}
        >
          <Ionicons name="close" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* ── Person / notes ────────────────────────────────────────────── */}
      {item.personName || gender || item.notes ? (
        <View style={styles.metaRow}>
          {item.personName ? (
            <View style={styles.metaChip}>
              <Ionicons name="person-outline" size={12} color={COLORS.gray} />
              <Text style={styles.metaText}>
                {item.personName}
                {gender ? ` · ${gender}` : ""}
              </Text>
            </View>
          ) : null}
          {item.notes ? (
            <View style={styles.metaChip}>
              <Ionicons
                name="document-text-outline"
                size={12}
                color={COLORS.gray}
              />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.notes}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Measurement chips ─────────────────────────────────────────── */}
      {previewChips.length > 0 ? (
        <View style={styles.chipsRow}>
          {previewChips.map((m, idx) => (
            <View key={`${m.name}-${idx}`} style={styles.chip}>
              <Text style={styles.chipText}>
                {m.name}: {m.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Bottom row: price + qty ────────────────────────────────────── */}
      <View style={styles.bottomRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.lineTotal}>{item.lineTotalDisplay}</Text>
          {showPerItem ? (
            <Text style={styles.perItem}>
              {item.unitPriceDisplay} × {item.quantity}
            </Text>
          ) : (
            <Text style={styles.perItem}>{item.unitPriceDisplay}</Text>
          )}
        </View>

        <View style={styles.qtyWrap}>
          <TouchableOpacity
            style={[styles.qtyBtn, item.quantity <= 1 && styles.qtyBtnDisabled]}
            onPress={onDecrease}
            disabled={mutating || item.quantity <= 1}
            hitSlop={6}
            accessibilityLabel="Decrease quantity"
          >
            <Ionicons
              name="remove"
              size={16}
              color={
                item.quantity <= 1
                  ? COLORS.grayBorder
                  : COLORS.primaryDark
              }
            />
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={onIncrease}
            disabled={mutating}
            hitSlop={6}
            accessibilityLabel="Increase quantity"
          >
            <Ionicons name="add" size={16} color={COLORS.primaryDark} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    ...SHADOW.card,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  nameBlock: { flex: 1, gap: 4 },
  serviceName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    lineHeight: 21,
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.errorLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: SPACING.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "500",
    maxWidth: 180,
  },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: SPACING.sm,
  },
  chip: {
    backgroundColor: "#f0fafb",
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.15)",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    paddingTop: SPACING.sm,
    marginTop: 2,
  },
  priceBlock: { gap: 1 },
  lineTotal: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  perItem: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "500",
  },

  qtyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.full,
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
  },
});
