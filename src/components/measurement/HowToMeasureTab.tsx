/**
 * How to Measure tab - per-field instructions with a body-outline diagram
 * that highlights where each measurement is taken. Falls back to generic
 * instructions (GENERIC_MEASUREMENT_INSTRUCTIONS) whenever the service's
 * own admin-authored guide content isn't populated yet - verified against
 * live production data that this is the common case today, so the tab must
 * be useful without it, not just when catalog data happens to exist.
 */
import { Image } from "expo-image";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../constants/theme";
import type { MeasurementGuide } from "../../types/measurementTemplate";
import type { MeasurementTemplate } from "../../types/measurementTemplate";
import { GENERIC_MEASUREMENT_INSTRUCTIONS } from "../../utils/measurementInstructions";
import { getOrderedTemplateFields } from "../../utils/measurementSize";
import type { MeasurementValueKey } from "../../utils/measurementInput";
import BodyOutlineDiagram, { STAGE_BG, type DiagramGender } from "./BodyOutlineDiagram";

export interface HowToMeasureTabProps {
  template: MeasurementTemplate;
  guide: MeasurementGuide | null;
  guideLoading: boolean;
  /** Which silhouette to draw - female vs the neutral/male outline. */
  diagramGender?: DiagramGender;
}

export default function HowToMeasureTab({ template, guide, guideLoading, diagramGender }: HowToMeasureTabProps) {
  const fields = getOrderedTemplateFields(template);
  const [activeKey, setActiveKey] = useState<string | null>(fields[0]?.field_key ?? null);

  if (fields.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No measurement fields for this garment</Text>
        <Text style={styles.emptySub}>
          Add your measurements directly, or book a home measurement below.
        </Text>
      </View>
    );
  }

  const activeField = fields.find((f) => f.field_key === activeKey) ?? fields[0];
  const diagramKey = (activeField.user_measurement_field ?? activeField.field_key) as MeasurementValueKey;
  const genericText = GENERIC_MEASUREMENT_INSTRUCTIONS[diagramKey];

  // Garment illustration is driven by which fields the template has (pants vs
  // shirt vs body), not by the tapped chip - all measurement guides are shown
  // at once (Myntra style), so it doesn't change per selection.
  const fieldKeys = fields.map(
    (f) => (f.user_measurement_field ?? f.field_key) as string,
  );

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
      <Text style={styles.tabHeading}>How to Measure</Text>
      <Text style={styles.tabSubheading}>
        Find your size in the chart above. Here&apos;s where each measurement is taken:
      </Text>

      {/* Admin-authored guide image wins when present; otherwise the built-in
          Myntra-style garment diagram with all labelled measurement lines. */}
      {guide?.image_url ? (
        <Image
          source={{ uri: guide.image_url }}
          style={styles.guideImage}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.diagramStage}>
          <BodyOutlineDiagram
            fieldKeys={fieldKeys}
            gender={diagramGender}
            garmentName={template.service_name}
            size={280}
          />
        </View>
      )}

      <View style={styles.fieldChipsRow}>
        {fields.map((field) => {
          const isActive = field.field_key === activeField.field_key;
          return (
            <TouchableOpacity
              key={field.field_key}
              style={[styles.fieldChip, isActive && styles.fieldChipActive]}
              onPress={() => setActiveKey(field.field_key)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`How to measure ${field.label}`}
            >
              <Text style={[styles.fieldChipText, isActive && styles.fieldChipTextActive]}>
                {field.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.instructionCard}>
        <Text style={styles.instructionTitle}>{activeField.label}</Text>
        {guideLoading ? (
          <Text style={styles.instructionText}>Loading instructions…</Text>
        ) : (
          <Text style={styles.instructionText}>
            {guide?.instructions?.trim() || genericText || "Measure this area carefully with a flexible tape, keeping it snug but not tight."}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabHeading: {
    ...TYPOGRAPHY.heading.h2,
    color: COLORS.black,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  tabSubheading: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.gray,
    paddingHorizontal: SPACING.md,
    marginTop: 2,
    lineHeight: 18,
  },
  diagramStage: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: STAGE_BG,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  guideImage: {
    width: "100%",
    height: 180,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  fieldChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  fieldChip: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
    backgroundColor: COLORS.white,
  },
  fieldChipActive: { borderColor: COLORS.primaryDark, backgroundColor: COLORS.primaryLight },
  fieldChipText: { ...TYPOGRAPHY.label.md, color: COLORS.gray },
  fieldChipTextActive: { color: COLORS.primaryDark },
  instructionCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.offWhite,
  },
  instructionTitle: { ...TYPOGRAPHY.heading.h3, color: COLORS.black, marginBottom: SPACING.xs },
  instructionText: { ...TYPOGRAPHY.body.md, color: COLORS.gray, lineHeight: 21 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
  },
  emptyTitle: { ...TYPOGRAPHY.heading.h3, color: COLORS.black, textAlign: "center", marginBottom: SPACING.xs },
  emptySub: { ...TYPOGRAPHY.body.md, color: COLORS.gray, textAlign: "center" },
});
