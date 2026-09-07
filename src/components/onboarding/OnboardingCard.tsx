/**
 * Card shell for the onboarding carousel - replaces the old full-viewport
 * layout. Sits with a fixed margin from the top/bottom safe areas and is
 * vertically centered in whatever space remains, so it reads consistently
 * on a small phone and a tall one alike. Width is capped so it doesn't
 * stretch edge-to-edge on tablets.
 *
 * Owns only the chrome (position, sizing, background, shadow); slide
 * content and controls are passed in as children.
 */
import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";

// Fixed clearance from the safe-area edges - the card never touches the
// status bar / home indicator regardless of device height.
const VERTICAL_MARGIN = SPACING.xl;
const MAX_CARD_WIDTH = 480; // caps width on tablets; phones are always narrower
const MAX_CARD_HEIGHT = 720; // caps height on very tall devices/tablets

export interface OnboardingCardProps {
  children: React.ReactNode;
}

export default function OnboardingCard({ children }: OnboardingCardProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const availableHeight = height - insets.top - insets.bottom - VERTICAL_MARGIN * 2;
  const cardHeight = Math.min(availableHeight, MAX_CARD_HEIGHT);
  const cardWidth = Math.min(width - SPACING.lg * 2, MAX_CARD_WIDTH);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + VERTICAL_MARGIN,
          paddingBottom: insets.bottom + VERTICAL_MARGIN,
        },
      ]}
    >
      <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.offWhite,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xxl,
    overflow: "hidden",
    ...SHADOW.strong,
  },
});
