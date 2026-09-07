/**
 * Bottom control row for the onboarding carousel: progress dots on the
 * left, Skip + Next/primary-CTA on the right. The label and behavior of
 * the primary action change on the last slide (Next -> Explore Services).
 */
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../constants/theme";
import ProgressIndicator from "./ProgressIndicator";

export interface CarouselControlsProps {
  total: number;
  activeIndex: number;
  isLastSlide: boolean;
  onSkip: () => void;
  onNext: () => void;
  primaryLabel?: string;
}

export default function CarouselControls({
  total,
  activeIndex,
  isLastSlide,
  onSkip,
  onNext,
  primaryLabel,
}: CarouselControlsProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onSkip}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
        style={styles.skipBtn}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ProgressIndicator total={total} activeIndex={activeIndex} />

      <TouchableOpacity
        onPress={onNext}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel ?? (isLastSlide ? "Explore Services" : "Next")}
        style={[styles.nextBtn, isLastSlide && styles.nextBtnWide]}
      >
        <Text style={styles.nextText} numberOfLines={1}>
          {primaryLabel ?? (isLastSlide ? "Explore" : "Next")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
  },
  skipBtn: {
    minWidth: 56,
    paddingVertical: SPACING.sm,
  },
  skipText: {
    ...TYPOGRAPHY.label.lg,
    color: COLORS.gray,
    fontWeight: "600",
  },
  nextBtn: {
    minWidth: 56,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnWide: {
    paddingHorizontal: SPACING.lg,
  },
  nextText: {
    ...TYPOGRAPHY.label.lg,
    color: COLORS.white,
    fontSize: 14,
  },
});
