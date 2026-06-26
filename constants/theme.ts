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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
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
