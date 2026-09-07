/**
 * BookMyDarzi - Splash Screen
 *
 * Solid brand-teal background, the BMD logo large and centered, a soft
 * fade + scale-in entrance, then a brief hold before handing off to the
 * app. No animation gimmick - just the mark, sized generously and
 * responsively (scales off the smaller screen dimension so it stays
 * balanced on both phones and tablets).
 *
 * Timeline
 * ─────────
 *   0.00s  Logo fades/scales in                  [spring]
 *   0.30s  Footer fades in                       [out cubic, 350ms]
 *   2.20s  Screen fades out                       [in cubic, 400ms]
 *   2.60s  → App
 */

import { useEffect, useRef } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

// White canvas (matches welcome.tsx) - the logo is a full-color illustrated
// mascot with light skin tones/gold accents, not a flat icon mark, so it
// needs a light ground to read cleanly rather than going muddy on a dark fill.
const BG = "#FFFFFF";
const FOOTER_COLOR = COLORS.gray;
const ENT = Easing.out(Easing.cubic);
const EXT = Easing.in(Easing.cubic);

const LOGO_DELAY = 0;
const FOOTER_DELAY = 300;
const EXIT_DELAY = 2200;
const EXIT_MS = 400;

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  // Read via ref so the exit animation's completion callback always calls
  // the latest onComplete, even if the parent re-renders with a new
  // function reference during the ~2.6s animation before it fires.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Big and responsive: width sized off the smaller screen dimension so it
  // reads as generous on a phone without ballooning past a sane cap on a
  // tablet; height derives from the cropped asset's real 909:840 aspect
  // ratio so the mascot+wordmark never stretches or distorts.
  const LOGO_ASPECT = 840 / 909;
  const logoWidth = Math.min(Math.min(SW, SH) * 0.72, 420);
  const logoHeight = logoWidth * LOGO_ASPECT;

  const logoO = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const footerO = useSharedValue(0);
  const rootO = useSharedValue(1);

  useEffect(() => {
    logoO.value = withDelay(LOGO_DELAY, withTiming(1, { duration: 480, easing: ENT }));
    logoScale.value = withDelay(LOGO_DELAY, withSpring(1, { damping: 14, stiffness: 140 }));

    footerO.value = withDelay(FOOTER_DELAY, withTiming(1, { duration: 350, easing: ENT }));

    rootO.value = withDelay(
      EXIT_DELAY,
      withTiming(0, { duration: EXIT_MS, easing: EXT }, (finished) => {
        if (finished) runOnJS(() => onCompleteRef.current())();
      }),
    );
  // Reanimated shared values (logoO, logoScale, footerO, rootO) are stable
  // refs, not reactive state - intentionally omitted from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoO.value,
    transform: [{ scale: logoScale.value }],
  }));
  const footerStyle = useAnimatedStyle(() => ({ opacity: footerO.value }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: rootO.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <View style={styles.center} pointerEvents="none">
        <Animated.Image
          source={require("../assets/logo_cropped.png")}
          style={[{ width: logoWidth, height: logoHeight }, logoStyle]}
          resizeMode="contain"
        />
      </View>

      <Animated.Text
        style={[styles.footer, { bottom: Math.max(insets.bottom, 16) + 14 }, footerStyle]}
        allowFontScaling={false}
      >
        Powered by Blanket Technologies
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 999,
    backgroundColor: BG,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  footer: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 12,
    fontWeight: "500",
    color: FOOTER_COLOR,
    letterSpacing: 0.4,
  },
});
