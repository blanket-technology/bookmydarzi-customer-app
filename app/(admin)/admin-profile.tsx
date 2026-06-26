import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { useAuthStore } from "../../store/useAuthStore";

const TEAL = "#149694";

function MenuItem({
  icon, label, sub, onPress, danger,
}: {
  icon: string; label: string; sub?: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.itemIcon, { backgroundColor: (danger ? COLORS.error : TEAL) + "1A" }]}>
        <Ionicons name={icon as any} size={18} color={danger ? COLORS.error : TEAL} />
      </View>
      <View style={styles.itemText}>
        <Text style={[styles.itemLabel, danger && { color: COLORS.error }]}>{label}</Text>
        {sub && <Text style={styles.itemSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
    </TouchableOpacity>
  );
}

export default function AdminProfile() {
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
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name ?? "A").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name ?? "Admin"}</Text>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{(user?.role ?? "admin").toUpperCase()}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.card}>
        <MenuItem
          icon="person-outline"
          label="Account Info"
          sub={user?.email ?? ""}
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="phone-portrait-outline"
          label="Mobile"
          sub={user?.mobile ?? "Not set"}
          onPress={() => {}}
        />
      </View>

      <View style={[styles.card, { marginTop: 12 }]}>
        <MenuItem
          icon="log-out-outline"
          label="Logout"
          onPress={handleLogout}
          danger
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  content: { padding: SPACING.md },
  avatarSection: { alignItems: "center", paddingVertical: SPACING.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TEAL,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, color: COLORS.white, ...FONTS.bold },
  name: { fontSize: 20, ...FONTS.bold, color: COLORS.black },
  email: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  roleBadge: {
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: TEAL + "1A", borderRadius: RADIUS.full,
  },
  roleText: { fontSize: 11, color: TEAL, ...FONTS.bold, letterSpacing: 1 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, ...SHADOW.card },
  item: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12,
  },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemText: { flex: 1 },
  itemLabel: { fontSize: 14, color: COLORS.black, ...FONTS.medium },
  itemSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.grayBorder, marginLeft: 60 },
});
