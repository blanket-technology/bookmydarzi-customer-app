import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import Animated, {
    Extrapolation,
    FadeInDown,
    FadeInLeft,
    FadeInRight,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS } from "../constants/theme";

// ── Constants ──────────────────────────────────────────────────────────────────

// Aligned to the app's real brand teal (constants/theme.ts COLORS) - this
// screen previously defined its own slightly different teal (#0F766E vs
// COLORS.primaryDark's #0c6c75), which made it look like a different app
// right after the home screen.
const TEAL = COLORS.primaryDark;
const COPPER = "#B87333";
const FOREST = "#0D1410";
const LINEN = "#F7F3EE";
const H_PAD = 16;
const HERO_H_MAX = 320;

// ── Process steps ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    icon: "phone-portrait-outline" as const,
    title: "Book Online",
    desc: "Pick your service and share your address. Choose a pickup time - morning, evening, or weekend. Done in under 2 minutes.",
    accent: TEAL,
    bg: COLORS.primaryLight,
    dir: "left" as const,
  },
  {
    num: "02",
    icon: "bicycle-outline" as const,
    title: "We Come to You",
    desc: "Our team arrives at your door at the time you chose. We collect your fabric and take measurements at your home.",
    accent: COPPER,
    bg: "#FDF3E7",
    dir: "right" as const,
  },
  {
    num: "03",
    icon: "cut-outline" as const,
    title: "Expert Stitching",
    desc: "Your garment is handcrafted by a trained BMD tailor to your exact measurements, with a quality check before delivery.",
    accent: "#7C3AED",
    bg: "#EDE9FE",
    dir: "left" as const,
  },
  {
    num: "04",
    icon: "checkmark-circle-outline" as const,
    title: "Delivered to You",
    desc: "Clean, pressed, and packaged - delivered back to your door. If the fit isn't perfect, we collect and fix it free.",
    accent: "#059669",
    bg: "#D1FAE5",
    dir: "right" as const,
  },
] as const;

// Brief overview of what BMD does - distinct from the category grid on the
// "Our Services" page. This is a quick, scannable summary, not a duplicate.
const OFFERINGS = [
  {
    icon: "shirt-outline" as const,
    title: "Custom Stitching",
    desc: "Any garment, made to your exact measurements.",
    accent: TEAL,
    bg: COLORS.primaryLight,
  },
  {
    icon: "construct-outline" as const,
    title: "Alterations & Repairs",
    desc: "Resize, refit, or fix - fast turnaround.",
    accent: COPPER,
    bg: "#FDF3E7",
  },
  {
    icon: "sparkles-outline" as const,
    title: "Designer Finishes",
    desc: "Premium detailing for weddings & special occasions.",
    accent: "#7C3AED",
    bg: "#EDE9FE",
  },
  {
    icon: "people-outline" as const,
    title: "For the Whole Family",
    desc: "Men's, women's, kids' - one tailor for everyone.",
    accent: "#059669",
    bg: "#D1FAE5",
  },
] as const;

// ── Main screen ────────────────────────────────────────────────────────────────

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: SH } = useWindowDimensions();

  const heroH = Math.min(HERO_H_MAX, SH * 0.48);
  // Exact-pixel width for the 2-col offer grid, not a "47.5%" guess - that
  // plus offerGrid's 12px gap left ~2px of margin on narrow phones (same
  // overflow-wrap bug class fixed in sub-services.tsx).
  const offerCardWidth = Math.floor((W - H_PAD * 2 - 12) / 2);
  const titleFs = W < 380 ? 21 : 25;
  const subFs = W < 380 ? 12.5 : 13.5;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, heroH],
          [0, -heroH * 0.35],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, heroH * 0.4],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, heroH * 0.4],
          [0, -20],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const stickyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [100, 160],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [100, 160],
          [-8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={s.root}>
      {/* ── Sticky mini-header ── */}
      <Animated.View
        style={[s.stickyHdr, { paddingTop: insets.top + 10 }, stickyStyle]}
        pointerEvents="none"
      >
        <Text style={s.stickyTitle}>How It Works</Text>
      </Animated.View>

      {/* ── Back button (always visible, highest zIndex) ── */}
      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={12}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" style={{ marginRight: 1.5 }} />
      </TouchableOpacity>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        contentContainerStyle={s.scrollContent}
      >
        {/* ── Parallax hero ── */}
        <Animated.View style={[s.hero, { height: heroH }, heroStyle]}>
          <LinearGradient
            colors={["#051515", "#0a3d3d", TEAL]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.dotGrid} pointerEvents="none">
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={i} style={s.dot} />
            ))}
          </View>

          <Animated.View style={[s.heroContent, heroContentStyle]}>
            <View style={s.heroPill}>
              <Ionicons
                name="cut-outline"
                size={11}
                color="rgba(255,255,255,0.8)"
              />
              <Text style={s.heroPillText}>BookMyDarzi · How It Works</Text>
            </View>
            <Text style={[s.heroTitle, { fontSize: titleFs, lineHeight: titleFs * 1.2 }]}>
              Everything you need,{"\n"}stitched to perfection.
            </Text>
            <Text style={[s.heroSub, { fontSize: subFs }]}>
              From everyday kurtas to wedding outfits - our tailors handle every
              stitch at your door.
            </Text>
          </Animated.View>

          <Animated.View style={[s.scrollHint, heroContentStyle]}>
            <Ionicons
              name="chevron-down"
              size={20}
              color="rgba(255,255,255,0.4)"
            />
          </Animated.View>
        </Animated.View>

        {/* ── Content sheet ── */}
        <View style={[s.sheet, { paddingBottom: insets.bottom + 40 }]}>
          {/* ════════════════════════ HOW IT WORKS ════════════════════════════ */}
          <View style={s.section}>
            <Animated.View
              entering={FadeInDown.delay(0).duration(450)}
              style={s.sectionHead}
            >
              <Text style={s.eyebrow}>How It Works</Text>
              <Text style={[s.sectionTitle, { fontSize: W < 380 ? 19 : 21 }]}>
                Four steps,{"\n"}perfect results.
              </Text>
              <Text style={s.sectionSub}>
                Here&apos;s exactly what happens after you book.
              </Text>
            </Animated.View>

            {STEPS.map((step, i) => {
              const badgeRight = i % 2 === 0;

              return (
                <React.Fragment key={step.num}>
                  <Animated.View
                    entering={(step.dir === "left" ? FadeInLeft : FadeInRight)
                      .delay(i * 90 + 80)
                      .duration(440)
                      .springify()
                      .damping(20)}
                    style={s.stepCard}
                  >
                    <View
                      style={[s.stepTopRow, badgeRight && s.stepTopRowReverse]}
                    >
                      <View
                        style={[s.stepNumBadge, { backgroundColor: step.bg }]}
                      >
                        <Text style={[s.stepNumTxt, { color: step.accent }]}>
                          {step.num}
                        </Text>
                      </View>
                      <View
                        style={[s.stepIconWrap, { backgroundColor: step.bg }]}
                      >
                        <Ionicons
                          name={step.icon}
                          size={24}
                          color={step.accent}
                        />
                      </View>
                    </View>

                    <View
                      style={[
                        s.stepRule,
                        { backgroundColor: step.accent },
                        badgeRight ? s.stepRuleRight : s.stepRuleLeft,
                      ]}
                    />

                    <Text style={s.stepTitle}>{step.title}</Text>
                    <Text style={s.stepDesc}>{step.desc}</Text>
                  </Animated.View>

                  {i < STEPS.length - 1 && (
                    <View style={s.stepConnector}>
                      <View
                        style={[
                          s.stepConnDot,
                          { backgroundColor: step.accent + "50" },
                        ]}
                      />
                      <View
                        style={[
                          s.stepConnDot,
                          { backgroundColor: step.accent + "30" },
                        ]}
                      />
                      <View
                        style={[
                          s.stepConnDot,
                          { backgroundColor: step.accent + "15" },
                        ]}
                      />
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* ════════════════════════ WHAT WE OFFER ════════════════════════════ */}
          <View style={[s.section, { marginBottom: 0 }]}>
            <Animated.View
              entering={FadeInDown.delay(0).duration(450)}
              style={s.sectionHead}
            >
              <Text style={s.eyebrow}>What We Offer</Text>
              <Text style={[s.sectionTitle, { fontSize: W < 380 ? 19 : 21 }]}>
                One tailor, every need.
              </Text>
              <Text style={s.sectionSub}>
                A quick look at what BMD covers.
              </Text>
            </Animated.View>

            <View style={s.offerGrid}>
              {OFFERINGS.map((item, i) => (
                <Animated.View
                  key={item.title}
                  entering={FadeInDown.delay(i * 60 + 60).duration(380)}
                  style={[s.offerCard, { width: offerCardWidth }]}
                >
                  <View style={[s.offerIconWrap, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={20} color={item.accent} />
                  </View>
                  <Text style={s.offerTitle}>{item.title}</Text>
                  <Text style={s.offerDesc}>{item.desc}</Text>
                </Animated.View>
              ))}
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LINEN,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Sticky header ──────────────────────────────────────────────────────────
  stickyHdr: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: H_PAD,
    paddingBottom: 14,
    backgroundColor: "rgba(255,255,255,0.97)",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  stickyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: FOREST,
    letterSpacing: -0.3,
  },

  // ── Back button ────────────────────────────────────────────────────────────
  backBtn: {
    position: "absolute",
    left: H_PAD,
    zIndex: 30,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: {
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  dotGrid: {
    position: "absolute",
    top: 56,
    right: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    width: 108,
    gap: 10,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 24,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 12,
  },
  heroPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  heroSub: {
    color: "rgba(255,255,255,0.7)",
    lineHeight: 19,
  },
  scrollHint: {
    alignItems: "center",
    paddingBottom: 8,
  },

  // ── Sheet ──────────────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: LINEN,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: H_PAD,
    paddingTop: 24,
    marginTop: -24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
    }),
  },
  section: {
    marginBottom: 32,
  },
  sectionHead: {
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: TEAL,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "800",
    color: FOREST,
    lineHeight: 34,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  sectionSub: {
    fontSize: 14,
    color: "#5C6168",
    lineHeight: 21,
  },

  // ── Process steps ──────────────────────────────────────────────────────────
  stepCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  stepTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  stepTopRowReverse: {
    flexDirection: "row-reverse",
  },
  stepNumBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumTxt: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -1,
  },
  stepIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepRule: {
    width: 28,
    height: 3,
    borderRadius: 2,
    marginBottom: 10,
  },
  stepRuleLeft: { alignSelf: "flex-start" },
  stepRuleRight: { alignSelf: "flex-end" },
  stepTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: FOREST,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontSize: 13,
    color: "#5C6168",
    lineHeight: 19,
  },
  stepConnector: {
    alignItems: "center",
    paddingVertical: 6,
    gap: 4,
  },
  stepConnDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // ── What We Offer ──────────────────────────────────────────────────────────
  offerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  offerCard: {
    // width set inline per-render (offerCardWidth) - exact pixel width,
    // not a percentage guess.
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  offerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: FOREST,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  offerDesc: {
    fontSize: 12,
    color: "#5C6168",
    lineHeight: 16,
  },
});
