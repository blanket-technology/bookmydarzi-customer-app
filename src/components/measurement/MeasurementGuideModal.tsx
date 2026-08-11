/**
 * Measurement Guide - full-screen modal opened from Service Details, with a
 * sticky 3-tab layout (Size Chart / How to Measure / My Measurements).
 *
 * Reuses existing infrastructure end-to-end:
 *  - fetchMeasurementTemplate (already used by app/measurement.tsx) for the
 *    Size Chart tab, falling back to buildLegacyMeasurementTemplate when the
 *    service has no backend-seeded fields (verified this is the common case
 *    in production today).
 *  - fetchMeasurementGuide (new, thin wrapper - the backend endpoint
 *    already existed and was unused by any frontend code).
 *  - useMeasurementStore (already has full CRUD) for My Measurements.
 *  - useNetworkStatus (already mounted app-wide) for offline handling.
 *
 * Does not replace app/measurement.tsx - "Add new" / "Edit" both hand off
 * to that existing, battle-tested flow rather than duplicating its form.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../constants/theme";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import {
  fetchMeasurementGuide,
  fetchMeasurementTemplate,
} from "../../services/measurementTemplateService";
import { useMeasurementStore } from "../../store/useMeasurementStore";
import type { ApiMeasurement } from "../../types/api";
import type {
  MeasurementGuide,
  MeasurementTemplate,
} from "../../types/measurementTemplate";
import { measurementGenderMatches, type CategoryGender } from "../../utils/categoryGender";
import {
  augmentTemplateWithStandardSizes,
  buildLegacyMeasurementTemplate,
} from "../../utils/measurementSize";
import type { MeasurementUnit } from "../../utils/measurementUnits";
import HowToMeasureTab from "./HowToMeasureTab";
import MyMeasurementsTab from "./MyMeasurementsTab";
import SizeChartTab from "./SizeChartTab";

type TabKey = "size-chart" | "how-to-measure" | "my-measurements";

const TABS: { key: TabKey; label: string }[] = [
  { key: "size-chart", label: "Size Chart" },
  { key: "how-to-measure", label: "How to Measure" },
  { key: "my-measurements", label: "My Measurements" },
];

export interface MeasurementGuideModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Omit when opening from a context with no specific garment (e.g. Profile
   * → My Measurements "Manage") - Size Chart and How to Measure need a real
   * service to fetch a template/guide for, so both are hidden and the modal
   * opens straight to My Measurements instead, which works standalone.
   */
  bookableServiceId?: number;
  /** Category name of the service being booked, e.g. "Women's Clothing" -
   * used only to pick male/female standard-size presets for the fallback
   * chart, same inference already used elsewhere (categoryGender.ts). */
  categoryName?: string | null;
  /** "kids"/null fall back to the male preset table for the standard-size
   * chart (no dedicated kids presets exist) - matches how the rest of the
   * app already treats "kids" as unisex/unrestricted for measurement
   * gender-filtering (see categoryGender.ts). */
  gender?: CategoryGender;
  /**
   * Override for the "Book Home Measurement" CTA - when the modal is
   * opened from inside app/measurement.tsx itself (the normal booking
   * path), this should call that screen's own skip-and-continue handler
   * directly rather than navigating to /measurement again, which would
   * just land back on the same choose screen the customer already left.
   * Falls back to a plain navigation to /measurement when omitted (e.g.
   * opened from Profile, where there's no in-progress booking to skip).
   */
  onBookHomeMeasurement?: () => void;
}

export default function MeasurementGuideModal({
  visible,
  onClose,
  bookableServiceId = 0,
  gender,
  onBookHomeMeasurement,
}: MeasurementGuideModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConnected, isResolved } = useNetworkStatus();
  const isOffline = isResolved && !isConnected;
  const hasServiceContext = bookableServiceId > 0;

  const [activeTab, setActiveTab] = useState<TabKey>(
    hasServiceContext ? "size-chart" : "my-measurements",
  );
  const [unit, setUnit] = useState<MeasurementUnit>("in");

  const [template, setTemplate] = useState<MeasurementTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [guide, setGuide] = useState<MeasurementGuide | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);

  const {
    measurements,
    loading: measurementsLoading,
    saving: measurementsSaving,
    error: measurementsError,
    fetchMeasurements,
    removeMeasurement,
  } = useMeasurementStore();

  const loadTemplate = useCallback(async () => {
    if (bookableServiceId <= 0 || isOffline) return;
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const fetched = await fetchMeasurementTemplate(bookableServiceId);
      // No dedicated kids preset table exists - "kids"/null both fall back
      // to the male standard-size presets (harmless default; the actual
      // measurement values still come from the customer's own input or the
      // service's real backend template when one exists).
      const effectiveGender: "male" | "female" = gender === "female" ? "female" : "male";
      const withFallback =
        fetched.fields.length > 0
          ? fetched
          : buildLegacyMeasurementTemplate(effectiveGender);
      setTemplate(augmentTemplateWithStandardSizes(withFallback, effectiveGender));
    } catch {
      setTemplateError("Couldn't load the size chart. Please try again.");
    } finally {
      setTemplateLoading(false);
    }
  }, [bookableServiceId, gender, isOffline]);

  const loadGuide = useCallback(async () => {
    if (bookableServiceId <= 0 || isOffline) return;
    setGuideLoading(true);
    try {
      const fetched = await fetchMeasurementGuide(bookableServiceId);
      setGuide(fetched);
    } catch {
      setGuide(null); // Silent - HowToMeasureTab already has a generic fallback.
    } finally {
      setGuideLoading(false);
    }
  }, [bookableServiceId, isOffline]);

  useEffect(() => {
    if (!visible) return;
    setActiveTab(hasServiceContext ? "size-chart" : "my-measurements");
    if (hasServiceContext) {
      void loadTemplate();
      void loadGuide();
    }
    void fetchMeasurements();
    // Only re-run when the modal opens or which service it's scoped to
    // changes - not on every loadTemplate/loadGuide identity change (those
    // already depend on bookableServiceId themselves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, hasServiceContext, bookableServiceId]);

  const recommendedProfile = useMemo(() => {
    const relevant = gender
      ? measurements.filter((m) => measurementGenderMatches(gender, m.gender))
      : measurements;
    return relevant.find((m) => m.is_default) ?? relevant[0] ?? null;
  }, [measurements, gender]);

  const handleSelectSize = useCallback(
    (sizeCode: string) => {
      onClose();
      router.push({
        pathname: "/measurement",
        params: { bookableServiceId: String(bookableServiceId), presetSize: sizeCode },
      } as never);
    },
    [onClose, router, bookableServiceId],
  );

  const handleAddNew = useCallback(() => {
    onClose();
    router.push({
      pathname: "/measurement",
      params: { bookableServiceId: String(bookableServiceId) },
    } as never);
  }, [onClose, router, bookableServiceId]);

  const handleEdit = useCallback(
    (measurement: ApiMeasurement) => {
      onClose();
      router.push({
        pathname: "/measurement",
        params: { bookableServiceId: String(bookableServiceId), editId: String(measurement.id) },
      } as never);
    },
    [onClose, router, bookableServiceId],
  );

  // "Book Home Measurement" doesn't need its own booking flow - the app
  // already collects measurements at doorstep pickup when none are given
  // upfront. When opened from inside the booking flow (onBookHomeMeasurement
  // provided), this calls that screen's own skip-and-continue handler so
  // the customer actually moves forward (to address/cart) instead of
  // landing back on the same choose screen they're already on. Only falls
  // back to a plain navigation when there's no in-progress booking to
  // continue (e.g. opened from Profile).
  const handleBookHomeMeasurement = useCallback(() => {
    onClose();
    if (onBookHomeMeasurement) {
      onBookHomeMeasurement();
      return;
    }
    router.push({
      pathname: "/measurement",
      params: { bookableServiceId: String(bookableServiceId) },
    } as never);
  }, [onClose, onBookHomeMeasurement, router, bookableServiceId]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Measurement Guide</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={COLORS.black} />
          </TouchableOpacity>
        </View>

        {/* Single-page guide (Bug Report cycle 1, item 12.1): the size chart
            (view-only, with the cm/inch toggle) followed directly by the
            How to Measure content, all in one scroll. The old Size Chart /
            How to Measure / My Measurements tab layout was removed - My
            Measurements is gone entirely, and the two remaining sections are
            stacked rather than switched. */}
        <View style={styles.content}>
          {isOffline ? (
            <View style={styles.stateWrap}>
              <Ionicons name="cloud-offline-outline" size={32} color={COLORS.gray} />
              <Text style={styles.stateText}>You&apos;re offline. Connect to the internet to load the guide.</Text>
            </View>
          ) : templateLoading ? (
            <LoadingState label="Loading measurement guide…" />
          ) : templateError ? (
            <ErrorState message={templateError} onRetry={loadTemplate} />
          ) : template ? (
            <Animated.View key="guide" entering={FadeIn.duration(200)} style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.singlePageContent}
              >
                {/* Size chart - view-only (no onSelectSize), horizontal scroll
                    for wide tables lives inside SizeChartTab. */}
                <SizeChartTab
                  template={template}
                  unit={unit}
                  onToggleUnit={() => setUnit((u) => (u === "in" ? "cm" : "in"))}
                  recommendedProfile={recommendedProfile}
                />

                {/* How to Measure - directly below the chart. The silhouette
                    matches the garment's gender (female vs neutral/male),
                    same inference used for the size-chart presets. */}
                <View style={styles.howToWrap}>
                  <HowToMeasureTab
                    template={template}
                    guide={guide}
                    guideLoading={guideLoading}
                    diagramGender={gender === "female" ? "female" : "male"}
                  />
                </View>
              </ScrollView>
            </Animated.View>
          ) : null}
        </View>

        {/* Premium CTA */}
        <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleBookHomeMeasurement}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            <Ionicons name="home-outline" size={16} color={COLORS.white} />
            <Text style={styles.ctaText}>
              Not sure? Book Home Measurement
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.stateWrap}>
      <ActivityIndicator color={COLORS.primaryDark} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <Ionicons name="alert-circle-outline" size={32} color={COLORS.error} />
      <Text style={styles.stateText}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.retryBtnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  headerTitle: { ...TYPOGRAPHY.heading.h2, color: COLORS.black },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3 },
      android: {},
    }),
  },
  tabBtn: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: COLORS.primaryDark },
  tabText: { ...TYPOGRAPHY.label.md, color: COLORS.gray, fontSize: 12.5 },
  tabTextActive: { color: COLORS.primaryDark, fontWeight: "800" },
  content: { flex: 1 },
  singlePageContent: { paddingBottom: SPACING.lg },
  howToWrap: { marginTop: SPACING.md },
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  stateText: { ...TYPOGRAPHY.body.md, color: COLORS.gray, textAlign: "center" },
  retryBtn: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryDark,
  },
  retryBtnText: { ...TYPOGRAPHY.label.lg, color: COLORS.white },
  ctaBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryDark,
  },
  ctaText: { ...TYPOGRAPHY.label.lg, color: COLORS.white, fontSize: 14 },
});
