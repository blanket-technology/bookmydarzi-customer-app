/**
 * Welcome - full-screen entry screen shown before Login/Signup.
 *
 * Design: white canvas, centered BMD logo at top (large), wordmark, tagline
 * (matches splash.tsx's established copy), three value-prop pills, then
 * Login (solid teal) / Signup (outlined teal) actions.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";

const TEAL   = COLORS.primaryDark;
const TEAL_MID = COLORS.primary;
const INK    = "#0F1D1E";
const MUTED  = "#6B7B7C";
const BORDER = "#E7ECEC";
const TINT   = "#F0FAFA";

const ENT = Easing.out(Easing.cubic);

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "cube-outline", label: "Doorstep\nPickup" },
  { icon: "cut-outline", label: "Expert\nTailors" },
  { icon: "location-outline", label: "Track\nProgress" },
];

function StitchLine({ progress, width = 110 }: { progress: any; width?: number }) {
  const clipStyle = useAnimatedStyle(() => ({ width: progress.value * width }));
  const dashCount = Math.ceil(width / 18) + 2;
  return (
    <Animated.View style={[s.stitchClip, { height: 2 }, clipStyle]}>
      <View style={s.stitchRow}>
        {Array.from({ length: dashCount }).map((_, i) => (
          <View key={i} style={s.dash} />
        ))}
      </View>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const contentMaxWidth = Math.min(screenWidth, 440);

  const availableHeight = screenHeight - insets.top - insets.bottom - 24;
  const BASELINE_HEIGHT = 680;
  const scale = Math.max(0.68, Math.min(1, availableHeight / BASELINE_HEIGHT));
  const sc = (v: number) => Math.round(v * scale);

  const logoOp    = useSharedValue(0);
  const logoScale = useSharedValue(0.7);
  const stitchP   = useSharedValue(0);

  useEffect(() => {
    logoOp.value    = withTiming(1, { duration: 460, easing: ENT });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 140 });
    stitchP.value   = withDelay(280, withTiming(1, { duration: 560, easing: Easing.inOut(Easing.cubic) }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOp.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center", flex: 1, paddingHorizontal: 28, justifyContent: "center" }}>

        {/* ── Logo + brand, centered, top-weighted ── */}
        <Animated.View style={[s.brandWrap, { marginBottom: sc(30) }, logoStyle]}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: sc(120), height: sc(120), marginBottom: sc(16) }}
            resizeMode="contain"
          />
          <Text style={[s.wordmark, { fontSize: sc(28) }]}>Book My Darzi</Text>
          <View style={s.stitchWrap}>
            <StitchLine progress={stitchP} />
          </View>
          <Text style={[s.tagline, { marginTop: sc(10), fontSize: sc(14) }]}>
            Wear it exactly as you imagined.
          </Text>
        </Animated.View>

        {/* ── Feature pills ── */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(420)}
          style={[s.featureRow, { marginBottom: sc(34) }]}
        >
          {FEATURES.map((f) => (
            <View key={f.label} style={s.featureCard}>
              <Ionicons name={f.icon} size={sc(22)} color={TEAL} />
              <Text style={[s.featureLabel, { fontSize: sc(11) }]}>{f.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View entering={FadeInDown.delay(260).duration(440)}>
          <TouchableOpacity
            style={[s.primaryBtn, { height: sc(56) }]}
            activeOpacity={0.88}
            onPress={() => router.push("/(auth)/login")}
            accessibilityRole="button"
          >
            <Text style={s.primaryBtnTxt}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={[s.footerBar, { paddingBottom: insets.bottom + 14 }]}>
        <Text style={s.footerTxt}>Powered by Blanket Technologies Pvt Ltd</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },

  brandWrap: { alignItems: "center" },
  wordmark: { fontWeight: "800", color: INK, letterSpacing: -0.4 },
  stitchWrap: { alignItems: "center", marginTop: 10 },
  stitchClip: { overflow: "hidden" },
  stitchRow: { flexDirection: "row", gap: 8, position: "absolute", left: 0, top: 0 },
  dash: { width: 10, height: 2, borderRadius: 1, backgroundColor: TEAL_MID },
  tagline: { color: MUTED, textAlign: "center", fontWeight: "500" },

  featureRow: { flexDirection: "row", gap: 10 },
  featureCard: {
    flex: 1,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  featureLabel: { color: INK, fontWeight: "700", textAlign: "center", lineHeight: 14 },

  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },

  footerBar: { alignItems: "center", paddingTop: 4 },
  footerTxt: { fontSize: 11, color: MUTED, fontWeight: "500" },
});
