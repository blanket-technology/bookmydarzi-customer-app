/**
 * Address Screen
 *
 * Collects delivery address, saves via POST /users/addresses,
 * then places the order and navigates to the Orders tab.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from "expo-router";
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
import { LocationSelectField } from "../src/components/common/LocationSelectField";
import { MapPinPicker, type PickedLocation } from "../src/components/common/MapPinPicker";
import ScreenHeader from "../src/components/common/ScreenHeader";
import {
    DEFAULT_CITY,
    DEFAULT_STATE,
    INDIA_STATES,
    findStateForCity,
    getCitiesForState,
    isServiceCity,
    withCustomOption,
} from "../src/constants/indiaLocations";
import { useHardwareBackHandler } from "../src/hooks/useHardwareBackHandler";
import {
    isValidAddressType,
    toApiAddressTypeValue,
} from "../src/services/addressService";
import {
    GpsCoords,
    ServiceabilityResult,
    checkServiceability,
    getCurrentGpsCoords,
    registerServiceAreaInterest,
    reverseGeocodeCoords,
} from "../src/services/locationService";
import { useAddressStore } from "../src/store/useAddressStore";
import { useCartStore } from "../src/store/useCartStore";
import { useCheckoutPreferencesStore } from "../src/store/useCheckoutPreferencesStore";
import { useToastStore } from "../src/store/useToastStore";
import type { AddressPayload, AddressType, ApiAddress } from "../src/types/api";
import type { AddCartServiceEntryPayload } from "../src/types/cart";
import { executeCheckoutFromCart } from "../src/utils/checkoutNavigation";
import { safeRouterReplace } from "../src/utils/safeNavigation";
import { useAuthStore } from "../store/useAuthStore";
import ErrorState from "../src/components/common/ErrorState";

const ADDRESS_TYPES: { key: AddressType; label: string; icon: string }[] = [
  { key: "home", label: "Home", icon: "home-outline" },
  { key: "work", label: "Work", icon: "briefcase-outline" },
  { key: "other", label: "Other", icon: "location-outline" },
];

// ---------------------------------------------------------------------------
// Saved address card
// ---------------------------------------------------------------------------
function SavedAddressCard({
  address,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  address: ApiAddress;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.savedCard, selected && styles.savedCardSelected]}>
      <TouchableOpacity
        style={styles.savedCardLeft}
        onPress={onSelect}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.savedTypeIcon,
            selected && styles.savedTypeIconSelected,
          ]}
        >
          <Ionicons
            name={
              address.address_type === "home"
                ? "home-outline"
                : address.address_type === "work"
                  ? "briefcase-outline"
                  : "location-outline"
            }
            size={16}
            color={selected ? COLORS.white : COLORS.primaryDark}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.savedCardHeader}>
            <Text style={styles.savedCardName} numberOfLines={1}>
              {address.full_name}
            </Text>
            {address.is_default && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          <Text style={styles.savedCardAddr} numberOfLines={2}>
            {address.address_line_1}
            {address.address_line_2 ? `, ${address.address_line_2}` : ""}
          </Text>
          <Text style={styles.savedCardCity}>
            {address.city}, {address.state} – {address.pincode}
          </Text>
          <Text style={styles.savedCardPhone}>{address.mobile}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.savedCardActions}>
        {selected ? (
          <Ionicons name="checkmark-circle" size={22} color={COLORS.primaryDark} />
        ) : null}
        <TouchableOpacity
          onPress={onEdit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Edit address"
        >
          <Ionicons name="pencil-outline" size={18} color={COLORS.primaryDark} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Delete address"
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function AddressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { mode: routeMode } = useLocalSearchParams<{
    mode?: string;
  }>();
  const isBuyNowFlow = routeMode === "buy-now";
  const user = useAuthStore((s) => s.user);
  const {
    addresses,
    loading,
    saving,
    fetchAddresses,
    saveAddress,
    editAddress,
    removeAddress,
    error,
  } = useAddressStore();
  const {
    checkoutFlow,
    itemCount,
    setAddressId,
    bookingFlowActive,
    pendingService,
    addServiceEntry,
    clearPendingService,
    setBookingFlowActive,
    mutating,
  } = useCartStore();
  const isCheckoutFlow = checkoutFlow && itemCount > 0;
  const isBookingFlow = Boolean(bookingFlowActive && pendingService);

  type AddressMode = "select" | "form";
  const [mode, setMode] = useState<AddressMode>("select");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedAddressId, setSelectedAddressIdLocal] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fullNameRef = useRef<TextInput>(null);
  const [scrollToForm, setScrollToForm] = useState(false);

  // Form state
  const [fullName, setFullName] = useState(
    user ? `${user.first_name} ${user.last_name}`.trim() : "",
  );
  const [mobile, setMobile] = useState(user?.mobile ?? "");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState(DEFAULT_CITY);
  const [state, setState] = useState(DEFAULT_STATE);
  const [pincode, setPincode] = useState("");
  const [landmark, setLandmark] = useState("");
  const [addressType, setAddressType] = useState<AddressType>("home");
  const [isDefault, setIsDefault] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Geo-tagging state
  const [gpsCoords, setGpsCoords] = useState<GpsCoords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [serviceability, setServiceability] =
    useState<ServiceabilityResult | null>(null);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  // "Notify me" capture for the unserviceable-area badge below - see
  // registerServiceAreaInterest.
  const [interestState, setInterestState] = useState<"idle" | "submitting" | "done">("idle");

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [fetchAddresses]),
  );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFullName(user ? `${user.first_name} ${user.last_name}`.trim() : "");
    setMobile(user?.mobile ?? "");
    setLine1("");
    setLine2("");
    setCity(DEFAULT_CITY);
    setState(DEFAULT_STATE);
    setPincode("");
    setLandmark("");
    setAddressType("home");
    setIsDefault(addresses.length === 0);
    setFieldErrors({});
    setGpsCoords(null);
    setServiceability(null);
  }, [addresses.length, user]);

  const openNewAddressForm = useCallback(() => {
    setSaveSuccess(false);
    resetForm();
    setMode("form");
    setScrollToForm(true);
    // Auto-detect location when opening a new address form. Safe despite
    // handleUseMyLocation being declared later in this component: the
    // setTimeout callback only runs ~300ms later, by which point every
    // const in this render pass (including handleUseMyLocation below) is
    // already bound - react-hooks/immutability's static ordering check
    // can't see that the actual call is deferred.
    setTimeout(() => {
      // eslint-disable-next-line react-hooks/immutability
      void handleUseMyLocation();
    }, 300);
  }, [resetForm]); // eslint-disable-line react-hooks/exhaustive-deps

  // In buy-now mode: auto-select default address; auto-open form if none exist.
  // Genuinely needs to be an effect - addresses loads asynchronously, and
  // this reacts to that load completing, not to a value derivable during
  // render. react-hooks/set-state-in-effect (React Compiler) flags this
  // pattern generally; React's own docs cover exactly this "adjust state
  // when a fetch completes" case as a legitimate use of an effect.
  const autoOpenedBuyNowFormRef = useRef(false);
  useEffect(() => {
    if (!isBuyNowFlow || loading) return;
    if (addresses.length === 0) {
      if (!autoOpenedBuyNowFormRef.current) {
        autoOpenedBuyNowFormRef.current = true;
        openNewAddressForm();
      }
      return;
    }
    if (!selectedAddressId) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (def) setSelectedAddressIdLocal(def.id);
    }
  }, [isBuyNowFlow, loading, addresses, selectedAddressId, openNewAddressForm]); // eslint-disable-line react-hooks/exhaustive-deps

  const returnToAddressSelection = useCallback(() => {
    resetForm();
    setMode("select");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [resetForm]);

  const scrollToTop = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

  const handleAddressBack = useCallback(() => {
    if (mode === "form") {
      returnToAddressSelection();
      return;
    }
    router.back();
  }, [mode, returnToAddressSelection, router]);

  useHardwareBackHandler(
    useCallback(() => {
      if (mode !== "form") return false;
      returnToAddressSelection();
      return true;
    }, [mode, returnToAddressSelection]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (mode !== "form") return;
      e.preventDefault();
      returnToAddressSelection();
    });
    return unsubscribe;
  }, [navigation, mode, returnToAddressSelection]);

  useEffect(() => {
    if (!scrollToForm || mode !== "form") return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      fullNameRef.current?.focus();
      setScrollToForm(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [scrollToForm, mode]);

  const loadAddressIntoForm = (addr: ApiAddress) => {
    setSaveSuccess(false);
    setEditingId(addr.id);
    setFullName(addr.full_name);
    setMobile(addr.mobile);
    setLine1(addr.address_line_1);
    setLine2(addr.address_line_2 ?? "");
    const loadedCity = addr.city?.trim() || DEFAULT_CITY;
    const loadedState =
      addr.state?.trim() ||
      findStateForCity(loadedCity) ||
      DEFAULT_STATE;
    setCity(loadedCity);
    setState(loadedState);
    setPincode(addr.pincode);
    setLandmark(addr.landmark ?? "");
    setAddressType(toApiAddressTypeValue(addr.address_type));
    setIsDefault(addr.is_default);
    setFieldErrors({});
    // Pre-populate existing coords so they survive an edit
    if (addr.latitude != null && addr.longitude != null) {
      setGpsCoords({ latitude: addr.latitude, longitude: addr.longitude, accuracy: null });
    } else {
      setGpsCoords(null);
    }
    setServiceability(null);
    setMode("form");
    setScrollToForm(true);
  };

  const handleDeleteAddress = (addr: ApiAddress) => {
    Alert.alert("Delete address", `Remove this address?\n\n${addr.address_line_1}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await removeAddress(addr.id);
            if (selectedAddressId === addr.id) {
              setSelectedAddressIdLocal(null);
            }
            await fetchAddresses();
            useToastStore.getState().show("Address Deleted Successfully");
            scrollToTop();
          } catch (err) {
            Alert.alert(
              "Error",
              err instanceof Error ? err.message : "Failed to delete address.",
            );
          }
        },
      },
    ]);
  };

  // Auto-select default address (selection screen only) - same
  // "adjust state once async data arrives" case as the effect above.
  useEffect(() => {
    if (mode !== "select") return;
    if (addresses.length > 0 && selectedAddressId === null) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAddressIdLocal(def.id);
    }
  }, [addresses, mode, selectedAddressId]);

  const stateOptions = useMemo(
    () => withCustomOption(INDIA_STATES, state),
    [state],
  );

  const cityOptions = useMemo(() => {
    const base = getCitiesForState(state);
    const merged =
      base.length > 0 ? base : getCitiesForState(DEFAULT_STATE);
    return withCustomOption(merged, city);
  }, [state, city]);

  // When the user has used GPS, trust the backend serviceability result.
  // Fall back to the local city-list check for manually entered cities.
  const showComingSoonBanner =
    mode === "form" &&
    city.trim().length > 0 &&
    (serviceability !== null
      ? !serviceability.serviceable
      : !isServiceCity(city));

  const handleStateSelect = (selectedState: string) => {
    setState(selectedState);
    const cities = getCitiesForState(selectedState);
    if (cities.length === 0) return;
    const keepCity = cities.some(
      (c) => c.toLowerCase() === city.trim().toLowerCase(),
    );
    if (!keepCity) {
      const fallback =
        selectedState === DEFAULT_STATE && cities.includes(DEFAULT_CITY)
          ? DEFAULT_CITY
          : cities[0];
      setCity(fallback);
    }
    if (fieldErrors.state) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.state;
        delete next.city;
        return next;
      });
    }
  };

  const handleCitySelect = (selectedCity: string) => {
    setCity(selectedCity);
    const matchedState = findStateForCity(selectedCity);
    if (matchedState) setState(matchedState);
    if (fieldErrors.city) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.city;
        return next;
      });
    }
  };

  const handleUseMyLocation = async () => {
    setGpsLoading(true);
    setServiceability(null);
    try {
      const coords = await getCurrentGpsCoords();
      setGpsCoords(coords);

      // Reverse geocode - auto-fill all address fields
      try {
        const geo = await reverseGeocodeCoords(coords.latitude, coords.longitude);

        // House + road → line1 (only if the user hasn't typed anything yet)
        if (geo.line1 && !line1.trim()) setLine1(geo.line1);

        // Colony / locality / sector → line2
        if (geo.line2 && !line2.trim()) setLine2(geo.line2);

        // City + auto-resolve state
        if (geo.city) {
          setCity(geo.city);
          const matchedState = findStateForCity(geo.city) || geo.state;
          if (matchedState) setState(matchedState);
        } else if (geo.state) {
          setState(geo.state);
        }

        if (geo.pincode) setPincode(geo.pincode);
      } catch {
        // Reverse-geocode failures are non-fatal - GPS coords still captured
      }

      // Check serviceability - shown as a badge either way. The backend is
      // the actual authority (create/update address now rejects an
      // unserviceable location outright) - this early check exists purely
      // so the customer sees the problem before filling out the rest of the
      // form, not after tapping Save.
      try {
        const svc = await checkServiceability(coords.latitude, coords.longitude);
        setServiceability(svc);
        setInterestState("idle");
        if (!svc.serviceable) {
          Alert.alert(
            "Not serviceable yet",
            svc.message || "Sorry, we don't deliver to this location yet.",
          );
        }
      } catch {
        // Serviceability check failing here just means the badge won't
        // show yet - the backend still enforces the real rule on Save.
      }
    } catch (err) {
      Alert.alert(
        "Location unavailable",
        err instanceof Error ? err.message : "Could not get your location.",
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const handleMapConfirm = useCallback(
    async (picked: PickedLocation) => {
      setMapPickerVisible(false);
      setGpsCoords({ latitude: picked.latitude, longitude: picked.longitude, accuracy: null });
      setServiceability(null);

      if (picked.address) {
        const geo = picked.address;
        if (geo.line1 && !line1.trim()) setLine1(geo.line1);
        if (geo.line2 && !line2.trim()) setLine2(geo.line2);
        if (geo.city) {
          setCity(geo.city);
          const matchedState = findStateForCity(geo.city) || geo.state;
          if (matchedState) setState(matchedState);
        } else if (geo.state) {
          setState(geo.state);
        }
        if (geo.pincode) setPincode(geo.pincode);
      }

      try {
        const svc = await checkServiceability(picked.latitude, picked.longitude);
        setServiceability(svc);
        setInterestState("idle");
        if (!svc.serviceable) {
          Alert.alert(
            "Not serviceable yet",
            svc.message || "Sorry, we don't deliver to this location yet.",
          );
        }
      } catch {
        // Serviceability check failing here just means the badge won't
        // show yet - the backend still enforces the real rule on Save.
      }
    },
    [line1, line2],
  );

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Full name is required";
    // Mirrors backend's AddressCreateSchema.validate_mobile (app/schemas/
    // address.py) - must also start with 6/7/8/9, not just be 10 digits.
    if (!mobile.trim() || !/^[6-9]\d{9}$/.test(mobile.trim()))
      errs.mobile = "Enter a valid 10-digit mobile number starting with 6-9";
    if (!line1.trim()) errs.line1 = "Address line 1 is required";
    if (!city.trim()) errs.city = "City is required";
    if (!state.trim()) errs.state = "State is required";
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim()))
      errs.pincode = "Enter a valid 6-digit pincode";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const performSaveAddress = async (): Promise<ApiAddress | null> => {
    if (!validate()) return null;

    const resolvedType: AddressType = isValidAddressType(addressType)
      ? addressType
      : "home";

    const payload: AddressPayload = {
      full_name: fullName.trim(),
      mobile: mobile.trim(),
      address_line_1: line1.trim(),
      address_line_2: line2.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      landmark: landmark.trim(),
      address_type: resolvedType,
      is_default: isDefault,
      latitude: gpsCoords?.latitude ?? null,
      longitude: gpsCoords?.longitude ?? null,
    };

    if (editingId) {
      return editAddress(editingId, payload);
    }
    return saveAddress(payload);
  };

  const handleRegisterInterest = async () => {
    if (!gpsCoords) return;
    setInterestState("submitting");
    try {
      await registerServiceAreaInterest({
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        city: city || null,
        pincode: pincode || null,
        address_text: [line1, city].filter(Boolean).join(", ") || null,
      });
      setInterestState("done");
    } catch {
      setInterestState("idle");
    }
  };

  const handleSaveAddress = async (): Promise<ApiAddress | null> => {
    // A fully manually-typed address (no "Use my location" / map pin) has no
    // coordinates at all yet. The backend now requires them (it can't check
    // serviceability, and won't save an address, without a real lat/lng) -
    // block here with a clear, specific message instead of letting the
    // generic backend 422 surface after a save attempt with no coordinates.
    if (!gpsCoords) {
      Alert.alert(
        "Location needed",
        "Please use \"Use my location\" or pin your address on the map so we can confirm we deliver there.",
      );
      return null;
    }

    const wasEditing = editingId != null;
    const saved = await performSaveAddress();
    if (saved) {
      await fetchAddresses();
      setSelectedAddressIdLocal(saved.id);
      setEditingId(null);
      setSaveSuccess(true);
      useToastStore.getState().show(
        wasEditing
          ? "Address Updated Successfully"
          : "Address Added Successfully",
      );
      if (isBuyNowFlow) {
        finishAddressFlow(saved.id);
        return saved;
      }
      setMode("select");
      scrollToTop();
      return saved;
    } else {
      const msg = error ?? "Failed to save address.";
      const isTimeout =
        msg.toLowerCase().includes("timed out") ||
        msg.toLowerCase().includes("too long");
      const isNetwork =
        msg.toLowerCase().includes("network") ||
        msg.toLowerCase().includes("cannot reach");

      if (isTimeout) {
        Alert.alert(
          "Server Timeout",
          "The server took too long to respond.\n\n" +
            "• Check your backend is running and not overloaded\n" +
            "• Make sure your phone and server are on the same WiFi\n" +
            "• Try again in a moment",
          [{ text: "OK" }],
        );
      } else if (isNetwork) {
        Alert.alert(
          "Connection Error",
          "Cannot reach the server.\n\n" +
            "• Make sure your phone and server are on the same WiFi\n" +
            "• Check the backend is running",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert("Error", msg);
      }
    }
    return null;
  };

  const finishAddressFlow = (addressId: number) => {
    if (isBuyNowFlow) {
      safeRouterReplace(router, {
        pathname: "/buy-now-review",
        params: { addressId: String(addressId) },
      } as never);
      return;
    }
    if (isCheckoutFlow) {
      setAddressId(addressId);
      void executeCheckoutFromCart(
        router,
        undefined,
        useCheckoutPreferencesStore.getState().lastPaymentMethod,
      );
      return;
    }
    if (!isBookingFlow) {
      setAddressId(addressId);
      router.back();
    }
  };

  const handleAddToCartBooking = async () => {
    if (!pendingService) return;

    const addressId = selectedAddressId;

    setSubmitting(true);
    try {
      if (!addressId) {
        Alert.alert("Select Address", "Please select or add a delivery address.");
        return;
      }

      const payload: AddCartServiceEntryPayload = {
        service_id: pendingService.bookableServiceId,
        quantity: pendingService.quantity ?? 1,
        tailor_id: pendingService.tailorId,
        addons: pendingService.addons,
      };

      await addServiceEntry(payload, {
        toastMessage: "Added to Cart Successfully",
      });
      setAddressId(addressId);
      clearPendingService();
      setBookingFlowActive(false);
      safeRouterReplace(router, "/(tabs)/cart");
    } catch (err) {
      Alert.alert(
        "Add to cart failed",
        err instanceof Error ? err.message : "Could not add to cart.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStickyFormSave = async () => {
    setSubmitting(true);
    try {
      await handleSaveAddress();
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (isBuyNowFlow) {
      if (mode === "form") {
        await handleStickyFormSave();
        return;
      }
      if (!selectedAddressId) {
        Alert.alert("Select Address", "Please select a delivery address.");
        return;
      }
      finishAddressFlow(selectedAddressId);
      return;
    }
    if (isBookingFlow) {
      await handleAddToCartBooking();
      return;
    }
    if (mode === "form") {
      await handleStickyFormSave();
      return;
    }

    if (!selectedAddressId) {
      Alert.alert("Select Address", "Please select or add a delivery address.");
      return;
    }

    setSubmitting(true);
    try {
      finishAddressFlow(selectedAddressId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <ScreenHeader
          title={
            isBuyNowFlow || isBookingFlow || isCheckoutFlow
              ? "Delivery Address"
              : "Manage Address"
          }
          onBack={handleAddressBack}
        />

        {showComingSoonBanner ? (
          <View style={styles.comingSoonBanner}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.primaryDark}
            />
            <Text style={styles.comingSoonText}>
              We are coming soon in your city
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            (mode === "form" || isBookingFlow || isBuyNowFlow) && styles.scrollWithStickyFooter,
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
                name="location-outline"
                size={36}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={styles.heroTitle}>Where should we deliver?</Text>
              <Text style={styles.heroSub}>
                {mode === "form"
                  ? "Enter your delivery details"
                  : isBuyNowFlow || isCheckoutFlow || isBookingFlow
                    ? "Select where we should deliver your order"
                    : "Add your delivery address"}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Address form - full screen when adding/editing */}
          {mode === "form" ? (
            <Animated.View
              entering={FadeInDown.delay(80).duration(400)}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>
                {editingId
                  ? "Edit Address"
                  : addresses.length > 0
                    ? "New Address"
                    : "Add Address"}
              </Text>

              {/* ── Location buttons ──────────────────── */}
              <View style={styles.locationBtnRow}>
                <TouchableOpacity
                  style={[styles.gpsBtn, styles.gpsBtnFlex, gpsLoading && styles.gpsBtnDisabled]}
                  onPress={() => void handleUseMyLocation()}
                  disabled={gpsLoading}
                  activeOpacity={0.8}
                >
                  {gpsLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primaryDark} />
                  ) : (
                    <Ionicons
                      name="locate-outline"
                      size={18}
                      color={COLORS.primaryDark}
                    />
                  )}
                  <Text style={styles.gpsBtnText} numberOfLines={1}>
                    {gpsLoading ? "Detecting…" : "Use my location"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.gpsBtn, styles.mapBtn]}
                  onPress={() => setMapPickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="map-outline" size={18} color={COLORS.primaryDark} />
                  <Text style={styles.gpsBtnText} numberOfLines={1}>Pick on map</Text>
                </TouchableOpacity>
              </View>

              {/* Serviceability badge */}
              {serviceability !== null ? (
                <View
                  style={[
                    styles.svcBadge,
                    serviceability.serviceable
                      ? styles.svcBadgeOk
                      : styles.svcBadgeFail,
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <Ionicons
                      name={
                        serviceability.serviceable
                          ? "checkmark-circle-outline"
                          : "close-circle-outline"
                      }
                      size={16}
                      color={serviceability.serviceable ? COLORS.success : COLORS.error}
                      style={{ marginTop: 1 }}
                    />
                    <Text
                      style={[
                        styles.svcBadgeText,
                        serviceability.serviceable
                          ? styles.svcBadgeTextOk
                          : styles.svcBadgeTextFail,
                      ]}
                    >
                      {serviceability.serviceable
                        ? `We deliver here${serviceability.city ? ` · ${serviceability.city}` : ""}${serviceability.distance_km != null ? ` · ${serviceability.distance_km} km away` : ""}`
                        : serviceability.message || "We don't deliver to this area yet"}
                    </Text>
                  </View>
                  {!serviceability.serviceable ? (
                    <TouchableOpacity
                      onPress={handleRegisterInterest}
                      disabled={interestState === "submitting" || interestState === "done"}
                      style={{
                        marginTop: 8,
                        alignSelf: "flex-start",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: COLORS.error,
                        opacity: interestState === "submitting" ? 0.6 : 1,
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.error }}>
                        {interestState === "done"
                          ? "Thanks! We'll notify you 🎉"
                          : interestState === "submitting"
                            ? "Submitting..."
                            : "I'm interested — notify me"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {/* GPS coords indicator */}
              {gpsCoords !== null && serviceability === null ? (
                <View style={styles.coordsHint}>
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color={COLORS.primaryDark}
                  />
                  <Text style={styles.coordsHintText}>
                    Location captured · {gpsCoords.latitude.toFixed(5)},{" "}
                    {gpsCoords.longitude.toFixed(5)}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Address Type</Text>
              <View style={styles.chipRow}>
                {ADDRESS_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      styles.chip,
                      addressType === t.key && styles.chipActive,
                    ]}
                    onPress={() => setAddressType(toApiAddressTypeValue(t.key))}
                  >
                    <Ionicons
                      name={t.icon as any}
                      size={14}
                      color={addressType === t.key ? COLORS.white : COLORS.gray}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        addressType === t.key && styles.chipTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>
                Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                ref={fullNameRef}
                style={[
                  styles.input,
                  fieldErrors.fullName ? styles.inputError : null,
                ]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Recipient name"
                placeholderTextColor={COLORS.gray}
                returnKeyType="next"
              />
              {fieldErrors.fullName ? (
                <Text style={styles.errorText}>{fieldErrors.fullName}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>
                Phone <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  fieldErrors.mobile ? styles.inputError : null,
                ]}
                value={mobile}
                onChangeText={(v) =>
                  setMobile(v.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="10-digit phone number"
                placeholderTextColor={COLORS.gray}
                keyboardType="number-pad"
                maxLength={10}
              />
              {fieldErrors.mobile ? (
                <Text style={styles.errorText}>{fieldErrors.mobile}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>
                House / Flat <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  fieldErrors.line1 ? styles.inputError : null,
                ]}
                value={line1}
                onChangeText={setLine1}
                placeholder="House no., flat, building"
                placeholderTextColor={COLORS.gray}
              />
              {fieldErrors.line1 ? (
                <Text style={styles.errorText}>{fieldErrors.line1}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>Street / Area</Text>
              <TextInput
                style={styles.input}
                value={line2}
                onChangeText={setLine2}
                placeholder="Street, colony, area"
                placeholderTextColor={COLORS.gray}
              />

              <Text style={styles.fieldLabel}>Landmark</Text>
              <TextInput
                style={styles.input}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Nearby landmark (optional)"
                placeholderTextColor={COLORS.gray}
              />

              <View style={styles.rowGroup}>
                <View style={styles.inputHalf}>
                  <LocationSelectField
                    label="City"
                    required
                    value={city}
                    options={cityOptions}
                    placeholder="Select city"
                    onSelect={handleCitySelect}
                    error={fieldErrors.city}
                  />
                </View>
                <View style={styles.inputHalf}>
                  <LocationSelectField
                    label="State"
                    required
                    value={state}
                    options={stateOptions}
                    placeholder="Select state"
                    onSelect={handleStateSelect}
                    error={fieldErrors.state}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>
                Pincode <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  fieldErrors.pincode ? styles.inputError : null,
                ]}
                value={pincode}
                onChangeText={(v) =>
                  setPincode(v.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6-digit pincode"
                placeholderTextColor={COLORS.gray}
                keyboardType="number-pad"
                maxLength={6}
              />
              {fieldErrors.pincode ? (
                <Text style={styles.errorText}>{fieldErrors.pincode}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setIsDefault((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.toggle, isDefault && styles.toggleActive]}>
                  <View
                    style={[
                      styles.toggleThumb,
                      isDefault && styles.toggleThumbActive,
                    ]}
                  />
                </View>
                <Text style={styles.toggleLabel}>Set as default address</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {/* Saved addresses - selection screen only */}
          {mode === "select" ? (
            <>
              {saveSuccess ? (
                <View style={styles.saveSuccessBanner}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.saveSuccessText}>
                    Address Saved Successfully
                  </Text>
                </View>
              ) : null}
              {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading addresses...</Text>
            </View>
          ) : error && addresses.length === 0 ? (
            <ErrorState message={error} onRetry={() => fetchAddresses()} />
          ) : addresses.length > 0 ? (
            <Animated.View
              entering={FadeInDown.delay(80).duration(400)}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>Saved Addresses</Text>
              {addresses.map((addr) => (
                <SavedAddressCard
                  key={addr.id}
                  address={addr}
                  selected={selectedAddressId === addr.id}
                  onSelect={() => {
                    setSaveSuccess(false);
                    setSelectedAddressIdLocal(addr.id);
                  }}
                  onEdit={() => loadAddressIntoForm(addr)}
                  onDelete={() => handleDeleteAddress(addr)}
                />
              ))}
              <TouchableOpacity
                style={styles.addNewBtn}
                onPress={openNewAddressForm}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={COLORS.primaryDark}
                />
                <Text style={styles.addNewText}>Add New Address</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View
              entering={FadeInDown.delay(80).duration(400)}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>Saved Addresses</Text>
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="location-outline"
                  size={48}
                  color={COLORS.grayBorder}
                />
                <Text style={styles.emptyTitle}>No saved addresses</Text>
                <Text style={styles.emptyDesc}>
                  Add a delivery address to continue
                </Text>
                <TouchableOpacity
                  style={styles.addNewFromEmpty}
                  onPress={openNewAddressForm}
                >
                  <Text style={styles.addNewFromEmptyText}>Add New Address</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
            </>
          ) : null}

          {/* Continue button - checkout / buy-now / manage (selection screen only) */}
          {!isBookingFlow && mode === "select" ? (
          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            style={styles.btnWrap}
          >
            <TouchableOpacity
              style={[
                styles.continueBtn,
                (submitting || saving) && styles.continueBtnDisabled,
              ]}
              onPress={handleContinue}
              disabled={submitting || saving}
              activeOpacity={0.85}
            >
              {submitting || saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={COLORS.white}
                  />
                  <Text style={styles.continueBtnText}>
                    {isBuyNowFlow
                      ? "Confirm Address"
                      : isCheckoutFlow
                        ? "Continue to Checkout"
                        : "Done"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
          ) : null}

          <View style={{ height: mode === "form" ? SPACING.lg : SPACING.xxl }} />
        </ScrollView>

        {mode === "form" ? (
          <View
            style={[
              styles.stickyFooter,
              { paddingBottom: Math.max(insets.bottom, SPACING.sm) },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.stickySaveBtn,
                (saving || submitting) && styles.continueBtnDisabled,
              ]}
              onPress={() => void handleStickyFormSave()}
              disabled={saving || submitting}
              activeOpacity={0.88}
            >
              {saving || submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color={COLORS.white}
                  />
                  <Text style={styles.stickySaveBtnText}>
                    {editingId ? "Update Address" : "Save Address"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : isBookingFlow ? (
          <View
            style={[
              styles.bookingFooter,
              { paddingBottom: Math.max(insets.bottom, SPACING.sm) },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.addToCartBtn,
                (submitting || saving || mutating || !selectedAddressId) &&
                  styles.continueBtnDisabled,
              ]}
              onPress={() => void handleAddToCartBooking()}
              disabled={
                submitting || saving || mutating || !selectedAddressId
              }
              activeOpacity={0.9}
            >
              {submitting || saving || mutating ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="cart-outline" size={22} color={COLORS.white} />
                  <Text style={styles.addToCartBtnText}>Proceed To Cart</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <MapPinPicker
        visible={mapPickerVisible}
        initialCoords={gpsCoords}
        onConfirm={handleMapConfirm}
        onClose={() => setMapPickerVisible(false)}
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

  comingSoonBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  comingSoonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },

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
    color: COLORS.success,
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

  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  loadingText: { fontSize: 14, color: COLORS.gray },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.md,
  },

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
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
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
  savedCardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: SPACING.sm,
  },
  savedTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  savedTypeIconSelected: { backgroundColor: COLORS.primaryDark },
  savedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: 2,
  },
  savedCardName: { flexShrink: 1, fontSize: 14, fontWeight: "700", color: COLORS.black },
  defaultBadge: {
    flexShrink: 0,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
  savedCardAddr: { fontSize: 12, color: COLORS.gray, lineHeight: 17 },
  savedCardCity: { fontSize: 12, color: COLORS.gray },
  savedCardPhone: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  savedCardActions: { alignItems: "center", gap: 10 },

  addNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },
  addNewText: { fontSize: 14, fontWeight: "600", color: COLORS.primaryDark },

  emptyWrap: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 18,
  },
  addNewFromEmpty: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  addNewFromEmptyText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: 6,
    marginTop: SPACING.sm,
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
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },

  rowGroup: { flexDirection: "row", gap: SPACING.sm },
  inputHalf: { flex: 1 },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
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
  chipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },
  chipTextActive: { color: COLORS.white },

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

  btnWrap: { gap: SPACING.sm },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    height: 54,
    ...SHADOW.card,
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { fontSize: 16, fontWeight: "700", color: COLORS.white },
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
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
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
  stickySaveBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
  },
  formSaveBtn: {
    marginTop: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    height: 52,
    ...SHADOW.card,
  },
  formSaveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },
  bookingFooter: {
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
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
    }),
  },
  addToCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    height: 56,
    ...SHADOW.card,
  },
  addToCartBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
  },

  // ── Geo-tagging ──────────────────────────────────────────────────────────
  locationBtnRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primaryLight,
  },
  gpsBtnFlex: { flex: 1 },
  mapBtn: { flex: 1 },
  gpsBtnDisabled: { opacity: 0.6 },
  gpsBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primaryDark,
    flexShrink: 1,
  },
  svcBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  svcBadgeOk: {
    backgroundColor: "#D1FAE5",
    borderColor: "rgba(5,150,105,0.25)",
  },
  svcBadgeFail: {
    backgroundColor: "#FEE2E2",
    borderColor: "rgba(220,38,38,0.25)",
  },
  svcBadgeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  svcBadgeTextOk: { color: COLORS.success },
  svcBadgeTextFail: { color: COLORS.error },
  coordsHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: SPACING.sm,
  },
  coordsHintText: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: "500",
  },
});
