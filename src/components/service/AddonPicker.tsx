/**
 * "Add extras" section on the service detail screen - lets the customer add
 * optional per-service extras (e.g. Button Replacement, Shoulder Adjustment
 * for a shirt repair) before add-to-cart/book-now. Mirrors
 * bookmydarzi-web-final's AddonPicker.tsx (checkbox list + optional note,
 * live running total) so the feature behaves identically across web and app;
 * this is the RN/StyleSheet equivalent of that component's design language,
 * adapted to match service-details.tsx's existing stitchCard visual style.
 *
 * Selection state lives here and is handed up via onChange - the parent
 * screen folds it into the PendingCartItem it builds, same pattern the web
 * app uses for its own AddToCartButton/book-now wiring.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { COLORS, RADIUS, SPACING } from "../../../constants/theme";
import type { ServiceAddon } from "../../types/catalogApi";
import type { SelectedAddon } from "../../types/cart";

function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function AddonPicker({
  addons,
  onChange,
}: {
  addons: ServiceAddon[];
  onChange: (selected: SelectedAddon[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});

  if (addons.length === 0) return null;

  const emit = (nextIds: Set<number>, nextNotes: Record<number, string>) => {
    const selected: SelectedAddon[] = addons
      .filter((a) => nextIds.has(a.id))
      .map((a) => ({
        addonId: a.id,
        name: a.name,
        price: a.price,
        note: nextNotes[a.id]?.trim() || undefined,
      }));
    onChange(selected);
  };

  const toggle = (addon: ServiceAddon) => {
    const next = new Set(selectedIds);
    if (next.has(addon.id)) {
      next.delete(addon.id);
    } else {
      next.add(addon.id);
    }
    setSelectedIds(next);
    emit(next, notes);
  };

  const setNote = (addonId: number, value: string) => {
    const next = { ...notes, [addonId]: value };
    setNotes(next);
    emit(selectedIds, next);
  };

  const selectedTotal = addons
    .filter((a) => selectedIds.has(a.id))
    .reduce((sum, a) => sum + a.price, 0);

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryDark} />
          </View>
          <View>
            <Text style={styles.title}>Add extras</Text>
            <Text style={styles.subtitle}>Extend this order with optional work</Text>
          </View>
        </View>
        {selectedIds.size > 0 && (
          <View style={styles.totalPill}>
            <Text style={styles.totalPillText}>+{formatMoney(selectedTotal)}</Text>
          </View>
        )}
      </View>

      <View style={styles.list}>
        {addons.map((addon) => {
          const checked = selectedIds.has(addon.id);
          return (
            <View
              key={addon.id}
              style={[styles.addonCard, checked && styles.addonCardSelected]}
            >
              <Pressable
                onPress={() => toggle(addon)}
                style={styles.addonRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Ionicons name="checkmark" size={13} color={COLORS.white} />}
                </View>
                <View style={styles.addonBody}>
                  <Text style={styles.addonName}>{addon.name}</Text>
                </View>
                <View style={[styles.pricePill, checked && styles.pricePillSelected]}>
                  <Text style={[styles.pricePillText, checked && styles.pricePillTextSelected]}>
                    +{formatMoney(addon.price)}
                  </Text>
                </View>
              </Pressable>

              {checked && (
                <View style={styles.noteWrap}>
                  <TextInput
                    style={styles.noteInput}
                    value={notes[addon.id] ?? ""}
                    onChangeText={(v) => setNote(addon.id, v)}
                    placeholder="Add a note (optional) - e.g. exact spot, size, preference"
                    placeholderTextColor={COLORS.gray}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.black,
  },
  subtitle: {
    fontSize: 11.5,
    color: COLORS.gray,
    marginTop: 1,
  },
  totalPill: {
    flexShrink: 0,
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  totalPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
  },
  list: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  addonCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
    backgroundColor: COLORS.white,
    overflow: "hidden",
  },
  addonCardSelected: {
    borderColor: COLORS.primaryDark,
    backgroundColor: "#f0fafb",
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: SPACING.sm,
  },
  checkbox: {
    marginTop: 1,
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  addonBody: { flex: 1, minWidth: 0 },
  addonName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: COLORS.black,
  },
  addonDesc: {
    fontSize: 11.5,
    color: COLORS.gray,
    marginTop: 2,
    lineHeight: 16,
  },
  pricePill: {
    flexShrink: 0,
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pricePillSelected: {
    backgroundColor: COLORS.primaryDark,
  },
  pricePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400E",
  },
  pricePillTextSelected: {
    color: COLORS.white,
  },
  noteWrap: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
});
