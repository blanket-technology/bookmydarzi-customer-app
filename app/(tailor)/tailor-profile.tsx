import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { useAuthStore } from "../../store/useAuthStore";

const TEAL = "#0c6c75";
const TEAL_LIGHT = "#1aa3b0";

export default function TailorProfile() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const initials = (user?.name ?? "T")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
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
          <View style={styles.onlineDot} />
        </View>
        <Text style={styles.name}>{user?.name ?? "Tailor"}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="cut-outline" size={12} color="#fff" />
          <Text style={styles.roleText}>TAILOR</Text>
        </View>
      </LinearGradient>

      {/* Contact info card */}
      <View style={[styles.card, { marginTop: -16 }]}>
        <Text style={styles.cardTitle}>Contact Information</Text>

        <View style={styles.item}>
          <View style={[styles.itemIcon, { backgroundColor: TEAL + "15" }]}>
            <Ionicons name="call-outline" size={18} color={TEAL} />
          </View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>Mobile</Text>
            <Text style={styles.itemSub}>{user?.mobile ?? user?.phone ?? "Not set"}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.item}>
          <View style={[styles.itemIcon, { backgroundColor: TEAL + "15" }]}>
            <Ionicons name="mail-outline" size={18} color={TEAL} />
          </View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>Email</Text>
            <Text style={styles.itemSub}>{user?.email ?? "Not set"}</Text>
          </View>
        </View>
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <View style={styles.item}>
          <View style={[styles.itemIcon, { backgroundColor: "#EDE9FE" }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#7C3AED" />
          </View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>Account Status</Text>
            <Text style={[styles.itemSub, { color: "#16A34A" }]}>Active</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <View style={[styles.itemIcon, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="information-circle-outline" size={18} color="#D97706" />
          </View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>App Version</Text>
            <Text style={styles.itemSub}>1.0.0</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={[styles.card, styles.logoutRow]} onPress={handleLogout} activeOpacity={0.7}>
        <View style={[styles.itemIcon, { backgroundColor: COLORS.errorLight }]}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
        </View>
        <Text style={styles.logoutText}>Logout</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.error} />
      </TouchableOpacity>
    </ScrollView>
  );
}

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
    backgroundColor: "#4ADE80",
    borderWidth: 2,
    borderColor: "#fff",
  },
  name: { fontSize: 22, ...FONTS.bold, color: "#fff", marginBottom: 8 },
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
  },
  roleText: { fontSize: 11, color: "#fff", ...FONTS.bold, letterSpacing: 1 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    ...SHADOW.card,
    overflow: "hidden",
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
  item: {
    flexDirection: "row",
    alignItems: "center",
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
    marginBottom: 0,
  },
  logoutText: { fontSize: 15, color: COLORS.error, ...FONTS.semiBold, flex: 1 },
});
