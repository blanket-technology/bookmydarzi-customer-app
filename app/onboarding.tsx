/**
 * First-launch onboarding carousel - 3 slides inside a fixed-margin,
 * vertically-centered card (not full-viewport - see OnboardingCard).
 * Skip / progress dots / Next all live inside the card, in its own footer
 * row.
 *
 * Gated in app/index.tsx: shown once per ONBOARDING_VERSION (see
 * useOnboardingStore) - first launch, or any future launch where the
 * persisted completedVersion no longer matches ONBOARDING_VERSION. Always
 * routes straight into (tabs) on completion - browsing is allowed while
 * logged out, login is only required at checkout.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../constants/theme";
import CarouselControls from "../src/components/onboarding/CarouselControls";
import HowItWorksSteps from "../src/components/onboarding/HowItWorksSteps";
import OnboardingCard from "../src/components/onboarding/OnboardingCard";
import OnboardingSlide from "../src/components/onboarding/OnboardingSlide";
import ServiceGrid from "../src/components/onboarding/ServiceGrid";
import {
  HowItWorksIllustration,
  ServicesIllustration,
  TrustIllustration,
} from "../src/components/onboarding/illustrations";
import { useOnboardingStore } from "../src/store/useOnboardingStore";

const TRUST_CARDS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: "shield-checkmark-outline", title: "Verified Tailors", sub: "Handpicked & trained by us" },
  { icon: "location-outline", title: "Doorstep Measurement", sub: "Precise sizing, no guesswork" },
  { icon: "ribbon-outline", title: "Perfect Fit Guarantee", sub: "Free redo if it's not right" },
];

type SlideData = {
  key: string;
  illustration: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  content?: React.ReactNode;
};

function TrustCards() {
  return (
    <View style={contentStyles.col}>
      {TRUST_CARDS.map((c) => (
        <View key={c.title} style={contentStyles.card}>
          <View style={contentStyles.iconWrap}>
            <Ionicons name={c.icon} size={18} color={COLORS.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={contentStyles.cardTitle} maxFontSizeMultiplier={1.5}>{c.title}</Text>
            <Text style={contentStyles.cardSub} maxFontSizeMultiplier={1.5}>{c.sub}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const completeOnboarding = useOnboardingStore((s) => s.complete);

  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const listRef = useRef<FlatList<SlideData>>(null);

  const slides: SlideData[] = useMemo(
    () => [
      {
        key: "trust",
        illustration: <TrustIllustration />,
        eyebrow: "Welcome to BookMyDarzi",
        title: "Every order, backed by trust",
        content: <TrustCards />,
      },
      {
        key: "how-it-works",
        illustration: <HowItWorksIllustration />,
        title: "How it works",
        description: "We pick up your order, stitch it to perfection, and deliver it back to you.",
        content: <HowItWorksSteps />,
      },
      {
        key: "services",
        illustration: <ServicesIllustration />,
        title: "Never settle for an ill fit again",
        description: "From everyday alterations to your finest occasion wear - tailored precisely for you.",
        content: <ServiceGrid />,
      },
    ],
    [],
  );

  const finish = useCallback(() => {
    completeOnboarding();
    router.replace("/(tabs)");
  }, [completeOnboarding, router]);

  const goToIndex = useCallback(
    (index: number) => {
      if (!cardWidth) return;
      listRef.current?.scrollToOffset({ offset: index * cardWidth, animated: true });
      setActiveIndex(index);
    },
    [cardWidth],
  );

  const handleNext = useCallback(() => {
    if (activeIndex >= slides.length - 1) {
      finish();
      return;
    }
    goToIndex(activeIndex + 1);
  }, [activeIndex, slides.length, finish, goToIndex]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!cardWidth) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
      setActiveIndex((prev) => (prev === index ? prev : index));
    },
    [cardWidth],
  );

  const isLastSlide = activeIndex === slides.length - 1;

  return (
    <OnboardingCard>
      <View
        style={styles.body}
        onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
      >
        {cardWidth > 0 ? (
          <FlatList
            ref={listRef}
            data={slides}
            keyExtractor={(s) => s.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => (
              <Animated.View
                key={item.key}
                entering={index === 0 ? undefined : FadeIn.duration(280)}
                style={{ width: cardWidth }}
              >
                <OnboardingSlide
                  width={cardWidth}
                  illustration={item.illustration}
                  eyebrow={item.eyebrow}
                  title={item.title}
                  description={item.description}
                >
                  {item.content}
                </OnboardingSlide>
              </Animated.View>
            )}
            style={styles.list}
          />
        ) : null}
      </View>

      <View style={styles.footer}>
        <CarouselControls
          total={slides.length}
          activeIndex={activeIndex}
          isLastSlide={isLastSlide}
          onSkip={finish}
          onNext={handleNext}
          primaryLabel={isLastSlide ? "Next" : undefined}
        />
      </View>
    </OnboardingCard>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  list: { flex: 1 },
  footer: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
});

const contentStyles = StyleSheet.create({
  col: { width: "100%", gap: SPACING.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { ...TYPOGRAPHY.label.lg, color: COLORS.black, fontSize: 13.5 },
  cardSub: { ...TYPOGRAPHY.body.sm, color: COLORS.gray, marginTop: 1 },
});
