import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { UserAvatar } from "../../src/components/common/UserAvatar";
import { useAppLanguage } from "../../src/i18n/useAppLanguage";
import {
    deleteAccount,
    updateProfile,
    uploadProfileAvatar,
} from "../../src/services/profileService";
import { useAddressStore } from "../../src/store/useAddressStore";
import { useMeasurementStore } from "../../src/store/useMeasurementStore";
import { formatAddressSummary } from "../../src/utils/addressDisplay";
import { getProfileDisplayEmail } from "../../src/utils/email";
import {
    pickProfilePhotoFromLibrary,
    PROFILE_PHOTO_PICKER_REBUILD_MSG,
    ProfilePhotoPickerUnavailableError,
} from "../../src/utils/profilePhotoPicker";
import { getUserMobile } from "../../src/utils/userPhone";
import { useAuthStore } from "../../store/useAuthStore";

const MENU_ITEMS = [
  // My Orders, Payments, Notifications, Wishlist, and Change Password
  // intentionally removed from the profile menu. My Orders lives in its own
  // bottom-tab; Payments/Notifications screens + routes are kept in code,
  // just no longer surfaced here; Wishlist is removed entirely; Change
  // Password is removed from the customer app per product decision.
  { icon: "help-circle-outline",   labelKey: "profile.menu.help",            key: "help" },
  { icon: "document-text-outline", labelKey: "profile.menu.faq",             key: "faq" },
  { icon: "star-outline",          labelKey: "profile.menu.rate",            key: "rate" },
  { icon: "shield-checkmark-outline", labelKey: "profile.menu.privacy",      key: "privacy" },
  { icon: "reader-outline",        labelKey: "profile.menu.terms",           key: "terms" },
  { icon: "information-circle-outline", labelKey: "profile.menu.about",      key: "about" },
] as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthenticated, logout, fetchProfile, savedPhoneOverride } =
    useAuthStore();
  const { t } = useAppLanguage();
  const displayPhone = getUserMobile(user, savedPhoneOverride);
  const {
    addresses,
    loading: addressesLoading,
    fetchAddresses,
  } = useAddressStore();
  const {
    measurements,
    loading: measurementsLoading,
    fetchMeasurements,
  } = useMeasurementStore();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState("");
  const normalizeGender = (g?: string | null) =>
    g ? g.charAt(0).toUpperCase() + g.slice(1) : "";
  const [gender, setGender] = useState<string>(normalizeGender(user?.gender));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);

  const displayEmail = getProfileDisplayEmail(user?.email);
  const displayImageUri = avatarPreviewUri ?? user?.profile_image ?? null;

  // Fetch fresh profile from backend every time this tab gains focus
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      setProfileLoading(true);
      Promise.all([
        fetchProfile(),
        fetchAddresses(),
        fetchMeasurements(),
      ]).finally(() => setProfileLoading(false));
    }, [isAuthenticated, fetchProfile, fetchAddresses, fetchMeasurements]),
  );

  const prefillEmail = () => displayEmail;

  // Sync local edit state when user data updates from backend
  useEffect(() => {
    if (!isEditing) {
      setFirstName(user?.first_name ?? "");
      setLastName(user?.last_name ?? "");
      setEmail(prefillEmail());
      setGender(normalizeGender(user?.gender));
    }
  }, [user, isEditing, displayEmail]);

  const finishProfileSave = async (
    message = "Profile updated successfully!",
  ) => {
    await fetchProfile();
    setIsEditing(false);
    Alert.alert("Saved", message);
  };

  const handlePickProfilePhoto = async () => {
    try {
      const uri = await pickProfilePhotoFromLibrary();
      if (!uri) return;

      setAvatarPreviewUri(uri);
      setUploadingPhoto(true);

      const uploadedUrl = await uploadProfileAvatar(uri, user?.id ?? "");
      if (uploadedUrl) {
        const current = useAuthStore.getState().user;
        if (current) {
          useAuthStore.setState({
            user: { ...current, profile_image: uploadedUrl },
          });
        }
      }

      await fetchProfile();
      Alert.alert("Updated", "Profile photo updated.");
    } catch (err: unknown) {
      if (err instanceof ProfilePhotoPickerUnavailableError) {
        Alert.alert(
          "Photo picker unavailable",
          PROFILE_PHOTO_PICKER_REBUILD_MSG,
        );
        return;
      }
      if (err instanceof Error && err.message === "PERMISSION_DENIED") {
        Alert.alert(
          "Permission needed",
          "Allow photo access to update your profile picture.",
        );
        return;
      }
      const msg =
        err instanceof Error ? err.message : "Failed to upload photo.";
      Alert.alert("Upload failed", msg);
    } finally {
      setUploadingPhoto(false);
      setAvatarPreviewUri(null);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          // Guest browsing is allowed on (tabs), so logout returns the user to
          // the home tab (not login). replace() resets the stack so the
          // now-signed-out profile screen isn't left behind it.
          await logout();
          router.replace("/(tabs)");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your BookMyDarzi account. You'll lose access to your order history, addresses and saved measurements. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Second confirmation for a destructive, irreversible action -
            // matches the weight of what's being done, unlike Logout which
            // is reversible by logging back in.
            Alert.alert(
              "Are you absolutely sure?",
              "Your account and all associated data will be deleted immediately.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete my account",
                  style: "destructive",
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      await deleteAccount();
                      await logout();
                      router.replace("/(tabs)");
                    } catch (err) {
                      const msg =
                        err instanceof Error ? err.message : "Couldn't delete your account. Please try again.";
                      Alert.alert("Delete failed", msg);
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
    const emailTrimmed = email.trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errs.email = "Enter a valid email address";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await updateProfile(user?.id ?? "", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        gender: gender || undefined,
      });

      const current = useAuthStore.getState().user;
      if (current) {
        useAuthStore.setState({
          user: {
            ...current,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            email: email.trim() || current.email,
            gender,
          },
        });
      }

      await fetchProfile();
      setIsEditing(false);
      Alert.alert("Saved", "Profile updated successfully!");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ?? "Failed to update profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFirstName(user?.first_name ?? "");
    setLastName(user?.last_name ?? "");
    setEmail(prefillEmail());
    setGender(normalizeGender(user?.gender));
    setErrors({});
    setIsEditing(false);
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.guestContainer}>
          <Ionicons
            name="person-circle-outline"
            size={80}
            color={COLORS.grayBorder}
          />
          <Text style={styles.guestTitle}>You&apos;re not logged in</Text>
          <Text style={styles.guestSub}>
            Login to view and manage your profile
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/(auth)/welcome" as any)}
          >
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.root}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Gradient hero - header + avatar in one band */}
        <LinearGradient
          colors={["#149694", "#0c6c75"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroGradient, { paddingTop: insets.top + 8 }]}
        >
          {/* Title row - the Edit control moved to the Personal Info section
              (item 1.3), so the hero just shows the title now. */}
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitle}>My Profile</Text>
          </View>

          {/* Avatar */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarCenter}>
            <View style={styles.avatarWrap}>
              <UserAvatar size={72} imageUri={displayImageUri} />
              <TouchableOpacity
                style={styles.avatarEditBtn}
                onPress={handlePickProfilePhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="camera-outline" size={14} color={COLORS.white} />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>
                {(user?.name ??
                  `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()) ||
                  "User"}
              </Text>
              {profileLoading && (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={{ marginLeft: 8 }} />
              )}
            </View>
            {/* Email/phone removed from the hero to avoid duplicating what the
                Personal Info card below already shows (user-reported redundant
                data). The hero is just the identity summary now. */}
          </Animated.View>
        </LinearGradient>

        {/* Personal info display. Editing now opens a dedicated /edit-profile
            page (Bug Report cycle 1, item 1.3) via the Edit button in this
            section's header, rather than an inline in-place form. */}
        {(
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={[styles.card, styles.cardFirst]}
          >
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Personal Info</Text>
              <TouchableOpacity
                style={styles.sectionEditBtn}
                onPress={() => router.push("/edit-profile" as any)}
                accessibilityRole="button"
                accessibilityLabel="Edit personal information"
              >
                <Ionicons name="pencil-outline" size={13} color={COLORS.primaryDark} />
                <Text style={styles.sectionEditText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {[
              {
                label: "Full Name",
                value:
                  (user?.name ??
                    `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()) ||
                  "Not set",
                icon: "person-outline",
              },
              {
                label: "Email",
                value: displayEmail || "Not Set",
                icon: "mail-outline",
              },
              {
                label: "Phone",
                value: displayPhone || "Not set",
                icon: "call-outline",
              },
              {
                label: "Gender",
                value: user?.gender ? normalizeGender(user.gender) : "Not set",
                icon: "person-outline",
              },
            ].map((item) => (
              <View key={item.label} style={styles.infoRow}>
                <Ionicons
                  name={item.icon as any}
                  size={16}
                  color={COLORS.primary}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Saved addresses */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          style={styles.card}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Saved Addresses</Text>
            <TouchableOpacity onPress={() => router.push("/address" as any)}>
              <Text style={styles.sectionLink}>Manage</Text>
            </TouchableOpacity>
          </View>
          {addressesLoading && addresses.length === 0 ? (
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
              style={{ marginVertical: 8 }}
            />
          ) : addresses.length === 0 ? (
            <Text style={styles.emptyHint}>No saved addresses yet.</Text>
          ) : (
            addresses.slice(0, 3).map((addr) => (
              <View key={addr.id} style={styles.listItem}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={COLORS.primary}
                />
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{addr.full_name}</Text>
                  <Text style={styles.listItemSub} numberOfLines={3}>
                    {formatAddressSummary(addr)}
                  </Text>
                </View>
                {addr.is_default ? (
                  <View style={styles.miniBadge}>
                    <Text style={styles.miniBadgeText}>Default</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </Animated.View>

        {/* Saved measurements - reference only, not required to book */}
        <Animated.View
          entering={FadeInDown.delay(135).duration(400)}
          style={styles.card}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Measurements</Text>
            <TouchableOpacity onPress={() => router.push("/measurements" as any)}>
              <Text style={styles.sectionLink}>Manage</Text>
            </TouchableOpacity>
          </View>
          {measurementsLoading && measurements.length === 0 ? (
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
              style={{ marginVertical: 8 }}
            />
          ) : measurements.length === 0 ? (
            <Text style={styles.emptyHint}>
              Recorded by our team at your next pickup.
            </Text>
          ) : (
            measurements.slice(0, 3).map((m) => (
              <View key={m.id} style={styles.listItem}>
                <Ionicons name="body-outline" size={16} color={COLORS.primary} />
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{m.profile_name}</Text>
                  <Text style={styles.listItemSub} numberOfLines={1}>
                    {m.gender === "male"
                      ? "Men's"
                      : m.gender === "female"
                        ? "Women's"
                        : m.gender === "kids"
                          ? "Kids'"
                          : "General"}
                  </Text>
                </View>
                {m.is_default ? (
                  <View style={styles.miniBadge}>
                    <Text style={styles.miniBadgeText}>Default</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </Animated.View>

        {/* Menu items */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(400)}
          style={styles.card}
        >
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.menuItem,
                i < MENU_ITEMS.length - 1 && styles.menuItemBorder,
              ]}
              onPress={() => {
                if (item.key === "help") router.push("/support" as any);
                if (item.key === "faq") router.push("/faq" as any);
                if (item.key === "privacy") router.push("/privacy" as any);
                if (item.key === "terms") router.push("/terms" as any);
                if (item.key === "about") router.push("/about" as any);
              }}
            >
              <View style={styles.menuIconBox}>
                <Ionicons
                  name={item.icon as any}
                  size={18}
                  color={COLORS.primaryDark}
                />
              </View>
              <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.gray}
                style={{ marginLeft: "auto" }}
              />
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Logout */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.logoutWrap}
        >
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            <Text style={styles.logoutText}>{t("profile.logout")}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Delete account - own row below Logout, same destructive styling,
            but plain text (no filled background) so it doesn't visually
            compete with Logout as the primary destructive action. */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(400)}
          style={styles.deleteAccountWrap}
        >
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color={COLORS.gray} />
            ) : (
              <Text style={styles.deleteAccountText}>Delete my account</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Trimmed from xxl (48) to lg (24) - removes the extra gap below
            Logout (Bug Report cycle 1, item 1.4) while keeping the button
            clear of the bottom tab bar. */}
        <View style={{ height: SPACING.lg }} />
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: COLORS.offWhite },

  heroGradient: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  editBtnText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  avatarCenter: { alignItems: "center" },
  avatarWrap: { position: "relative", marginBottom: SPACING.sm },
  avatarEditBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  userNameRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  userEmail: { fontSize: 13, color: "rgba(255,255,255,0.82)", marginBottom: 8 },
  heroPhoneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroPhoneText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  cardFirst: {
    marginTop: -18,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.md,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#F0FDFC",
    borderWidth: 1,
    borderColor: "#C7F0EE",
    marginBottom: SPACING.md,
  },
  sectionEditText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  changePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.gray, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: "500", color: COLORS.black },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { fontSize: 14, fontWeight: "500", color: COLORS.black },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  sectionLink: { fontSize: 13, fontWeight: "600", color: COLORS.primaryDark },
  emptyHint: {
    fontSize: 13,
    color: COLORS.gray,
    fontStyle: "italic",
    paddingVertical: SPACING.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  listItemContent: { flex: 1 },
  listItemTitle: { fontSize: 14, fontWeight: "600", color: COLORS.black },
  listItemSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  miniBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  miniBadgeText: { fontSize: 10, fontWeight: "700", color: COLORS.primaryDark },
  logoutWrap: { paddingHorizontal: SPACING.md },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: COLORS.error },
  deleteAccountWrap: { paddingHorizontal: SPACING.md, marginTop: SPACING.sm },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.sm,
  },
  deleteAccountText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },
  guestContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  guestTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  guestSub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  loginBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 24,
    paddingVertical: 11,
    marginTop: SPACING.md,
  },
  loginBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  readonlyField: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  readonlyFieldText: { fontSize: 14, color: COLORS.gray },
});
