/**
 * "How it works" 4-step row for onboarding screen 2 - Book Online, We
 * Pick Up, Expert Stitching, Delivered To You. Horizontal row of filled
 * icon circles connected by a thin line, each with a small numbered
 * badge and a label underneath - no per-step description text, that
 * lives in the slide's single description line instead.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../constants/theme";

const STEPS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "phone-portrait-outline", label: "Book\nOnline" },
  { icon: "bicycle-outline", label: "We\nPickup" },
  { icon: "cut-outline", label: "Expert\nStitching" },
  { icon: "checkmark-done-outline", label: "Delivered\nTo You" },
];

export default function HowItWorksSteps() {
  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const isLast = i === STEPS.length - 1;
        return (
          <React.Fragment key={step.label}>
            <View style={styles.stepCol}>
              <View style={styles.iconWrap}>
                <Ionicons name={step.icon} size={22} color={COLORS.white} />
                <View style={styles.numberBadge}>
                  <Text style={styles.numberText}>{i + 1}</Text>
                </View>
              </View>
              <Text style={styles.label} maxFontSizeMultiplier={1.4}>
                {step.label}
              </Text>
            </View>
            {!isLast ? <View style={styles.connector} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  stepCol: {
    alignItems: "center",
    width: 60,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  numberBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    ...TYPOGRAPHY.label.sm,
    color: COLORS.primaryDark,
    fontSize: 10,
  },
  connector: {
    height: 2,
    flex: 1,
    maxWidth: 20,
    backgroundColor: COLORS.grayBorder,
    marginTop: 26,
  },
  label: {
    ...TYPOGRAPHY.label.md,
    color: COLORS.black,
    textAlign: "center",
    marginTop: SPACING.xs + 2,
  },
});
