import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { UserAvatar } from "../../src/components/common/UserAvatar";
import {
  updateProfile,
  uploadProfileAvatar,
} from "../../src/services/profileService";
import { useAddressStore } from "../../src/store/useAddressStore";
import { useMeasurementStore } from "../../src/store/useMeasurementStore";
import { formatAddressSummary } from "../../src/utils/addressDisplay";
import { getProfileDisplayEmail } from "../../src/utils/email";
import { formatMeasurementDetailLines } from "../../src/utils/measurementDisplay";
import {
  pickProfilePhotoFromLibrary,
  PROFILE_PHOTO_PICKER_REBUILD_MSG,
  ProfilePhotoPickerUnavailableError,
} from "../../src/utils/profilePhotoPicker";
import { getUserMobile } from "../../src/utils/userPhone";
import { request, API_V1_BASE_URL } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";

const MENU_ITEMS = [
  { icon: "location-outline",      label: "Saved Addresses",  key: "addresses" },
  { icon: "heart-outline",         label: "Wishlist",         key: "wishlist" },
  { icon: "notifications-outline", label: "Notifications",    key: "notifications" },
  { icon: "lock-closed-outline",   label: "Change Password",  key: "changePassword" },
  { icon: "shield-outline",        label: "Privacy Settings", key: "privacy" },
  { icon: "help-circle-outline",   label: "Help & Support",   key: "help" },
  { icon: "document-text-outline", label: "FAQs",             key: "faq" },
  { icon: "star-outline",          label: "Rate the App",     key: "rate" },
] as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthenticated, logout, fetchProfile, savedPhoneOverride } =
    useAuthStore();
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
  const [gender, setGender] = useState<string>(user?.gender ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);

  // Change-password modal state
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

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
      setGender((user as any)?.gender ?? "");
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
          await logout();
          router.push("/(auth)/login");
        },
      },
    ]);
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
    setGender((user as any)?.gender ?? "");
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
          <Text style={styles.guestTitle}>You're not logged in</Text>
          <Text style={styles.guestSub}>
            Login to view and manage your profile
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/(auth)/login")}
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
        {/* Gradient hero — header + avatar in one band */}
        <LinearGradient
          colors={["#149694", "#0c6c75"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroGradient, { paddingTop: insets.top + 8 }]}
        >
          {/* Title row */}
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitle}>My Profile</Text>
            {!isEditing ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setEmail(prefillEmail());
                  setIsEditing(true);
                }}
              >
                <Ionicons name="pencil-outline" size={15} color="#FFFFFF" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Avatar */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarCenter}>
            <View style={styles.avatarWrap}>
              <UserAvatar size={96} imageUri={displayImageUri} />
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
            <Text style={styles.userEmail}>{displayEmail || "No email set"}</Text>
            {displayPhone ? (
              <View style={styles.heroPhoneChip}>
                <Ionicons name="call-outline" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroPhoneText}>{displayPhone}</Text>
              </View>
            ) : null}
          </Animated.View>
        </LinearGradient>

        {/* Edit form */}
        {isEditing ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.card, styles.cardFirst]}
          >
            <Text style={styles.cardTitle}>Edit Profile</Text>

            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={handlePickProfilePhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={COLORS.primaryDark} />
              ) : (
                <Ionicons
                  name="image-outline"
                  size={18}
                  color={COLORS.primaryDark}
                />
              )}
              <Text style={styles.changePhotoText}>
                {uploadingPhoto
                  ? "Uploading photo..."
                  : displayImageUri
                    ? "Change Photo"
                    : "Upload Photo"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>First Name</Text>
            <TextInput
              style={[
                styles.input,
                errors.firstName ? styles.inputError : null,
              ]}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={COLORS.gray}
            />
            {errors.firstName ? (
              <Text style={styles.errorText}>{errors.firstName}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Last Name</Text>
            <TextInput
              style={[styles.input, errors.lastName ? styles.inputError : null]}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={COLORS.gray}
            />
            {errors.lastName ? (
              <Text style={styles.errorText}>{errors.lastName}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={COLORS.gray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={styles.readonlyField}>
              <Ionicons name="call-outline" size={15} color={COLORS.gray} />
              <Text style={styles.readonlyFieldText}>{displayPhone || "Not set"}</Text>
            </View>
            <Text style={styles.fieldHint}>Phone changes require verification via OTP</Text>

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {(["Male", "Female", "Other", "Prefer not to say"] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, gender === g && styles.genderChipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelEditBtn}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : (
          /* Profile info display */
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={[styles.card, styles.cardFirst]}
          >
            <Text style={styles.cardTitle}>Personal Info</Text>
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
                value: (user as any)?.gender || "Not set",
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

        {/* Measurements */}
        <Animated.View
          entering={FadeInDown.delay(140).duration(400)}
          style={styles.card}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>My Measurements</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/measurement",
                  params: { mode: "saved" },
                })
              }
            >
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
              No measurement profiles saved yet.
            </Text>
          ) : (
            measurements.slice(0, 3).map((m) => (
              <View key={m.id} style={styles.listItem}>
                <Ionicons
                  name="resize-outline"
                  size={16}
                  color={COLORS.primary}
                />
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{m.profile_name}</Text>
                  {formatMeasurementDetailLines(m).map((line) => (
                    <Text key={`${m.id}-${line}`} style={styles.listItemSub}>
                      {line}
                    </Text>
                  ))}
                  {m.is_default ? (
                    <Text style={styles.listItemSub}>Default profile</Text>
                  ) : null}
                </View>
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
                if (item.key === "addresses") router.push("/address" as any);
                if (item.key === "wishlist") router.push("/wishlist" as any);
                if (item.key === "notifications")
                  router.push("/notifications" as any);
                if (item.key === "help") router.push("/support" as any);
                if (item.key === "faq") router.push("/faq" as any);
                if (item.key === "changePassword") {
                  setOldPwd("");
                  setNewPwd("");
                  setShowPwdModal(true);
                }
              }}
            >
              <View style={styles.menuIconBox}>
                <Ionicons
                  name={item.icon as any}
                  size={18}
                  color={COLORS.primaryDark}
                />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
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
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPwdModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPwdModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.fieldLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={oldPwd}
              onChangeText={setOldPwd}
              placeholder="Enter current password"
              placeholderTextColor={COLORS.gray}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPwd}
              onChangeText={setNewPwd}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              placeholderTextColor={COLORS.gray}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelEditBtn}
                onPress={() => setShowPwdModal(false)}
                disabled={pwdSaving}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, pwdSaving && styles.saveBtnDisabled]}
                disabled={pwdSaving}
                onPress={async () => {
                  if (!oldPwd.trim() || !newPwd.trim()) {
                    Alert.alert("Error", "Both fields are required.");
                    return;
                  }
                  if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
                    Alert.alert("Weak password", "New password must be at least 8 characters with 1 uppercase letter and 1 number.");
                    return;
                  }
                  setPwdSaving(true);
                  try {
                    await request(`${API_V1_BASE_URL}/users/change-password`, {
                      method: "PATCH",
                      body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
                    });
                    setShowPwdModal(false);
                    Alert.alert("Success", "Password changed successfully.");
                  } catch (err: any) {
                    Alert.alert("Error", err?.message ?? "Failed to change password.");
                  } finally {
                    setPwdSaving(false);
                  }
                }}
              >
                <Text style={styles.saveBtnText}>{pwdSaving ? "Saving..." : "Update"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: COLORS.offWhite },

  heroGradient: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 44,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
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
    fontSize: 21,
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
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  cardFirst: {
    marginTop: -24,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.md,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    fontSize: 14,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },
  editActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelEditBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelEditText: { fontSize: 14, fontWeight: "600", color: COLORS.gray },
  saveBtn: {
    flex: 2,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
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
  logoutWrap: { paddingHorizontal: SPACING.lg },
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
  guestContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  guestTitle: { fontSize: 18, fontWeight: "700", color: COLORS.black },
  guestSub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  loginBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 32,
    paddingVertical: 12,
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
  fieldHint: { fontSize: 11, color: COLORS.gray, marginTop: 4, marginBottom: 4, fontStyle: "italic" },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  genderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    backgroundColor: COLORS.grayLight,
  },
  genderChipActive: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
  },
  genderChipText: { fontSize: 13, color: COLORS.gray },
  genderChipTextActive: { color: COLORS.primaryDark, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  modalCard: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.md },
});
