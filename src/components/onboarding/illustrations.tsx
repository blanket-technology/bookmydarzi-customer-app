/**
 * Lightweight vector illustrations for the onboarding carousel - built from
 * Ionicons + gradient/shape primitives already used elsewhere in the app
 * (see splash.tsx's glow-ring stack), not image assets. Keeps bundle size
 * and load time minimal and matches BMD's existing icon-led visual
 * language instead of introducing a new illustration style.
 *
 * Sized deliberately small (fits a 96px-tall stage, see OnboardingSlide) -
 * each slide also needs room for a title, description, and content list
 * below, so the illustration is a compact accent, not the hero.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS, RADIUS } from "../../../constants/theme";

const GLOW_GOLD = "rgba(201, 168, 76, 0.16)";

/** Screen 1 - trust badge (the 3 trust points render separately as children). */
export function TrustIllustration() {
  return (
    <View style={styles.stage}>
      <View style={[styles.ring, styles.ringGold]} />
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.badgeCircle}>
        <Ionicons name="shield-checkmark" size={32} color={COLORS.white} />
      </LinearGradient>
    </View>
  );
}

/** Screen 2 - small hero badge above the 4-step list. */
export function HowItWorksIllustration() {
  return (
    <View style={styles.stage}>
      <View style={[styles.ring, styles.ringTeal]} />
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.badgeCircleSm}>
        <Ionicons name="repeat" size={24} color={COLORS.white} />
      </LinearGradient>
    </View>
  );
}

/** Screen 3 - kept as a small brand badge; the actual range of services is
 * now shown via ServiceGrid (icon + label per garment type), not a vague
 * icon cluster, so menswear/womenswear/alterations all get equal billing. */
export function ServicesIllustration() {
  return (
    <View style={styles.stage}>
      <View style={[styles.ring, styles.ringTeal]} />
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.badgeCircle}>
        <Ionicons name="sparkles" size={28} color={COLORS.white} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderRadius: RADIUS.full,
  },
  ringTeal: {
    width: 88,
    height: 88,
    backgroundColor: "rgba(20, 150, 148, 0.14)",
  },
  ringGold: {
    width: 88,
    height: 88,
    backgroundColor: GLOW_GOLD,
  },
  badgeCircle: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    ...shadow(),
  },
  badgeCircleSm: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    ...shadow(),
  },
  floatingBadge: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow(),
  },
});

function shadow() {
  return {
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  } as const;
}
