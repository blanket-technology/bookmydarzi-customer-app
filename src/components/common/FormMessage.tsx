import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING } from "../../../constants/theme";

type Props = {
  message?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function FormBannerError({ message, style }: Props) {
  const text = (message ?? "").trim();
  if (!text) return null;

  return (
    <View style={[styles.banner, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle" size={18} color={COLORS.error} />
      </View>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

export function FieldErrorText({ message, style }: { message?: string | null; style?: StyleProp<TextStyle> }) {
  const text = (message ?? "").trim();
  if (!text) return null;

  return <Text style={[styles.fieldText, style]}>{text}</Text>;
}

/** Default export for legacy imports */
export default FormBannerError;

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(185, 28, 28, 0.25)",
    marginBottom: SPACING.md,
  },
  iconWrap: {
    paddingTop: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: COLORS.error,
  },
  fieldText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: COLORS.error,
  },
});

