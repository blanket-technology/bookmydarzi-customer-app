import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, SPACING } from "../../../constants/theme";

interface Props {
  title: string;
  /** Overrides the default router.back() - use for a screen that should
   * navigate somewhere specific instead of just popping the stack. */
  onBack?: () => void;
  /** Optional right-side slot - a text action ("Mark all"), an icon button,
   * or nothing (defaults to a same-width spacer so the title stays centered). */
  right?: ReactNode;
}

/** Shared back-button + title header. Title uses a standard 17px/700 screen-
 * title treatment (not the 18/800 near-heading weight some screens used
 * individually - that read too heavy/loud for a recurring nav element).
 * Extracted so every screen shares one header instead of each re-declaring
 * its own title font size/weight/spacing. */
export default function ScreenHeader({ title, onBack, right }: Props) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.black} style={styles.backIcon} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.offWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    // "arrow-back" isn't visually centered in its own glyph box - it sits
    // slightly right/high, which reads as "off-center" inside a circular
    // button. Nudge it back to true-center instead of leaving it looking
    // misaligned against the circle around it.
    marginRight: 1.5,
  },
  title: { flex: 1, fontSize: 17, fontWeight: "700", color: COLORS.black, marginHorizontal: SPACING.sm },
  spacer: { width: 36 },
});
