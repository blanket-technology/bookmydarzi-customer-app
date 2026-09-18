/**
 * Dedicated Edit Profile page (Bug Report cycle 1, item 1.3).
 *
 * Previously the profile edit form was an inline `isEditing` toggle inside the
 * Profile tab. It now lives on its own route, opened from the "Edit" button in
 * the Personal Info section. Reuses the same profileService.updateProfile call
 * and useAuthStore update the inline form used, so behaviour is unchanged - only
 * the presentation moved to a separate screen.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../constants/theme";
import ScreenHeader from "../src/components/common/ScreenHeader";
import { getProfileDisplayEmail } from "../src/utils/email";
import { getUserMobile } from "../src/utils/userPhone";
import { updateProfile } from "../src/services/profileService";
import { useAuthStore } from "../store/useAuthStore";

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;

function normalizeGender(g?: string | null): string {
  return g ? g.charAt(0).toUpperCase() + g.slice(1) : "";
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, fetchProfile, savedPhoneOverride } = useAuthStore();

  const displayEmail = getProfileDisplayEmail(user?.email);
  const displayPhone = getUserMobile(user ?? undefined, savedPhoneOverride);

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(displayEmail);
  const [gender, setGender] = useState<string>(normalizeGender(user?.gender));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
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
    if (!validate()) return;
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
      Alert.alert("Saved", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ?? "Failed to update profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader title="Edit Profile" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.fieldLabel}>First Name</Text>
          <TextInput
            style={[styles.input, errors.firstName ? styles.inputError : null]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={COLORS.gray}
          />
          {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}

          <Text style={styles.fieldLabel}>Last Name</Text>
          <TextInput
            style={[styles.input, errors.lastName ? styles.inputError : null]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={COLORS.gray}
          />
          {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}

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
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          <Text style={styles.fieldLabel}>Phone Number</Text>
          <TouchableOpacity
            style={styles.readonlyField}
            onPress={() => router.push("/change-mobile" as never)}
            accessibilityRole="button"
            accessibilityLabel="Change mobile number"
          >
            <Ionicons name="call-outline" size={15} color={COLORS.gray} />
            <Text style={styles.readonlyFieldText}>{displayPhone || "Not set"}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.changeLink}>Change</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.fieldHint}>Changing your number requires OTP verification on both numbers</Text>

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
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

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite ?? "#F6F8F8" },
  content: { padding: SPACING.md, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.gray,
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: "#E5E9E9",
  },
  inputError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 11, marginTop: 4 },
  readonlyField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF2F2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readonlyFieldText: { fontSize: 14, color: COLORS.gray, fontWeight: "600" },
  changeLink: { fontSize: 13, fontWeight: "700", color: COLORS.primaryDark, marginRight: 2 },
  fieldHint: { fontSize: 11, color: COLORS.gray, marginTop: 5 },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#E5E9E9",
  },
  genderChipActive: { backgroundColor: "#E6F5F6", borderColor: COLORS.primary },
  genderChipText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },
  genderChipTextActive: { color: COLORS.primaryDark },
  saveBtn: {
    marginTop: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
