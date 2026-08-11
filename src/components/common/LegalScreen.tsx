/**
 * Shared layout for simple static-content screens (Privacy, Terms, About) -
 * one header + scrollable section list, avoids duplicating the same
 * boilerplate three times for what's otherwise identical structure.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../../../constants/theme";

export interface LegalSection {
  heading: string;
  /** Optional intro paragraph. Omit when the section is purely a bullet list. */
  body?: string;
  /** Optional bullet points rendered below the body - used for service /
   * feature lists on richer content pages (e.g. About). */
  bullets?: string[];
}

interface Props {
  title: string;
  updatedLabel?: string;
  sections: LegalSection[];
}

export default function LegalScreen({ title, updatedLabel, sections }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.offWhite, paddingTop: insets.top }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {updatedLabel ? <Text style={styles.updated}>{updatedLabel}</Text> : null}
        {sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading}>{s.heading}</Text>
            {s.body ? <Text style={styles.body}>{s.body}</Text> : null}
            {s.bullets?.length ? (
              <View style={styles.bulletList}>
                {s.bullets.map((b, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.offWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.black, flex: 1, textAlign: "center" },
  updated: { fontSize: 12, color: COLORS.gray, marginBottom: SPACING.md, fontStyle: "italic" },
  section: { marginBottom: SPACING.lg },
  heading: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginBottom: 6 },
  body: { fontSize: 13, color: COLORS.gray, lineHeight: 20 },
  bulletList: { marginTop: 8, gap: 7 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primaryDark,
    marginTop: 7,
  },
  bulletText: { flex: 1, fontSize: 13, color: COLORS.gray, lineHeight: 20 },
});
