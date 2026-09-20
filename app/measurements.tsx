/**
 * Measurements Screen
 *
 * Standalone Profile-page feature (mirrors app/address.tsx's list/form
 * shape) - a customer can VIEW and EDIT their own measurement profile(s).
 * Deliberately no create/delete here: a profile is created by Bridge/
 * employee at pickup (bmdadmin's MeasurementManageSheet.tsx writes to the
 * same USER_MEASUREMENTS table via the same GET /users/measurements this
 * screen reads), so a customer edit is immediately visible to Bridge/
 * Tailor/Admin the next time they load that order/profile - there is no
 * separate sync step, both sides read the one row.
 *
 * NOT wired into checkout/order flow: no booking-flow params, no
 * "continue to checkout" footer, nothing here is read by cart/order
 * creation. Field sets shown per category (Men's/Women's/Kids'/Other)
 * come from GET /users/measurements/form-defaults so the field logic
 * lives in one place (backend) instead of being duplicated client-side.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import ScreenHeader from "../src/components/common/ScreenHeader";
import ErrorState from "../src/components/common/ErrorState";
import { useHardwareBackHandler } from "../src/hooks/useHardwareBackHandler";
import type { ApiMeasurement, MeasurementGender } from "../src/services/measurementService";
import { useMeasurementStore } from "../src/store/useMeasurementStore";
import { useToastStore } from "../src/store/useToastStore";

const GENDER_LABELS: Record<string, string> = {
  male: "Men's",
  female: "Women's",
  kids: "Kids'",
  other: "Other",
};

const GENDER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  male: "man-outline",
  female: "woman-outline",
  kids: "happy-outline",
  other: "person-outline",
};

// Fallback if form-defaults hasn't loaded yet (offline/first paint) - a
// reasonable general set, not category-specific. The real per-category
// sets come from the backend once fetchFormDefaults resolves.
const DEFAULT_FIELDS = [
  { key: "chest", label: "Chest", unit: "in" },
  { key: "waist", label: "Waist", unit: "in" },
  { key: "hips", label: "Hips", unit: "in" },
  { key: "shoulder", label: "Shoulder", unit: "in" },
  { key: "height", label: "Height", unit: "in" },
];

const FIT_OPTIONS: { key: string; label: string }[] = [
  { key: "slim", label: "Slim" },
  { key: "regular", label: "Regular" },
  { key: "loose", label: "Loose" },
];

type FieldValues = Record<string, string>;

function SavedMeasurementCard({
  measurement,
  onEdit,
}: {
  measurement: ApiMeasurement;
  onEdit: () => void;
}) {
  const gender = measurement.gender ?? "other";
  const summary = [
    measurement.chest != null ? `Chest ${measurement.chest}"` : null,
    measurement.waist != null ? `Waist ${measurement.waist}"` : null,
    measurement.hips != null ? `Hips ${measurement.hips}"` : null,
    measurement.height != null ? `Height ${measurement.height}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TouchableOpacity style={styles.savedCard} onPress={onEdit} activeOpacity={0.7}>
      <View style={styles.savedCardLeft}>
        <View style={styles.savedTypeIcon}>
          <Ionicons
            name={GENDER_ICONS[gender] ?? "person-outline"}
            size={16}
            color={COLORS.primaryDark}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.savedCardHeader}>
            <Text style={styles.savedCardName}>{measurement.profile_name}</Text>
            {measurement.is_default ? (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.savedCardSub}>{GENDER_LABELS[gender] ?? "General"}</Text>
          {summary ? (
            <Text style={styles.savedCardSummary} numberOfLines={2}>
              {summary}
            </Text>
          ) : (
            <Text style={styles.savedCardSummaryMuted}>No measurements recorded yet</Text>
          )}
        </View>
      </View>
      <Ionicons name="pencil-outline" size={18} color={COLORS.primaryDark} />
    </TouchableOpacity>
  );
}

export default function MeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    measurements,
    formDefaults,
    loading,
    saving,
    fetchMeasurements,
    fetchFormDefaults,
    editMeasurement,
    error,
  } = useMeasurementStore();

  type Mode = "select" | "form";
  const [mode, setMode] = useState<Mode>("select");
  const [editingId, setEditingId] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollToForm, setScrollToForm] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [gender, setGender] = useState<MeasurementGender | null>(null);
  const [values, setValues] = useState<FieldValues>({});
  const [fitPreference, setFitPreference] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      fetchMeasurements();
      fetchFormDefaults();
    }, [fetchMeasurements, fetchFormDefaults]),
  );

  const activeFields = useMemo(() => {
    if (!gender) return [];
    return formDefaults?.fields_by_gender?.[gender] ?? DEFAULT_FIELDS;
  }, [gender, formDefaults]);

  const genderOptions = formDefaults?.genders ?? ["male", "female", "kids", "other"];

  const resetForm = useCallback(() => {
    setEditingId(null);
    setProfileName("");
    setGender(null);
    setValues({});
    setFitPreference(null);
    setNotes("");
    setFieldErrors({});
  }, []);

  const returnToSelect = useCallback(() => {
    resetForm();
    setMode("select");
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  }, [resetForm]);

  useHardwareBackHandler(
    useCallback(() => {
      if (mode !== "form") return false;
      returnToSelect();
      return true;
    }, [mode, returnToSelect]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (mode !== "form") return;
      e.preventDefault();
      returnToSelect();
    });
    return unsubscribe;
  }, [navigation, mode, returnToSelect]);

  useEffect(() => {
    if (!scrollToForm || mode !== "form") return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setScrollToForm(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [scrollToForm, mode]);

  const loadIntoForm = (m: ApiMeasurement) => {
    setEditingId(m.id);
    setProfileName(m.profile_name);
    setGender((m.gender as MeasurementGender) ?? null);
    const nextValues: FieldValues = {};
    for (const key of ["chest", "waist", "hips", "shoulder", "neck", "sleeve_length", "inseam", "height"] as const) {
      const v = m[key];
      if (v != null) nextValues[key] = String(v);
    }
    setValues(nextValues);
    setFitPreference(m.fit_preference ?? null);
    setNotes(m.notes ?? "");
    setFieldErrors({});
    setMode("form");
    setScrollToForm(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!profileName.trim()) errs.profileName = "Give this profile a name";
    if (!gender) errs.gender = "Select a category";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const numOrUndefined = (v: string | undefined): number | undefined => {
    if (!v?.trim()) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const handleSave = async () => {
    if (!validate() || editingId == null) return;

    const payload = {
      profile_name: profileName.trim(),
      gender,
      chest: numOrUndefined(values.chest),
      waist: numOrUndefined(values.waist),
      hips: numOrUndefined(values.hips),
      shoulder: numOrUndefined(values.shoulder),
      neck: numOrUndefined(values.neck),
      sleeve_length: numOrUndefined(values.sleeve_length),
      inseam: numOrUndefined(values.inseam),
      height: numOrUndefined(values.height),
      fit_preference: fitPreference,
      notes: notes.trim() || undefined,
    };

    const saved = await editMeasurement(editingId, payload);

    if (saved) {
      useToastStore.getState().show("Measurement Updated");
      returnToSelect();
    } else {
      Alert.alert("Error", error ?? "Failed to update measurement.");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Measurements"
          onBack={mode === "form" ? returnToSelect : undefined}
        />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, mode === "form" && styles.scrollWithStickyFooter]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroBanner}>
            <LinearGradient
              colors={["#0c6c75", "#1aa3b0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <Ionicons name="body-outline" size={36} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroTitle}>Your Measurements</Text>
              <Text style={styles.heroSub}>
                {mode === "form"
                  ? "Correct anything that's changed - your tailor will use the latest values"
                  : "Recorded by our team at pickup - keep it up to date if anything changes"}
              </Text>
            </LinearGradient>
          </Animated.View>

          {mode === "form" ? (
            <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.card}>
              <Text style={styles.cardTitle}>Edit Measurement</Text>

              <Text style={styles.fieldLabel}>
                Profile Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, fieldErrors.profileName ? styles.inputError : null]}
                value={profileName}
                onChangeText={setProfileName}
                placeholder="e.g. My Shirt Size, Dad's Kurta"
                placeholderTextColor={COLORS.gray}
              />
              {fieldErrors.profileName ? (
                <Text style={styles.errorText}>{fieldErrors.profileName}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>
                Category <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {genderOptions.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, gender === g && styles.chipActive]}
                    onPress={() => setGender(g as MeasurementGender)}
                  >
                    <Ionicons
                      name={GENDER_ICONS[g] ?? "person-outline"}
                      size={14}
                      color={gender === g ? COLORS.white : COLORS.gray}
                    />
                    <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                      {GENDER_LABELS[g] ?? g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {fieldErrors.gender ? (
                <Text style={styles.errorText}>{fieldErrors.gender}</Text>
              ) : null}

              {!gender ? (
                <Text style={styles.hintText}>
                  Select a category to show the right fields.
                </Text>
              ) : (
                <>
                  {activeFields.reduce<React.ReactNode[]>((rows, field, i) => {
                    if (i % 2 === 0) {
                      const next = activeFields[i + 1];
                      rows.push(
                        <View key={field.key} style={styles.rowGroup}>
                          <View style={styles.inputHalf}>
                            <Text style={styles.fieldLabel}>{field.label} (in)</Text>
                            <TextInput
                              style={styles.input}
                              value={values[field.key] ?? ""}
                              onChangeText={(t) => setValues((v) => ({ ...v, [field.key]: t }))}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor={COLORS.gray}
                            />
                          </View>
                          {next ? (
                            <View style={styles.inputHalf}>
                              <Text style={styles.fieldLabel}>{next.label} (in)</Text>
                              <TextInput
                                style={styles.input}
                                value={values[next.key] ?? ""}
                                onChangeText={(t) => setValues((v) => ({ ...v, [next.key]: t }))}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={COLORS.gray}
                              />
                            </View>
                          ) : (
                            <View style={styles.inputHalf} />
                          )}
                        </View>,
                      );
                    }
                    return rows;
                  }, [])}

                  <Text style={styles.fieldLabel}>Fit Preference</Text>
                  <View style={styles.chipRow}>
                    {FIT_OPTIONS.map((f) => (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.chip, fitPreference === f.key && styles.chipActive]}
                        onPress={() =>
                          setFitPreference((prev) => (prev === f.key ? null : f.key))
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            fitPreference === f.key && styles.chipTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    style={styles.input}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional"
                    placeholderTextColor={COLORS.gray}
                  />
                </>
              )}
            </Animated.View>
          ) : null}

          {mode === "select" ? (
            loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading measurements...</Text>
              </View>
            ) : error && measurements.length === 0 ? (
              <ErrorState message={error} onRetry={() => fetchMeasurements()} />
            ) : measurements.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.card}>
                <Text style={styles.cardTitle}>Saved Measurements</Text>
                {measurements.map((m) => (
                  <SavedMeasurementCard
                    key={m.id}
                    measurement={m}
                    onEdit={() => loadIntoForm(m)}
                  />
                ))}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.card}>
                <Text style={styles.cardTitle}>Saved Measurements</Text>
                <View style={styles.emptyWrap}>
                  <Ionicons name="body-outline" size={48} color={COLORS.grayBorder} />
                  <Text style={styles.emptyTitle}>No measurements yet</Text>
                  <Text style={styles.emptyDesc}>
                    Our Bridge team records your measurements when they pick up your order.
                    Once they do, you can view and edit them here.
                  </Text>
                </View>
              </Animated.View>
            )
          ) : null}

          <View style={{ height: mode === "form" ? SPACING.lg : SPACING.xxl }} />
        </ScrollView>

        {mode === "form" ? (
          <View
            style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}
          >
            <TouchableOpacity
              style={[styles.stickySaveBtn, saving && styles.stickySaveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={saving}
              activeOpacity={0.88}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.white} />
                  <Text style={styles.stickySaveBtnText}>Update Measurement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: COLORS.offWhite },

  scroll: { padding: SPACING.lg },
  scrollWithStickyFooter: { paddingBottom: 100 },

  heroBanner: { borderRadius: RADIUS.xl, overflow: "hidden", marginBottom: SPACING.lg, ...SHADOW.card },
  heroGradient: { padding: SPACING.lg, alignItems: "center", gap: SPACING.sm },
  heroTitle: { fontSize: 18, fontWeight: "800", color: COLORS.white, textAlign: "center" },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 18 },

  loadingWrap: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.lg },
  loadingText: { fontSize: 14, color: COLORS.gray },

  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.card },
  cardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },

  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  savedCardLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: SPACING.sm },
  savedTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  savedCardHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: 2 },
  savedCardName: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  defaultBadge: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 10, fontWeight: "600", color: COLORS.primaryDark },
  savedCardSub: { fontSize: 12, fontWeight: "600", color: COLORS.primaryDark, marginBottom: 2 },
  savedCardSummary: { fontSize: 12, color: COLORS.gray, lineHeight: 17 },
  savedCardSummaryMuted: { fontSize: 12, color: COLORS.grayBorder, fontStyle: "italic" },

  emptyWrap: { alignItems: "center", paddingVertical: SPACING.lg, gap: SPACING.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptyDesc: { fontSize: 13, color: COLORS.gray, textAlign: "center", lineHeight: 18 },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.black, marginBottom: 6, marginTop: SPACING.sm },
  required: { color: COLORS.error },
  hintText: { fontSize: 12, color: COLORS.gray, marginTop: SPACING.sm },

  input: {
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 46,
    fontSize: 14,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },

  rowGroup: { flexDirection: "row", gap: SPACING.sm },
  inputHalf: { flex: 1 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  chipActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },
  chipTextActive: { color: COLORS.white },

  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  stickySaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    height: 56,
    ...SHADOW.card,
  },
  stickySaveBtnDisabled: { opacity: 0.6 },
  stickySaveBtnText: { fontSize: 16, fontWeight: "800", color: COLORS.white },
});
