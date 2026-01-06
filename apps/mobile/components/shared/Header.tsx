import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { HandPlatter } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function Header() {
  const { user } = useUser();
  const router = useRouter();

  const initials = user?.firstName?.[0]?.toUpperCase() || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "?";

  return (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        <LinearGradient
          colors={["#dc2626", "#ec4899"]}
          style={styles.logoIcon}
        >
          <HandPlatter size={20} color="#ffffff" />
        </LinearGradient>
        <Text style={styles.logoText}>HealthyMama</Text>
      </View>

      <TouchableOpacity
        style={styles.profileButton}
        onPress={() => router.push("/(app)/profile")}
      >
        <LinearGradient
          colors={["#ec4899", "#EC407A"]}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ec4899",
  },
  profileButton: {
    padding: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
