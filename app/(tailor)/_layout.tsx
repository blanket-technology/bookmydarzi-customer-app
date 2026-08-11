import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import { useAuthStore } from "../../store/useAuthStore";

const INDIGO = "#4F46E5";
const TEAL = "#0D9488";

// The (tailor) group is for tailors (and admins/superadmins, who can view
// staff surfaces). Anyone else is bounced to their home before any tailor
// screen renders / fetches - see (admin)/_layout.tsx for the rationale.
const TAILOR_ROLES = new Set(["tailor", "admin", "superadmin"]);
const ROLE_HOME: Record<string, string> = {
  employee: "/(employee)",
  user: "/(tabs)",
};

export default function TailorLayout() {
  const hydrated = useAuthStore((s) => s._hasHydrated);
  const role = useAuthStore((s) => s.user?.role);

  if (hydrated && role && !TAILOR_ROLES.has(role)) {
    return <Redirect href={(ROLE_HOME[role] ?? "/(tabs)") as never} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TEAL,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.grayBorder,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="broadcasts"
        options={{
          title: "New Orders",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "My Work",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cut-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tailor-profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="order-detail"
        options={{ href: null }}
      />
    </Tabs>
  );
}
