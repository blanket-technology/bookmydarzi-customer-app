/**
 * Measurement Screen
 *
 * Three options:
 *   1. Add Measurements Now  - fill the form, save, then add to cart
 *   2. Use Saved Measurements - pick from previously saved profiles
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useMeasurementSizeSelection } from "../src/hooks/useMeasurementSizeSelection";
import {
  getMeasurementById,
  getMeasurementFormDefaults,
} from "../src/services/measurementService";
import { fetchMeasurementTemplate } from "../src/services/measurementTemplateService";
import MeasurementGuideModal from "../src/components/measurement/MeasurementGuideModal";
import { useCartStore } from "../src/store/useCartStore";
import { useMeasurementStore } from "../src/store/useMeasurementStore";
import { useToastStore } from "../src/store/useToastStore";
import type { ApiMeasurement } from "../src/types/api";
import type { MeasurementTemplate } from "../src/types/measurementTemplate";
import { buildSelectedMeasurements } from "../src/utils/cartMeasurement";
import { inferGenderFromCategoryName, measurementGenderMatches } from "../src/utils/categoryGender";
import { capitalize, formatMeasurementEntries } from "../src/utils/measurementDisplay";
import { returnToPendingRouteAfterMeasurement } from "../src/utils/measurementReturnNavigation";
import {
  augmentTemplateWithStandardSizes,
  buildLegacyMeasurementTemplate,
  buildSavePayload,
  getOrderedTemplateFields,
  hasAtLeastOneTemplateMeasurement,
  validateTemplateFieldValues,
} from "../src/utils/measurementSize";
import { safeRouterPush, safeRouterReplace } from "../src/utils/safeNavigation";
import { useAuthStore } from "../store/useAuthStore";

const FIT_OPTIONS = ["slim", "regular", "relaxed", "oversized"];
const GENDER_OPTIONS = ["male", "female", "kids", "other"];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function MeasurementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    mode: modeParam,
    bookableServiceId: bookableServiceIdParam,
    editId: editIdParam,
    presetSize: presetSizeParam,
  } = useLocalSearchParams<{
    mode?: string;
    bookableServiceId?: string;
    /** Deep-link from the Measurement Guide modal's "Edit" action. */
    editId?: string;
    /** Deep-link from the Measurement Guide modal's "Select this size" action. */
    presetSize?: string;
  }>();

  const {
    saveMeasurement,
    editMeasurement,
    removeMeasurement,
    saving,
    error,
    measurements,
    fetchMeasurements,
    loading: loadingMeasurements,
  } = useMeasurementStore();
  const { pendingService, addServiceEntry, clearPendingService } = useCartStore();
  const pendingRoute = useCartStore((s) => s.pendingRoute);
  const bookingFlowActive = useCartStore((s) => s.bookingFlowActive);
  const buyNowMode = useCartStore((s) => s.buyNowMode);
  const clearBuyNowMode = useCartStore((s) => s.clearBuyNowMode);
  const pendingBookingMeasurement = useCartStore((s) => s.pendingBookingMeasurement);
  const setPendingBookingMeasurement = useCartStore(
    (s) => s.setPendingBookingMeasurement,
  );
  const returningToServiceDetails = pendingRoute === "/service-details";
  const user = useAuthStore((s) => s.user);

  // "choose" = pick an option | "add" = fill new form | "saved" = pick from list
  const [mode, setMode] = useState<"choose" | "add" | "saved">("choose");
  const [measurementGuideVisible, setMeasurementGuideVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [cartSyncing, setCartSyncing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToTop = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

  const getDefaultProfileLabel = useCallback(() => {
    const first =
      user?.first_name?.trim() || user?.name?.split(/\s+/)[0]?.trim() || "";
    return first ? `${first}'s Measurements` : "";
  }, [user]);

  // New measurement form state
  const [profileName, setProfileName] = useState("");
  const [gender, setGender] = useState("male");
  const [fitPreference, setFitPreference] = useState("regular");
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fetchedTemplate, setFetchedTemplate] =
    useState<MeasurementTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [pendingEditMeasurement, setPendingEditMeasurement] =
    useState<ApiMeasurement | null>(null);

  const legacyTemplate = useMemo(() => buildLegacyMeasurementTemplate(gender), [gender]);

  const bookableServiceId = useMemo(() => {
    const fromParam = parseInt(String(bookableServiceIdParam ?? ""), 10);
    if (fromParam > 0) return fromParam;
    return pendingService?.bookableServiceId ?? 0;
  }, [bookableServiceIdParam, pendingService?.bookableServiceId]);

  // If the backend template has no fields (service not seeded), fall back to legacy fields.
  // fetchedTemplate?.service_name is still used directly for the header subtitle.
  const activeTemplate = (fetchedTemplate?.fields?.length ?? 0) > 0 ? fetchedTemplate! : legacyTemplate;

  // Which gender this booking's category is for, inferred from the category
  // name (e.g. "Women's Clothing" -> female) - null for non-gender-specific
  // categories (Kids, Alterations, etc), and also null outside an active
  // booking flow. Drives both the saved-measurement list filter and the "Add
  // New" gender chip below, so a customer booking a women's-only garment can
  // never attach/create a male profile for it. Gated on `bookingFlowActive`
  // rather than `pendingService` alone - pendingService is global cart state
  // that can still be populated from an abandoned booking flow (e.g. the user
  // started booking a women's category, backed out, then opened "Add
  // Measurement" from Profile), which previously locked the gender chip even
  // though there's no category context on that path.
  const targetGender = useMemo(
    () =>
      bookingFlowActive
        ? inferGenderFromCategoryName(fetchedTemplate?.category_name ?? pendingService?.categoryName)
        : null,
    [bookingFlowActive, fetchedTemplate?.category_name, pendingService?.categoryName],
  );

  // Saved-profile list, filtered to the booked category's gender (unisex/
  // "other"-tagged profiles always shown). Unfiltered (identical to
  // `measurements`) for non-gender-specific categories.
  const visibleMeasurements = useMemo(
    () => measurements.filter((m) => measurementGenderMatches(targetGender, m.gender)),
    [measurements, targetGender],
  );

  const augmentedTemplate = useMemo(
    () => augmentTemplateWithStandardSizes(activeTemplate, gender),
    [activeTemplate, gender],
  );

  const {
    selectedSize,
    formByFieldKey,
    sizeDisplayOrder,
    customSizeCode,
    selectSize,
    updateField,
    resetFormFields,
    loadFromMeasurement,
  } = useMeasurementSizeSelection(augmentedTemplate);

  useEffect(() => {
    if (bookableServiceId <= 0) {
      setFetchedTemplate(null);
      return;
    }

    let cancelled = false;
    setTemplateLoading(true);

    fetchMeasurementTemplate(bookableServiceId)
      .then((data) => {
        if (!cancelled) setFetchedTemplate(data);
      })
      .catch(() => {
        if (!cancelled) setFetchedTemplate(null);
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookableServiceId]);

  useEffect(() => {
    if (mode !== "add" || !pendingEditMeasurement) return;
    loadFromMeasurement(pendingEditMeasurement);
  }, [
    mode,
    pendingEditMeasurement,
    augmentedTemplate.service_id,
    fetchedTemplate,
    loadFromMeasurement,
  ]);

  // Reset measurement fields when gender changes so male-only fields (e.g. neck)
  // don't carry stale values into the female template (and vice-versa).
  // Only applies to the legacy template; service-specific templates are unchanged.
  const prevGenderRef = useRef(gender);
  useEffect(() => {
    if (prevGenderRef.current === gender) return;
    prevGenderRef.current = gender;
    if (!fetchedTemplate && mode === "add") {
      resetFormFields();
      setFieldErrors({});
    }
  }, [gender, fetchedTemplate, mode, resetFormFields]);

  useFocusEffect(
    useCallback(() => {
      fetchMeasurements();
      if (modeParam === "saved") {
        setMode("saved");
      }
    }, [fetchMeasurements, modeParam]),
  );

  const applyProfileFields = useCallback((m: ApiMeasurement) => {
    setProfileName(m.profile_name);
    setGender(m.gender || "male");
    setFitPreference(m.fit_preference || "regular");
    setNotes(m.notes ?? "");
    setIsDefault(m.is_default);
  }, []);

  const resetForm = useCallback(async () => {
    setEditingId(null);
    setPendingEditMeasurement(null);
    resetFormFields();
    setFieldErrors({});

    // A gender-specific category (e.g. Women's Clothing) always wins over
    // the customer's last-used default - a new profile created while
    // booking a women's-only garment must be tagged female, not whatever
    // gender they happened to pick last time.
    try {
      const defaults = await getMeasurementFormDefaults();
      setProfileName(defaults.profile_name || getDefaultProfileLabel());
      setGender(targetGender ?? defaults.gender ?? "male");
      setFitPreference(defaults.fit_preference || "regular");
      setNotes("");
      setIsDefault(
        defaults.is_default !== undefined
          ? defaults.is_default
          : measurements.length === 0,
      );
    } catch {
      setProfileName(getDefaultProfileLabel());
      setGender(targetGender ?? "male");
      setFitPreference("regular");
      setNotes("");
      setIsDefault(measurements.length === 0);
    }
  }, [getDefaultProfileLabel, measurements.length, resetFormFields, targetGender]);

  const openAddMeasurementForm = useCallback(async () => {
    setSaveSuccess(false);
    setMode("add");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    await resetForm();
  }, [resetForm]);

  const loadMeasurementIntoForm = async (m: ApiMeasurement) => {
    setMode("add");
    setEditingId(m.id);
    setFieldErrors({});
    setProfileLoading(true);

    try {
      const fresh = await getMeasurementById(m.id);
      applyProfileFields(fresh);
      setPendingEditMeasurement(fresh);
      loadFromMeasurement(fresh);
    } catch {
      applyProfileFields(m);
      setPendingEditMeasurement(m);
      loadFromMeasurement(m);
    } finally {
      setProfileLoading(false);
    }
  };

  // Deep-link handling from the Measurement Guide modal (opened from
  // Service Details): editId jumps straight into editing that saved
  // profile; presetSize opens the add form pre-filled with that size's
  // template values. Guarded to run once per param combination so it
  // doesn't re-fire on every re-render or refetch.
  const handledDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${editIdParam ?? ""}|${presetSizeParam ?? ""}`;
    if (key === "|") return;
    if (handledDeepLinkRef.current === key) return;
    if (loadingMeasurements) return;

    if (editIdParam) {
      const id = parseInt(String(editIdParam), 10);
      const target = measurements.find((m) => m.id === id);
      if (target) {
        handledDeepLinkRef.current = key;
        void loadMeasurementIntoForm(target);
      }
      return;
    }

    if (presetSizeParam) {
      handledDeepLinkRef.current = key;
      void openAddMeasurementForm().then(() => selectSize(String(presetSizeParam)));
    }
  }, [editIdParam, presetSizeParam, measurements, loadingMeasurements, openAddMeasurementForm, selectSize]);

  const handleDeleteMeasurement = (m: ApiMeasurement) => {
    Alert.alert("Delete measurement", `Remove "${m.profile_name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await removeMeasurement(m.id);
            await fetchMeasurements();
            useToastStore.getState().show("Measurement Deleted Successfully");
            scrollToTop();
          } catch (err) {
            Alert.alert(
              "Error",
              err instanceof Error ? err.message : "Failed to delete measurement.",
            );
          }
        },
      },
    ]);
  };

  const syncCartAndAdd = async (
    measurement: ApiMeasurement,
    sizeCode?: string,
  ) => {
    if (!pendingService) return;

    if (buyNowMode) {
      clearBuyNowMode();
      safeRouterReplace(router, {
        pathname: "/address",
        params: {
          mode: "buy-now",
          measurementProfileId: String(measurement.id > 0 ? measurement.id : 0),
          selectedSize: sizeCode || selectedSize || "",
        },
      } as never);
      return;
    }

    if (measurement.id <= 0) return;

    setCartSyncing(true);
    try {
      await addServiceEntry({
        service_id: pendingService.bookableServiceId,
        quantity: pendingService.quantity ?? 1,
        measurement_profile_id: measurement.id,
        selected_size: sizeCode || selectedSize || undefined,
        selected_measurements: buildSelectedMeasurements(measurement),
        tailor_id: pendingService.tailorId,
        stitching_preferences: pendingService.stitchingPreferences,
      });
      clearPendingService();
      useToastStore.getState().show("Added to Cart");
      router.back();
    } catch (err) {
      Alert.alert(
        "Unable to add to cart",
        err instanceof Error
          ? err.message
          : "Could not add this service to your cart. Please try again.",
      );
    } finally {
      setCartSyncing(false);
    }
  };

  const proceedAfterMeasurement = async (result: ApiMeasurement) => {
    if (bookingFlowActive) {
      await fetchMeasurements();
      setPendingBookingMeasurement({
        profileId: result.id,
        profileName: result.profile_name,
        skipped: false,
        selectedMeasurements: buildSelectedMeasurements(result),
        selectedSize: selectedSize || undefined,
      });
      setSaveSuccess(true);
      setMode("saved");
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
      return;
    }
    if (returnToPendingRouteAfterMeasurement(router)) return;
    if (pendingService) {
      void syncCartAndAdd(result);
    } else {
      setMode("saved");
    }
  };

  const handleBookingContinue = () => {
    safeRouterPush(router, "/address");
  };

  const handleSkipMeasurement = () => {
    setPendingBookingMeasurement({
      profileId: null,
      profileName: null,
      skipped: true,
    });
    safeRouterPush(router, "/address");
  };

  const handleSkipPendingService = async () => {
    if (!pendingService) return;
    if (buyNowMode) {
      clearBuyNowMode();
      safeRouterReplace(router, {
        pathname: "/address",
        params: { mode: "buy-now", measurementProfileId: "0", selectedSize: selectedSize || "" },
      } as never);
      return;
    }
    setCartSyncing(true);
    try {
      await addServiceEntry({
        service_id: pendingService.bookableServiceId,
        quantity: pendingService.quantity ?? 1,
        stitching_preferences: pendingService.stitchingPreferences,
      });
      clearPendingService();
      useToastStore.getState().show("Added to Cart");
      router.back();
    } catch (err) {
      Alert.alert(
        "Unable to add to cart",
        err instanceof Error ? err.message : "Could not add this service to cart. Please try again.",
      );
    } finally {
      setCartSyncing(false);
    }
  };

  const canContinueBooking = useMemo(() => {
    if (!bookingFlowActive) return false;
    if (pendingBookingMeasurement?.skipped) return true;
    return Boolean(
      pendingBookingMeasurement?.profileId &&
        pendingBookingMeasurement.profileId > 0,
    );
  }, [bookingFlowActive, pendingBookingMeasurement]);

  const setValue = (key: string, val: string) => {
    updateField(key, val);
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const e = { ...prev };
        delete e[key];
        return e;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      errs.profileName = "Profile name is required";
    } else {
      const duplicate = measurements.some(
        (m) =>
          m.id !== editingId &&
          m.profile_name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      if (duplicate) {
        errs.profileName = "A profile with this name already exists";
      }
    }

    if (!hasAtLeastOneTemplateMeasurement(augmentedTemplate, formByFieldKey)) {
      errs._form = "Enter at least one body measurement";
    }

    Object.assign(errs, validateTemplateFieldValues(augmentedTemplate, formByFieldKey));
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Save new measurement and proceed
  const handleSave = async () => {
    if (!validate()) return;

    const payload = buildSavePayload(augmentedTemplate, formByFieldKey, {
      profile_name: profileName.trim(),
      gender,
      fit_preference: fitPreference,
      notes: notes.trim(),
      is_default: isDefault,
    });

    const isUpdate = Boolean(editingId);
    const result = isUpdate
      ? await editMeasurement(editingId!, payload)
      : await saveMeasurement(payload);
    if (result) {
      await fetchMeasurements();
      scrollToTop();
      useToastStore.getState().show(
        isUpdate
          ? "Measurement Updated Successfully"
          : "Measurement Saved Successfully",
      );
      await proceedAfterMeasurement(result);
    } else {
      const msg = error ?? "Failed to save measurement. Please try again.";
      const isNetwork =
        msg.toLowerCase().includes("network") ||
        msg.toLowerCase().includes("cannot reach") ||
        msg.toLowerCase().includes("timed out");
      Alert.alert(
        isNetwork ? "Connection Error" : "Error",
        isNetwork
          ? "Cannot reach the server. Make sure your phone and server are on the same WiFi, then try again."
          : msg,
      );
    }
  };

  const handleUseSaved = async (id: number) => {
    if (bookingFlowActive) {
      setSaveSuccess(false);
      setCartSyncing(true);
      try {
        const measurement = await getMeasurementById(id);
        setPendingBookingMeasurement({
          profileId: measurement.id,
          profileName: measurement.profile_name,
          skipped: false,
          selectedMeasurements: buildSelectedMeasurements(measurement),
          selectedSize: selectedSize || undefined,
        });
      } catch (err) {
        Alert.alert(
          "Unable to load measurement",
          err instanceof Error ? err.message : "Please try again.",
        );
      } finally {
        setCartSyncing(false);
      }
      return;
    }
    if (!pendingService && returningToServiceDetails) {
      returnToPendingRouteAfterMeasurement(router);
      return;
    }
    if (!pendingService) return;
    setCartSyncing(true);
    try {
      const measurement = await getMeasurementById(id);
      await syncCartAndAdd(measurement);
    } catch (err) {
      Alert.alert(
        "Unable to add to cart",
        err instanceof Error ? err.message : "Please try again.",
      );
      setCartSyncing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (mode === "saved" && modeParam === "saved") {
                router.back();
              } else if (mode === "add" && modeParam === "saved") {
                setMode("saved");
              } else if (mode === "choose") {
                router.back();
              } else {
                setMode("choose");
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Measurements</Text>
          <View style={{ width: 52 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            (mode === "add" || bookingFlowActive) && styles.scrollWithStickyFooter,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.heroBanner}
          >
            <LinearGradient
              colors={["#0c6c75", "#1aa3b0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />
              <Ionicons
                name="resize-outline"
                size={36}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={styles.heroTitle}>Perfect Fit Guaranteed</Text>
              <Text style={styles.heroSub}>
                {mode === "choose"
                  ? "Choose how to add your measurements"
                  : mode === "saved"
                    ? "Select a saved measurement profile"
                    : "Enter your measurements for a tailor-made experience"}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* ── CHOOSE MODE ─────────────────────────────────────────────── */}
          {mode === "choose" && (
            <Animated.View entering={FadeInDown.delay(80).duration(400)}>
              <Text style={styles.chooseTitle}>
                How would you like to proceed?
              </Text>

              {bookableServiceId > 0 && (
                <TouchableOpacity
                  style={styles.sizeGuideLink}
                  onPress={() => setMeasurementGuideVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="View size guide"
                >
                  <Ionicons name="resize-outline" size={14} color={COLORS.primaryDark} />
                  <Text style={styles.sizeGuideLinkText}>View Size Guide</Text>
                </TouchableOpacity>
              )}

              {/* Option 1 - Add new */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => void openAddMeasurementForm()}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#0c6c75", "#1aa3b0"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.optionGradient}
                >
                  <View style={styles.optionIconBox}>
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color={COLORS.white}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Add Measurement Now</Text>
                    <Text style={styles.optionDesc}>
                      Enter your body measurements for a perfect fit
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="rgba(255,255,255,0.7)"
                  />
                </LinearGradient>
              </TouchableOpacity>

              {/* Option 2 - Use saved */}
              <TouchableOpacity
                style={[styles.optionCard, styles.optionCardOutline]}
                onPress={() => setMode("saved")}
                activeOpacity={0.85}
              >
                <View style={styles.optionInner}>
                  <View
                    style={[
                      styles.optionIconBox,
                      { backgroundColor: COLORS.primaryLight },
                    ]}
                  >
                    <Ionicons
                      name="bookmark-outline"
                      size={24}
                      color={COLORS.primaryDark}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: COLORS.black }]}>
                      Use Saved Measurements
                    </Text>
                    <Text style={[styles.optionDesc, { color: COLORS.gray }]}>
                      {measurements.length > 0
                        ? `${measurements.length} saved profile${measurements.length !== 1 ? "s" : ""} available`
                        : "No saved profiles yet"}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.gray}
                  />
                </View>
              </TouchableOpacity>

              {bookingFlowActive ? (
                <TouchableOpacity
                  style={[styles.optionCard, styles.optionCardOutline]}
                  onPress={handleSkipMeasurement}
                  activeOpacity={0.85}
                >
                  <View style={styles.optionInner}>
                    <View
                      style={[
                        styles.optionIconBox,
                        { backgroundColor: COLORS.grayLight },
                      ]}
                    >
                      <Ionicons
                        name="play-skip-forward-outline"
                        size={24}
                        color={COLORS.gray}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: COLORS.black }]}>
                        Skip Measurement
                      </Text>
                      <Text style={[styles.optionDesc, { color: COLORS.gray }]}>
                        Continue without adding measurements for now
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.gray}
                    />
                  </View>
                </TouchableOpacity>
              ) : pendingService ? (
                <TouchableOpacity
                  style={[styles.optionCard, styles.optionCardOutline]}
                  onPress={handleSkipPendingService}
                  activeOpacity={0.85}
                  disabled={cartSyncing}
                >
                  <View style={styles.optionInner}>
                    <View
                      style={[
                        styles.optionIconBox,
                        { backgroundColor: COLORS.grayLight },
                      ]}
                    >
                      {cartSyncing ? (
                        <ActivityIndicator size="small" color={COLORS.gray} />
                      ) : (
                        <Ionicons
                          name="play-skip-forward-outline"
                          size={24}
                          color={COLORS.gray}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: COLORS.black }]}>
                        Skip Measurement
                      </Text>
                      <Text style={[styles.optionDesc, { color: COLORS.gray }]}>
                        Continue without adding measurements for now
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.gray}
                    />
                  </View>
                </TouchableOpacity>
              ) : (
              <TouchableOpacity
                style={styles.skipOptionBtn}
                onPress={() => setMode("saved")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.optionIconBox,
                    { backgroundColor: COLORS.grayLight },
                  ]}
                >
                  <Ionicons
                    name="arrow-forward-circle-outline"
                    size={24}
                    color={COLORS.gray}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: COLORS.black }]}>
                    Skip for Now
                  </Text>
                  <Text style={[styles.optionDesc, { color: COLORS.gray }]}>
                    Our Experts will come to you for measurement.
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {/* ── SAVED MODE ──────────────────────────────────────────────── */}
          {mode === "saved" && (
            <Animated.View entering={FadeInDown.delay(80).duration(400)}>
              {saveSuccess ? (
                <View style={styles.saveSuccessBanner}>
                  <Ionicons name="checkmark-circle" size={20} color="#059669" />
                  <Text style={styles.saveSuccessText}>
                    Measurement Saved Successfully
                  </Text>
                </View>
              ) : null}
              {loadingMeasurements ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={styles.loadingText}>
                    Loading saved measurements...
                  </Text>
                </View>
              ) : visibleMeasurements.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="body-outline"
                    size={48}
                    color={COLORS.grayBorder}
                  />
                  <Text style={styles.emptyTitle}>
                    {measurements.length === 0
                      ? "No saved measurements"
                      : `No ${targetGender} measurement profiles yet`}
                  </Text>
                  <Text style={styles.emptyDesc}>
                    {measurements.length === 0
                      ? "Add your measurements to get a perfect fit"
                      : "This service needs a matching profile - add one to continue."}
                  </Text>
                  <TouchableOpacity
                    style={styles.addNewFromEmpty}
                    onPress={() => void openAddMeasurementForm()}
                  >
                    <Text style={styles.addNewFromEmptyText}>
                      Add Measurements
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                {visibleMeasurements.map((m) => {
                  const isSelected =
                    pendingBookingMeasurement?.profileId === m.id;
                  const isSelectable = Boolean(
                    pendingService ||
                      returningToServiceDetails ||
                      bookingFlowActive,
                  );

                  const measureEntries = formatMeasurementEntries(m);
                  const cardInner = (
                    <>
                      <View style={styles.savedCardMain}>
                        <View style={styles.savedCardIcon}>
                          <Ionicons
                            name="body-outline"
                            size={20}
                            color={COLORS.primaryDark}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.savedCardName}>{m.profile_name}</Text>
                          <View style={styles.savedCardMetaRow}>
                            <Text style={styles.savedCardMetaBadge}>
                              {capitalize(m.gender || "male")}
                            </Text>
                            <Text style={styles.savedCardMetaDot}>·</Text>
                            <Text style={styles.savedCardMetaBadge}>
                              {capitalize(m.fit_preference || "regular")} Fit
                            </Text>
                            {m.is_default ? (
                              <>
                                <Text style={styles.savedCardMetaDot}>·</Text>
                                <Text style={styles.savedCardMetaDefault}>Default</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                        {isSelectable ? (
                          <Ionicons
                            name={
                              isSelected
                                ? "checkmark-circle"
                                : "checkmark-circle-outline"
                            }
                            size={22}
                            color={COLORS.primaryDark}
                          />
                        ) : null}
                      </View>
                      {measureEntries.length > 0 ? (
                        <View style={styles.savedCardChips}>
                          {measureEntries.map((entry) => (
                            <View key={entry.key} style={styles.savedCardChip}>
                              <Text style={styles.savedCardChipLabel}>{entry.label}</Text>
                              <Text style={styles.savedCardChipValue}>{entry.value}</Text>
                            </View>
                          ))}
                          {m.notes?.trim() ? (
                            <View style={[styles.savedCardChip, styles.savedCardChipNote]}>
                              <Text style={styles.savedCardChipLabel}>Note:</Text>
                              <Text style={styles.savedCardChipValue} numberOfLines={1}>{m.notes.trim()}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </>
                  );

                  return isSelectable ? (
                    <Pressable
                      key={m.id}
                      onPress={() => void handleUseSaved(m.id)}
                      disabled={cartSyncing}
                      style={({ pressed }) => [
                        styles.savedCard,
                        isSelected && styles.savedCardSelected,
                        pressed && !cartSyncing && styles.savedCardPressed,
                      ]}
                    >
                      {cardInner}
                      <View style={styles.savedCardActions}>
                        <TouchableOpacity
                          onPress={() => loadMeasurementIntoForm(m)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="pencil-outline"
                            size={18}
                            color={COLORS.primaryDark}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteMeasurement(m)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={COLORS.error}
                          />
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  ) : (
                    <View key={m.id} style={styles.savedCard}>
                      {cardInner}
                      <View style={styles.savedCardActions}>
                        <TouchableOpacity
                          onPress={() => loadMeasurementIntoForm(m)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="pencil-outline"
                            size={18}
                            color={COLORS.primaryDark}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteMeasurement(m)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={COLORS.error}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={styles.addNewInListBtn}
                  onPress={() => void openAddMeasurementForm()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryDark} />
                  <Text style={styles.addNewInListBtnText}>Add New Measurement</Text>
                </TouchableOpacity>
                </>
              )}
            </Animated.View>
          )}

          {/* ── ADD MODE (new measurement form) ─────────────────────────── */}
          {mode === "add" && (
            <>
              <Animated.View
                entering={FadeInDown.delay(40).duration(400)}
                style={styles.addScreenHeader}
              >
                <Text style={styles.addScreenTitle}>
                  {editingId ? "Edit Measurements" : "Your Measurements"}
                </Text>
                <Text style={styles.addScreenSubtitle}>
                  {fetchedTemplate?.service_name
                    ? `Tailored sizing for ${fetchedTemplate.service_name}`
                    : "Select a size or enter custom measurements for the perfect fit"}
                </Text>
                {profileLoading ? (
                  <View style={styles.templateLoadingRow}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                    <Text style={styles.templateLoadingText}>
                      Loading measurement profile...
                    </Text>
                  </View>
                ) : null}
              </Animated.View>

              {/* Profile name */}
              <Animated.View
                entering={FadeInDown.delay(80).duration(400)}
                style={styles.premiumCard}
              >
                <Text style={styles.cardTitle}>
                  {editingId ? "Edit Profile" : "Profile Details"}
                </Text>

                <Text style={styles.fieldLabel}>
                  Profile Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    fieldErrors.profileName ? styles.inputError : null,
                  ]}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder={getDefaultProfileLabel() || "Profile name"}
                  placeholderTextColor={COLORS.gray}
                />
                {fieldErrors.profileName ? (
                  <Text style={styles.errorText}>
                    {fieldErrors.profileName}
                  </Text>
                ) : null}

                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.chipRow}>
                  {GENDER_OPTIONS.map((g) => {
                    // Locked to the category's gender for a gender-specific
                    // service (e.g. Women's Clothing) - the customer can't
                    // create a mismatched profile for it. Unaffected for
                    // non-gender-specific categories (targetGender is null).
                    const locked = targetGender != null && g !== targetGender;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.chip,
                          gender === g && styles.chipActive,
                          locked && styles.chipDisabled,
                        ]}
                        onPress={() => {
                          if (!locked) setGender(g);
                        }}
                        disabled={locked}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            gender === g && styles.chipTextActive,
                            locked && styles.chipTextDisabled,
                          ]}
                        >
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {targetGender ? (
                  <Text style={styles.genderLockNote}>
                    This service is for {targetGender} customers, so gender is set automatically.
                  </Text>
                ) : null}
              </Animated.View>

              {/* Measurement fields */}
              <Animated.View
                entering={FadeInDown.delay(140).duration(400)}
                style={styles.premiumCard}
              >
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Body Measurements</Text>
                  {bookableServiceId > 0 && (
                    <TouchableOpacity
                      style={styles.sizeGuideLinkInline}
                      onPress={() => setMeasurementGuideVisible(true)}
                      accessibilityRole="button"
                      accessibilityLabel="View size guide"
                    >
                      <Ionicons name="resize-outline" size={13} color={COLORS.primaryDark} />
                      <Text style={styles.sizeGuideLinkText}>Size Guide</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.cardSubtitle}>
                  Choose a standard size to pre-fill or enter custom measurements below
                </Text>

                {sizeDisplayOrder.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.sizeChipRow}
                  >
                    {sizeDisplayOrder.map((sizeCode) => {
                      const isActive = selectedSize === sizeCode;
                      const isCustom = sizeCode === customSizeCode;
                      return (
                        <TouchableOpacity
                          key={sizeCode}
                          style={[
                            styles.sizeChip,
                            isActive && styles.sizeChipActive,
                          ]}
                          onPress={() => selectSize(sizeCode)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.sizeChipText,
                              isActive && styles.sizeChipTextActive,
                            ]}
                          >
                            {isCustom ? "Custom" : sizeCode}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : null}

                {templateLoading ? (
                  <View style={styles.templateLoadingRow}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                    <Text style={styles.templateLoadingText}>
                      Loading measurement template...
                    </Text>
                  </View>
                ) : null}

                {fieldErrors._form ? (
                  <Text style={styles.errorText}>{fieldErrors._form}</Text>
                ) : null}

                <View style={styles.fieldsGrid}>
                  {getOrderedTemplateFields(augmentedTemplate).map((field) => (
                    <View key={field.field_key} style={styles.fieldHalf}>
                      <Text style={styles.fieldLabel}>
                        {field.label}
                        {field.is_required ? (
                          <Text style={styles.required}> *</Text>
                        ) : null}
                      </Text>
                      <View style={styles.inputWithUnit}>
                        <TextInput
                          style={[
                            styles.premiumInput,
                            styles.inputFlex,
                            fieldErrors[field.field_key]
                              ? styles.inputError
                              : null,
                          ]}
                          value={formByFieldKey[field.field_key] ?? ""}
                          onChangeText={(v) => setValue(field.field_key, v)}
                          placeholder={`e.g. ${field.unit === "cm" ? "170" : "36"}`}
                          placeholderTextColor={COLORS.gray}
                          keyboardType="decimal-pad"
                        />
                        <View style={styles.unitBox}>
                          <Text style={styles.unitText}>{field.unit}</Text>
                        </View>
                      </View>
                      {fieldErrors[field.field_key] ? (
                        <Text style={styles.errorText}>
                          {fieldErrors[field.field_key]}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </Animated.View>

              {/* Fit preference */}
              <Animated.View
                entering={FadeInDown.delay(200).duration(400)}
                style={styles.premiumCard}
              >
                <Text style={styles.cardTitle}>Fit Preference</Text>
                <View style={styles.chipRow}>
                  {FIT_OPTIONS.map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[
                        styles.chip,
                        fitPreference === f && styles.chipActive,
                      ]}
                      onPress={() => setFitPreference(f)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          fitPreference === f && styles.chipTextActive,
                        ]}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>

              {/* Notes */}
              <Animated.View
                entering={FadeInDown.delay(240).duration(400)}
                style={styles.premiumCard}
              >
                <Text style={styles.cardTitle}>Additional Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any special instructions for the tailor..."
                  placeholderTextColor={COLORS.gray}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setIsDefault((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.toggle, isDefault && styles.toggleActive]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        isDefault && styles.toggleThumbActive,
                      ]}
                    />
                  </View>
                  <Text style={styles.toggleLabel}>
                    Set as default measurement profile
                  </Text>
                </TouchableOpacity>
              </Animated.View>

            </>
          )}

          <View style={{ height: mode === "add" ? SPACING.lg : SPACING.xxl }} />
        </ScrollView>

        {mode === "add" ? (
          <View
            style={[
              styles.stickyFooter,
              { paddingBottom: Math.max(insets.bottom, SPACING.sm) },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.stickySaveBtn,
                (saving || cartSyncing) && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={saving || cartSyncing}
              activeOpacity={0.88}
            >
              {saving || cartSyncing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name={
                      pendingService && !bookingFlowActive
                        ? "cart-outline"
                        : "checkmark-circle-outline"
                    }
                    size={22}
                    color={COLORS.white}
                  />
                  <Text style={styles.stickySaveBtnText}>
                    {editingId
                      ? "Update Measurements"
                      : pendingService && !bookingFlowActive
                        ? "Add To Cart"
                        : "Save Measurements"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : bookingFlowActive ? (
          <View
            style={[
              styles.stickyFooter,
              { paddingBottom: Math.max(insets.bottom, SPACING.sm) },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.stickyContinueBtn,
                (!canContinueBooking || cartSyncing) && styles.saveBtnDisabled,
              ]}
              onPress={handleBookingContinue}
              disabled={!canContinueBooking || cartSyncing}
              activeOpacity={0.88}
            >
              <Text style={styles.stickyContinueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <MeasurementGuideModal
        visible={measurementGuideVisible}
        onClose={() => setMeasurementGuideVisible(false)}
        bookableServiceId={bookableServiceId}
        gender={targetGender}
        onBookHomeMeasurement={
          bookingFlowActive
            ? handleSkipMeasurement
            : pendingService
              ? () => void handleSkipPendingService()
              : undefined
        }
      />
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: COLORS.offWhite },

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
    backgroundColor: COLORS.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
  },
  skipText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },

  scroll: { padding: SPACING.lg },
  scrollWithStickyFooter: { paddingBottom: 100 },

  saveSuccessBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "#D1FAE5",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.25)",
  },
  saveSuccessText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
    flex: 1,
  },

  heroBanner: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },
  heroGradient: {
    padding: SPACING.lg,
    alignItems: "center",
    gap: SPACING.sm,
    overflow: "hidden",
  },
  heroCircle1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -60,
    right: -40,
  },
  heroCircle2: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -30,
    left: 10,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.white,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 18,
  },

  // ── Choose mode ──────────────────────────────────────────────────────────
  chooseTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.md,
  },
  sizeGuideLink: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.md,
  },
  // Same pill, but sitting inside the "Body Measurements" title row (a
  // space-between flex row) - it must NOT carry the standalone variant's
  // marginBottom/alignSelf, which pushed it out of vertical alignment with
  // the title next to it.
  sizeGuideLinkInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  sizeGuideLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  optionCard: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    ...SHADOW.card,
  },
  optionCardOutline: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    backgroundColor: COLORS.white,
  },
  optionGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
  },
  optionInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.white,
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 2,
  },
  optionDesc: { fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 16 },

  skipOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    ...SHADOW.card,
  },

  // ── Saved mode ───────────────────────────────────────────────────────────
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  loadingText: { fontSize: 14, color: COLORS.gray },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptyDesc: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  addNewFromEmpty: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: SPACING.sm,
  },
  addNewFromEmptyText: { fontSize: 14, fontWeight: "700", color: COLORS.white },

  addNewInListBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primaryDark,
    borderStyle: "dashed",
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    marginTop: SPACING.sm,
  },
  addNewInListBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.primaryDark },

  savedCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  savedCardSelected: {
    borderColor: COLORS.primaryDark,
    borderWidth: 2,
    backgroundColor: "#f0fafb",
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  savedCardPressed: {
    opacity: 0.92,
  },
  savedCardMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  savedCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 3,
  },
  savedCardMetaBadge: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "500",
  },
  savedCardMetaDot: {
    fontSize: 12,
    color: COLORS.grayBorder,
  },
  savedCardMetaDefault: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: "600",
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  savedCardChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 10,
    paddingLeft: 52,
  },
  savedCardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.grayLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedCardChipNote: {
    flexShrink: 1,
    maxWidth: "100%",
  },
  savedCardChipLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: "500",
  },
  savedCardChipValue: {
    fontSize: 11,
    color: COLORS.black,
    fontWeight: "700",
  },
  savedCardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  savedCardIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  savedCardName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
  },

  // ── Add mode (form) ──────────────────────────────────────────────────────
  addScreenHeader: {
    marginBottom: SPACING.md,
    paddingHorizontal: 2,
  },
  addScreenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.black,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  addScreenSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.gray,
    fontWeight: "500",
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  premiumCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(12, 108, 117, 0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.black,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  sizeChipRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
    paddingRight: SPACING.sm,
  },
  sizeChip: {
    minWidth: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeChipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  sizeChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.gray,
    letterSpacing: 0.2,
  },
  sizeChipTextActive: {
    color: COLORS.white,
    fontWeight: "800",
  },
  templateLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  templateLoadingText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: SPACING.sm,
    letterSpacing: -0.1,
  },
  required: { color: COLORS.error },

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
  premiumInput: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  inputError: { borderColor: COLORS.error },
  inputFlex: { flex: 1 },
  textArea: { height: 80, paddingTop: 12, paddingBottom: 12 },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },

  inputWithUnit: { flexDirection: "row", alignItems: "center", gap: 6 },
  unitBox: {
    height: 46,
    paddingHorizontal: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  unitText: { fontSize: 12, fontWeight: "600", color: COLORS.primaryDark },

  fieldsGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  fieldHalf: { width: "47%" },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  chipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },
  chipTextActive: { color: COLORS.white },
  chipDisabled: { opacity: 0.4 },
  chipTextDisabled: { color: COLORS.grayBorder },
  genderLockNote: {
    fontSize: 11.5,
    color: COLORS.gray,
    marginTop: SPACING.xs,
    fontStyle: "italic",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.grayBorder,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: COLORS.primaryDark },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    ...SHADOW.card,
  },
  toggleThumbActive: { alignSelf: "flex-end" },
  toggleLabel: { fontSize: 13, color: COLORS.black, flex: 1 },

  stickyFooter: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
    }),
  },
  stickySaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    height: 56,
    width: "100%",
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  stickySaveBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: -0.2,
  },
  stickyContinueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    height: 56,
    width: "100%",
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  stickyContinueBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
  },
  btnWrap: { gap: SPACING.sm },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    height: 54,
    ...SHADOW.card,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: COLORS.white },
  skipLinkBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  skipLinkText: { fontSize: 14, fontWeight: "600", color: COLORS.gray },
});
