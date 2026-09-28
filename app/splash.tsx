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

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
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
import * as ExpoSplashScreen from "expo-splash-screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

// Bug fix: nothing in this app ever called preventAutoHideAsync/hideAsync,
// so Expo's default behavior applied - the native splash (Android 12+'s
// own forced circular-icon-mask frame) auto-hid the instant the JS bundle
// finished its first render, which happens BEFORE this component's fade-in
// animation even starts. That left an uncontrolled gap: native icon frame
// -> (auto-hides) -> blank white flash -> this screen fades in from
// opacity 0. Preventing auto-hide and only hiding it once this component
// has actually mounted (see the onLayout below) closes that gap - the
// native frame now stays up until this screen is ready to take over, and
// the logo starts at full, settled opacity/scale (no fade-from-zero) so
// the handoff itself is invisible; the animation below is a secondary
// flourish on an already-visible screen, not part of the transition.
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

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
  // Assigned in useLayoutEffect rather than inline during render - mutating
  // a ref during render is what react-hooks/refs (React Compiler) flags,
  // since it can behave unexpectedly under Strict Mode's double-render or
  // concurrent rendering; a layout effect runs synchronously right after
  // commit, before the browser/native paints, so onCompleteRef.current is
  // still guaranteed current by the time anything can read it.
  const onCompleteRef = useRef(onComplete);
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // runOnJS requires a stable, top-level function reference - it captures/
  // schedules this closure to run back on the JS thread from the UI/worklet
  // thread. Passing an inline arrow defined *inside* the withTiming callback
  // (itself already running as a worklet) instead of a hoisted function is
  // what produced the "isHostFunction(runtime)" native crash: the callback
  // fires via Choreographer once the UI thread believes the exit animation
  // finished, but the ad hoc closure was never a valid, correctly-bound host
  // function against the JS runtime, so invoking it later aborts natively.
  const runOnComplete = useCallback(() => {
    onCompleteRef.current();
  }, []);

  // Big and responsive: width sized off the smaller screen dimension so it
  // reads as generous on a phone without ballooning past a sane cap on a
  // tablet; height derives from the cropped asset's real 909:840 aspect
  // ratio so the mascot+wordmark never stretches or distorts.
  const LOGO_ASPECT = 840 / 909;
  const logoWidth = Math.min(Math.min(SW, SH) * 0.72, 420);
  const logoHeight = logoWidth * LOGO_ASPECT;

  // Bug fix: these used to start at 0/0.85 and fade+scale in - fine on its
  // own, but combined with the native splash's uncontrolled auto-hide (see
  // the module-level preventAutoHideAsync above), the very first thing a
  // user saw on this screen was a blank gap then a fade-from-nothing,
  // right after a completely different-looking native icon frame. Starting
  // already fully visible/settled means the moment the native frame is
  // hidden (in the onLayout below), this screen is already showing its
  // final resting state - no second animation stacked on top of the
  // handoff. The subtle scale bounce is kept, but now overshoots FROM 1
  // rather than fading in TO 1, so it reads as a small flourish on an
  // already-present logo, not part of the transition itself.
  const logoO = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const footerO = useSharedValue(0);
  const rootO = useSharedValue(1);
  const nativeSplashHidden = useRef(false);

  const onRootLayout = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  // Safety net: onLayout should fire almost immediately (this view has no
  // async data dependency, just a require()'d local image), but if it
  // somehow never does, preventAutoHideAsync above would otherwise leave
  // the native splash stuck on screen forever - worse than the original
  // bug. Forces the same hide after a short ceiling.
  useEffect(() => {
    const t = setTimeout(onRootLayout, 800);
    return () => clearTimeout(t);
  }, [onRootLayout]);

  useEffect(() => {
    // Tiny pre-bounce so the spring below has somewhere to spring FROM,
    // without ever passing through a visibly "not yet arrived" state -
    // 0.97 is close enough to 1 that it never reads as a fade-in, just a
    // small settle.
    logoScale.value = 0.97;
    logoScale.value = withDelay(LOGO_DELAY, withSpring(1, { damping: 10, stiffness: 120 }));

    footerO.value = withDelay(FOOTER_DELAY, withTiming(1, { duration: 350, easing: ENT }));

    rootO.value = withDelay(
      EXIT_DELAY,
      withTiming(0, { duration: EXIT_MS, easing: EXT }, (finished) => {
        if (finished) runOnJS(runOnComplete)();
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
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      onLayout={onRootLayout}
    >
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
    ...StyleSheet.absoluteFill,
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
