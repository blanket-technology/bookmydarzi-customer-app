/**
 * Tab navigator - Home, Orders, Cart, Profile.
 * Tab bar is rendered globally in app/_layout.tsx (PersistentTabBar).
 */
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="initialRoute"
      tabBar={() => null}
      screenOptions={{ headerShown: false }}
    />
  );
}
