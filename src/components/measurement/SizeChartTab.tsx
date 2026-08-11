/**
 * Size Chart tab - table of standard sizes vs measurement values, with the
 * customer's saved-profile recommendation (if any) highlighted, and a unit
 * toggle. Reuses the app's existing template/size logic entirely
 * (augmentTemplateWithStandardSizes, getOrderedTemplateFields) - no
 * duplicate size-table logic.
 */
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../constants/theme";
import type { ApiMeasurement } from "../../types/api";
import type { MeasurementTemplate } from "../../types/measurementTemplate";
import { getOrderedTemplateFields } from "../../utils/measurementSize";
import { formatMeasurementValue, type MeasurementUnit } from "../../utils/measurementUnits";
import { findRecommendedSizeCode } from "../../utils/recommendedSize";

export interface SizeChartTabProps {
  template: MeasurementTemplate;
  unit: MeasurementUnit;
  onToggleUnit: () => void;
  recommendedProfile: ApiMeasurement | null;
  /** When omitted the chart is view-only - rows are not selectable
   * (Bug Report cycle 1, item 12.1). */
  onSelectSize?: (sizeCode: string) => void;
}

export default function SizeChartTab({
  template,
  unit,
  onToggleUnit,
  recommendedProfile,
  onSelectSize,
}: SizeChartTabProps) {
  const fields = useMemo(() => getOrderedTemplateFields(template), [template]);
  const customCode = template.custom_size_code || "CUSTOM";
  const sizeCodes = template.size_display_order.filter((s) => s !== customCode);

  const recommendedCode = useMemo(() => {
    if (!recommendedProfile) return null;
    return findRecommendedSizeCode(template, recommendedProfile);
  }, [template, recommendedProfile]);

  if (sizeCodes.length === 0 || fields.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Size chart not available yet</Text>
        <Text style={styles.emptySub}>
          This garment doesn&apos;t have a standard size chart. You can still add your own
          measurements in the My Measurements tab, or book a home measurement below.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Unit toggle - a real segmented control (Inches | Centimeters), not a
          single flip-pill. The active half is highlighted so both units are
          always visible and the current one is obvious at a glance. */}
      <View style={styles.unitRow}>
        <Text style={styles.unitLabel}>Showing values in</Text>
        <View style={styles.unitSegment}>
          {(["in", "cm"] as const).map((u) => {
            const active = unit === u;
            return (
              <TouchableOpacity
                key={u}
                onPress={() => {
                  if (!active) onToggleUnit();
                }}
                style={[styles.unitSegmentBtn, active && styles.unitSegmentBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={u === "in" ? "Show inches" : "Show centimeters"}
                activeOpacity={0.85}
              >
                <Text style={[styles.unitSegmentText, active && styles.unitSegmentTextActive]}>
                  {u === "in" ? "Inches" : "Centimeters"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        persistentScrollbar
        contentContainerStyle={styles.tableScroll}
      >
        <View>
          {/* Header row */}
          <View style={[styles.row, styles.headerRow]}>
            <View style={[styles.cell, styles.headerCell, styles.labelCol]}>
              <Text style={styles.headerText}>Size</Text>
            </View>
            {fields.map((field) => (
              <View key={field.field_key} style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText} numberOfLines={2}>{field.label}</Text>
              </View>
            ))}
          </View>

          {/* Size rows. View-only when onSelectSize is omitted (item 12.1):
              rows render as plain, non-interactive Views. */}
          {sizeCodes.map((sizeCode, rowIdx) => {
            const entry = template.size_templates.find((s) => s.size_code === sizeCode);
            const isRecommended = sizeCode === recommendedCode;
            const isEven = rowIdx % 2 === 0;
            const rowInner = (
              <>
                <View style={[styles.cell, styles.labelCol]}>
                  <Text style={[styles.sizeText, isRecommended && styles.sizeTextRecommended]}>
                    {sizeCode}
                  </Text>
                  {isRecommended ? <View style={styles.recommendDot} /> : null}
                </View>
                {fields.map((field) => {
                  const raw = entry?.measurements[field.field_key];
                  return (
                    <View key={field.field_key} style={styles.cell}>
                      <Text style={styles.valueText}>
                        {raw != null
                          ? formatMeasurementValue(raw, field.unit === "cm" ? "cm" : "in", unit)
                          : "-"}
                      </Text>
                    </View>
                  );
                })}
              </>
            );
            const rowStyle = [
              styles.row,
              isEven && styles.rowEven,
              isRecommended && styles.rowRecommended,
            ];
            return onSelectSize ? (
              <TouchableOpacity
                key={sizeCode}
                style={rowStyle}
                onPress={() => onSelectSize(sizeCode)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Select size ${sizeCode}`}
              >
                {rowInner}
              </TouchableOpacity>
            ) : (
              <View key={sizeCode} style={rowStyle}>
                {rowInner}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  unitLabel: { ...TYPOGRAPHY.body.sm, color: COLORS.gray },
  // Segmented unit control (Inches | Centimeters)
  unitSegment: {
    flexDirection: "row",
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.full,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.grayBorder,
  },
  unitSegmentBtn: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  unitSegmentBtnActive: {
    backgroundColor: COLORS.primaryDark,
    ...Platform.select({
      ios: { shadowColor: "#0c6c75", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  unitSegmentText: { ...TYPOGRAPHY.label.md, color: COLORS.gray, fontSize: 12 },
  unitSegmentTextActive: { color: COLORS.white, fontWeight: "800" },
  tableScroll: { paddingBottom: SPACING.sm },
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  headerRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
  },
  rowEven: { backgroundColor: "rgba(0,0,0,0.015)" },
  rowRecommended: { backgroundColor: "rgba(12,108,117,0.08)" },
  cell: {
    width: 84,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  labelCol: {
    width: 72,
    paddingLeft: SPACING.md,
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
  },
  headerCell: { backgroundColor: COLORS.offWhite, minHeight: 48 },
  headerText: { ...TYPOGRAPHY.label.md, color: COLORS.gray, textAlign: "center", fontSize: 12 },
  sizeText: { ...TYPOGRAPHY.label.lg, color: COLORS.black },
  sizeTextRecommended: { color: COLORS.primaryDark },
  recommendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primaryDark,
  },
  valueText: { ...TYPOGRAPHY.body.sm, color: COLORS.black },
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
