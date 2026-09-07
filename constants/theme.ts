/**
 * Typography scale - use these instead of hardcoding fontSize/fontWeight.
 * Keeps the visual hierarchy consistent across every screen.
 */
export const TYPOGRAPHY = {
  display: {
    lg:  { fontSize: 28, fontWeight: "800" as const, lineHeight: 34, letterSpacing: -0.6 },
    md:  { fontSize: 22, fontWeight: "800" as const, lineHeight: 28, letterSpacing: -0.4 },
    sm:  { fontSize: 18, fontWeight: "800" as const, lineHeight: 24, letterSpacing: -0.3 },
  },
  heading: {
    h1:  { fontSize: 24, fontWeight: "700" as const, lineHeight: 30, letterSpacing: -0.4 },
    h2:  { fontSize: 20, fontWeight: "700" as const, lineHeight: 26, letterSpacing: -0.3 },
    h3:  { fontSize: 17, fontWeight: "700" as const, lineHeight: 22, letterSpacing: -0.2 },
  },
  body: {
    lg:  { fontSize: 16, fontWeight: "400" as const, lineHeight: 25 },
    md:  { fontSize: 14, fontWeight: "400" as const, lineHeight: 21 },
    sm:  { fontSize: 12, fontWeight: "400" as const, lineHeight: 17 },
  },
  label: {
    lg:  { fontSize: 13, fontWeight: "700" as const, lineHeight: 18, letterSpacing: -0.1 },
    md:  { fontSize: 11, fontWeight: "700" as const, lineHeight: 14, letterSpacing: 0.2 },
    sm:  { fontSize: 9,  fontWeight: "700" as const, lineHeight: 12, letterSpacing: 0.5 },
    caps:{ fontSize: 10, fontWeight: "700" as const, lineHeight: 13, letterSpacing: 1.4,
           textTransform: "uppercase" as const },
  },
} as const;

export const COLORS = {
  primary: "#1aa3b0",
  primaryDark: "#0c6c75",
  primaryLight: "#e0f7f8",
  gold: "#C9A84C",
  goldLight: "#F5E6C0",
  black: "#0D0D0D",
  darkBrown: "#2C1A0E",
  beige: "#F5EFE6",
  white: "#FFFFFF",
  offWhite: "#FAFAFA",
  gray: "#6B7280",
  grayLight: "#F3F4F6",
  grayBorder: "#E5E7EB",
  error: "#B91C1C",
  errorLight: "#FEE2E2",
  success: "#065F46",
  successLight: "#D1FAE5",
  overlay: "rgba(0,0,0,0.45)",
  cardShadow: "rgba(0,0,0,0.10)",
};

export const FONTS = {
  regular: { fontWeight: "400" as const },
  medium: { fontWeight: "500" as const },
  semiBold: { fontWeight: "600" as const },
  bold: { fontWeight: "700" as const },
  extraBold: { fontWeight: "800" as const },
};

export const RADIUS = {
  xs:   4,    // tags, small badges
  sm:   8,    // inputs, icon buttons
  md:   12,   // list items, content cards
  lg:   16,   // feature cards
  xl:   22,   // large cards
  xxl:  28,   // hero cards, bottom sheets
  full: 999,  // pills, circles
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const SHADOW = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  strong: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
};
