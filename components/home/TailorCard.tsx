import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import type { Tailor } from "../../constants/data";

interface Props {
  item: Tailor;
  onBook?: () => void;
}

export default function TailorCard({ item, onBook }: Props) {
  return (
    <View style={styles.card}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.avatar}</Text>
      </View>

      {/* Badge */}
      {item.badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      ) : null}

      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.specialty} numberOfLines={1}>{item.specialty}</Text>

      {/* Rating row */}
      <View style={styles.ratingRow}>
        <Ionicons name="star" size={12} color={COLORS.gold} />
        <Text style={styles.rating}>{item.rating}</Text>
        <Text style={styles.reviews}>({item.reviews})</Text>
      </View>

      <Text style={styles.exp}>{item.experience} exp.</Text>

      <TouchableOpacity style={styles.bookBtn} onPress={onBook}>
        <Text style={styles.bookText}>Book</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginRight: SPACING.md,
    alignItems: "center",
    ...SHADOW.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  badge: {
    backgroundColor: COLORS.goldLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.gold,
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
  },
  specialty: {
    fontSize: 11,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  rating: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.black,
  },
  reviews: {
    fontSize: 11,
    color: COLORS.gray,
  },
  exp: {
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: SPACING.sm,
  },
  bookBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 20,
    paddingVertical: 7,
  },
  bookText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.white,
  },
});
