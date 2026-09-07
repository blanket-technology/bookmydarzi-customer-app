/**
 * Single onboarding slide - illustration/visual, title, description, and an
 * optional content slot (e.g. trust cards, step list). Sized to the card's
 * width (passed down from the FlatList paging inside OnboardingCard), not
 * the full screen - this is purely a layout shell, slide-specific content
 * is passed in by the parent carousel.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../constants/theme";

export interface OnboardingSlideProps {
  width: number;
  /** Optional - slides that don't need a hero visual (e.g. a dense step
   * list) can omit it entirely to free up vertical room. */
  illustration?: React.ReactNode;
  /** Shown above `title` in smaller type - e.g. "Welcome to BookMyDarzi"
   * with `title` as the trust sub-headline. Optional. */
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function OnboardingSlide({
  width,
  illustration,
  eyebrow,
  title,
  description,
  children,
}: OnboardingSlideProps) {
  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[styles.slide, { minHeight: "100%" }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {illustration ? (
        <View
          style={styles.illustrationStage}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {illustration}
        </View>
      ) : null}

      {eyebrow ? (
        <Text style={styles.eyebrow} maxFontSizeMultiplier={1.4}>
          {eyebrow}
        </Text>
      ) : null}

      <Text style={styles.title} maxFontSizeMultiplier={1.4} accessibilityRole="header">
        {title}
      </Text>
      {description ? (
        <Text style={styles.description} maxFontSizeMultiplier={1.6}>
          {description}
        </Text>
      ) : null}

      {children ? <View style={styles.childrenSlot}>{children}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  slide: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  illustrationStage: {
    width: "100%",
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  eyebrow: {
    ...TYPOGRAPHY.display.sm,
    color: COLORS.primaryDark,
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  title: {
    ...TYPOGRAPHY.heading.h3,
    color: COLORS.black,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  description: {
    ...TYPOGRAPHY.body.lg,
    color: COLORS.gray,
    textAlign: "center",
    maxWidth: 320,
  },
  childrenSlot: {
    width: "100%",
    marginTop: SPACING.lg,
  },
});
