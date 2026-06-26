import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { useAuthStore } from "../../store/useAuthStore";

const TEAL = "#149694";

export default function EmployeeProfile() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name ?? "E").charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? "Employee"}</Text>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>EMPLOYEE</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.item}>
          <View style={styles.itemIcon}><Ionicons name="person-outline" size={18} color={TEAL} /></View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>Mobile</Text>
            <Text style={styles.itemSub}>{user?.mobile ?? "Not set"}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <View style={styles.itemIcon}><Ionicons name="mail-outline" size={18} color={TEAL} /></View>
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>Email</Text>
            <Text style={styles.itemSub}>{user?.email ?? "Not set"}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.card, styles.logoutCard, { marginTop: 12 }]} onPress={handleLogout}>
        <View style={[styles.itemIcon, { backgroundColor: COLORS.errorLight }]}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
        </View>
        <Text style={[styles.itemLabel, { color: COLORS.error, flex: 1 }]}>Logout</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.error} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  content: { padding: SPACING.md },
  avatarSection: { alignItems: "center", paddingVertical: SPACING.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TEAL, alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarText: { fontSize: 32, color: COLORS.white, ...FONTS.bold },
  name: { fontSize: 20, ...FONTS.bold, color: COLORS.black },
  email: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  roleBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: TEAL + "1A", borderRadius: RADIUS.full },
  roleText: { fontSize: 11, color: TEAL, ...FONTS.bold, letterSpacing: 1 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, ...SHADOW.card },
  logoutCard: { flexDirection: "row", alignItems: "center", padding: SPACING.md, gap: 12 },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: TEAL + "1A", alignItems: "center", justifyContent: "center" },
  itemText: { flex: 1 },
  itemLabel: { fontSize: 14, color: COLORS.black, ...FONTS.medium },
  itemSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.grayBorder, marginLeft: 60 },
});
