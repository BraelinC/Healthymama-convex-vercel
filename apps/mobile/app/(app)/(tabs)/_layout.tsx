import { Tabs } from "expo-router";
import { Home, Search } from "lucide-react-native";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ec4899",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: 'rgba(236, 72, 153, 0.1)',
              borderRadius: 8,
              padding: 6,
            } : { padding: 6 }}>
              <Home size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: 'rgba(236, 72, 153, 0.1)',
              borderRadius: 8,
              padding: 6,
            } : { padding: 6 }}>
              <Search size={22} color={color} />
            </View>
          ),
        }}
      />
      {/* Hide old tabs */}
      <Tabs.Screen name="cookbook/index" options={{ href: null }} />
      <Tabs.Screen name="create/index" options={{ href: null }} />
      <Tabs.Screen name="plan/index" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ href: null }} />
    </Tabs>
  );
}
