import { Platform, type ViewStyle } from "react-native";

/** Soft elevation for booking cards and selected tabs */
export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 4 },
  default: {},
}) as ViewStyle;

/** Lighter shadow for segmented tab control */
export const tabShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 3 },
  default: {},
}) as ViewStyle;
