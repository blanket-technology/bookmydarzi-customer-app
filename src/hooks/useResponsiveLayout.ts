import { useWindowDimensions } from "react-native";
import { SPACING } from "../../constants/theme";

/**
 * Shared responsive-layout values, extracted from the isTablet/
 * horizontalPad/contentMaxWidth pattern that was previously duplicated
 * inline (word-for-word) across the Home, Cart, and Signup screens - any
 * future tuning had to be repeated in every copy, and new screens either
 * skipped it or reinvented it slightly differently. This is the single
 * source of truth now; every screen should call this instead of
 * re-deriving these values itself.
 *
 * No dedicated tablet breakpoint constant exists elsewhere in the app -
 * 768 was already the value every screen independently chose (matches
 * the common 7"-9" tablet portrait-width breakpoint), so it's kept as-is
 * here rather than introducing a different number.
 */
export function useResponsiveLayout() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const isTablet = screenWidth >= 768;
  // Matches the Home screen's own existing threshold (iPhone SE/small
  // Android class) - pulled into the shared hook so any screen can react
  // to a genuinely narrow device, not just the tablet/phone split.
  const isSmallPhone = screenWidth < 360;
  const horizontalPad = isTablet
    ? Math.max(SPACING.lg, screenWidth * 0.05)
    : SPACING.lg;
  const contentMaxWidth = isTablet ? 720 : screenWidth;

  return {
    screenWidth,
    screenHeight,
    isTablet,
    isSmallPhone,
    horizontalPad,
    contentMaxWidth,
  };
}
