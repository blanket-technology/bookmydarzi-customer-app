import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface StarterChip {
  label: string;
  value: string;
}

const ORDER_STARTERS: StarterChip[] = [
  { label: "Track my order", value: "Can you track my order?" },
  { label: "Cancellation & refund policy", value: "What is your cancellation and refund policy?" },
  { label: "Reschedule pickup", value: "I want to reschedule my pickup" },
  { label: "Payment methods", value: "Do you accept Cash on Delivery?" },
];

const GENERAL_STARTERS: StarterChip[] = [
  { label: "Track my order", value: "Can you track my order?" },
  { label: "Cancellation & refund policy", value: "What is your cancellation and refund policy?" },
  { label: "Payment methods", value: "What payment methods do you accept?" },
  { label: "Delivery timelines", value: "How long does stitching/delivery usually take?" },
];

/** Starter prompts shown on the empty chat greeting, before the customer has
 * typed anything - same pattern as Zomato/Amazon's pre-filled quick
 * questions. Tapping one sends it exactly like a typed message. */
export function StarterChips({
  hasOrderContext,
  onSelect,
}: {
  hasOrderContext: boolean;
  onSelect: (value: string) => void;
}) {
  const chips = hasOrderContext ? ORDER_STARTERS : GENERAL_STARTERS;
  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <TouchableOpacity
          key={chip.label}
          style={styles.chip}
          onPress={() => onSelect(chip.value)}
          activeOpacity={0.7}
        >
          <Text style={styles.chipText}>{chip.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: "#0a8c8c",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0a8c8c",
  },
});
