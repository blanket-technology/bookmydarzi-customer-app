import { useCallback, useEffect, useRef } from "react";
import { useSharedValue, withTiming, Easing, type SharedValue } from "react-native-reanimated";

const HIDE_AFTER_MS = 1800;
const FADE_DURATION = 220;

/**
 * Drives an opacity SharedValue that starts visible, fades out after a
 * period of scroll inactivity, and fades back in the moment the user
 * touches/scrolls again - used for carousel nav arrows that shouldn't
 * clutter the view once a user has settled on a position, but should
 * reappear as soon as they start interacting again.
 *
 * Call `notifyActivity()` from onScroll/onTouchStart/onPressIn handlers.
 */
export function useAutoHideOpacity(): {
  opacity: SharedValue<number>;
  notifyActivity: () => void;
} {
  const opacity = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifyActivity = useCallback(() => {
    opacity.value = withTiming(1, { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) });
    }, HIDE_AFTER_MS);
  }, [opacity]);

  useEffect(() => {
    notifyActivity();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { opacity, notifyActivity };
}
