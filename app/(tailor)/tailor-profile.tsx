import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import {
    type TailorProfile,
    getMyTailorProfile,
    updateMyTailorProfile,
    updateOnlineStatus,
} from "../../src/services/tailorService";
import { useAuthStore } from "../../store/useAuthStore";

const TEAL = "#0c6c75";
const TEAL_LIGHT = "#1aa3b0";

export default function TailorProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<TailorProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Online toggle
  const [isOnline, setIsOnline] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    specialization: "",
    experience: "",
    location: "",
    bio: "",
  });

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const p = await getMyTailorProfile();
      setProfile(p);
      setIsOnline(p.IsOnline ?? false);
      setForm({
        specialization: p.Specialization ?? "",
        experience: p.Experience ? String(p.Experience) : "",
        location: p.Location ?? "",
        bio: p.Bio ?? "",
      });
    } catch {
      // profile may not exist yet - silently ignore
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const handleOnlineToggle = async (next: boolean) => {
    setOnlineBusy(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (next) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          // Going online with no location makes this tailor permanently
          // invisible to order broadcasts (the backend requires a location
          // fix to match nearby orders) - never silently report "online"
          // when that's not actually true. Explain why and stop here
          // instead of proceeding with lat/lng = null.
          Alert.alert(
            "Location needed",
            "Turn on location access so nearby orders can find you, then try going online again.",
          );
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      await updateOnlineStatus(next, lat, lng);
      setIsOnline(next);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not update online status.");
    } finally {
      setOnlineBusy(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const expNum = parseInt(form.experience, 10);
      const updated = await updateMyTailorProfile({
        specialization: form.specialization.trim() || undefined,
        experience: isNaN(expNum) ? undefined : expNum,
        location: form.location.trim() || undefined,
        bio: form.bio.trim() || undefined,
      });
      setProfile(updated);
      setEditing(false);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // reset form to last saved values
    setForm({
      specialization: profile?.Specialization ?? "",
      experience: profile?.Experience ? String(profile.Experience) : "",
      location: profile?.Location ?? "",
      bio: profile?.Bio ?? "",
    });
    setEditing(false);
  };

  const initials = (user?.name ?? "T")
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Gradient header */}
        <LinearGradient
          colors={[TEAL, TEAL_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerBg, { paddingTop: insets.top + SPACING.md }]}
        >
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: isOnline ? "#4ADE80" : "#9CA3AF" },
              ]}
            />
          </View>
          <Text style={styles.name}>{user?.name ?? "Tailor"}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="cut-outline" size={12} color="#fff" />
            <Text style={styles.roleText}>TAILOR</Text>
          </View>
          {profile && (
            <Text style={styles.ratingText}>
              ★ {profile.Rating?.toFixed(1) ?? "–"}
              {profile.Experience ? `  ·  ${profile.Experience}y exp` : ""}
            </Text>
          )}
        </LinearGradient>

        {/* Contact info */}
        <View style={[styles.card, { marginTop: -16 }]}>
          <Text style={styles.cardTitle}>Contact Information</Text>
          <InfoRow icon="call-outline" label="Mobile" value={user?.mobile ?? user?.phone ?? "Not set"} />
          <View style={styles.divider} />
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? "Not set"} />
        </View>

        {/* Professional profile */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Professional Profile</Text>
            {!editing && !loadingProfile && (
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={15} color={TEAL} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingProfile ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={TEAL} />
            </View>
          ) : editing ? (
            <View style={styles.editForm}>
              <Field
                label="Specialization"
                placeholder="e.g. Bridal wear, Men's kurta"
                value={form.specialization}
                onChangeText={(t) => setForm((f) => ({ ...f, specialization: t }))}
              />
              <Field
                label="Experience (years)"
                placeholder="e.g. 5"
                value={form.experience}
                onChangeText={(t) => setForm((f) => ({ ...f, experience: t }))}
                keyboardType="numeric"
              />
              <Field
                label="Location / City"
                placeholder="e.g. Noida, Delhi NCR"
                value={form.location}
                onChangeText={(t) => setForm((f) => ({ ...f, location: t }))}
              />
              <Field
                label="Bio"
                placeholder="Tell customers about your craft..."
                value={form.bio}
                onChangeText={(t) => setForm((f) => ({ ...f, bio: t }))}
                multiline
                numberOfLines={3}
              />

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancelEdit}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="checkmark-outline" size={16} color="#fff" />
                  )}
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <InfoRow
                icon="color-palette-outline"
                label="Specialization"
                value={profile?.Specialization || "Not set"}
                iconBg="#FEF3C7"
                iconColor="#D97706"
              />
              <View style={styles.divider} />
              <InfoRow
                icon="time-outline"
                label="Experience"
                value={profile?.Experience ? `${profile.Experience} year${profile.Experience !== 1 ? "s" : ""}` : "Not set"}
                iconBg="#EDE9FE"
                iconColor="#7C3AED"
              />
              <View style={styles.divider} />
              <InfoRow
                icon="location-outline"
                label="City / Area"
                value={profile?.Location || "Not set"}
                iconBg="#ECFEFF"
                iconColor="#0891B2"
              />
              {(profile?.Bio) && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.bioRow}>
                    <View style={[styles.itemIcon, { backgroundColor: "#F0FDF4" }]}>
                      <Ionicons name="document-text-outline" size={18} color="#16A34A" />
                    </View>
                    <View style={styles.itemText}>
                      <Text style={styles.itemLabel}>Bio</Text>
                      <Text style={[styles.itemSub, { lineHeight: 18 }]}>{profile.Bio}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* Online status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Availability</Text>
          <View style={styles.item}>
            <View
              style={[
                styles.itemIcon,
                { backgroundColor: isOnline ? "#DCFCE7" : "#F3F4F6" },
              ]}
            >
              <Ionicons
                name={isOnline ? "radio" : "radio-outline"}
                size={18}
                color={isOnline ? "#16A34A" : COLORS.gray}
              />
            </View>
            <View style={styles.itemText}>
              <Text style={styles.itemLabel}>Online for Orders</Text>
              <Text
                style={[
                  styles.itemSub,
                  { color: isOnline ? "#16A34A" : COLORS.gray },
                ]}
              >
                {isOnline
                  ? "You're receiving broadcast offers"
                  : "Go online to receive new orders"}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleOnlineToggle}
              disabled={onlineBusy}
              trackColor={{ false: COLORS.grayBorder, true: TEAL_LIGHT }}
              thumbColor={isOnline ? TEAL : "#f4f3f4"}
            />
          </View>
        </View>

        {/* Account info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <InfoRow
            icon="shield-checkmark-outline"
            label="Account Status"
            value="Active"
            valueColor="#16A34A"
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
          />
          <View style={styles.divider} />
          <InfoRow
            icon="information-circle-outline"
            label="App Version"
            value="1.0.0"
            iconBg="#FEF3C7"
            iconColor="#D97706"
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.card, styles.logoutRow]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={[styles.itemIcon, { backgroundColor: COLORS.errorLight }]}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  iconBg,
  iconColor,
  valueColor,
}: {
  icon: string;
  label: string;
  value: string;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.item}>
      <View style={[styles.itemIcon, { backgroundColor: iconBg ?? (TEAL + "15") }]}>
        <Ionicons name={icon as any} size={18} color={iconColor ?? TEAL} />
      </View>
      <View style={styles.itemText}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={[styles.itemSub, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      </View>
    </View>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  multiline,
  numberOfLines,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  content: { gap: 12 },
  headerBg: {
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingBottom: 36,
  },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, color: "#fff", ...FONTS.bold },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
  },
  name: { fontSize: 22, ...FONTS.bold, color: "#fff", marginBottom: 6 },
  ratingText: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    marginBottom: 2,
  },
  roleText: { fontSize: 11, color: "#fff", ...FONTS.bold, letterSpacing: 1 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    ...SHADOW.card,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: SPACING.md,
  },
  cardTitle: {
    fontSize: 11,
    ...FONTS.semiBold,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 8,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: TEAL + "50",
    backgroundColor: TEAL + "10",
  },
  editBtnText: { fontSize: 12, color: TEAL, ...FONTS.semiBold },
  loadingRow: { paddingVertical: 20, alignItems: "center" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    gap: 12,
  },
  bioRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    gap: 12,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1 },
  itemLabel: { fontSize: 14, color: COLORS.black, ...FONTS.medium },
  itemSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.grayBorder,
    marginLeft: 66,
  },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    gap: 12,
  },
  logoutText: { fontSize: 15, color: COLORS.error, ...FONTS.semiBold, flex: 1 },
  // Edit form
  editForm: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    ...FONTS.semiBold,
    color: COLORS.gray,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.black,
    backgroundColor: COLORS.offWhite,
    ...FONTS.regular,
  },
  fieldInputMulti: {
    height: 80,
    paddingTop: 10,
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, ...FONTS.semiBold, color: COLORS.gray },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: TEAL,
  },
  saveBtnText: { fontSize: 14, ...FONTS.semiBold, color: "#fff" },
});
