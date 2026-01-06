import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useOAuth, useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect } from "react";
import * as Linking from "expo-linking";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: "oauth_google" });
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/(app)/(tabs)/cookbook");
    }
  }, [isSignedIn]);

  const onGooglePress = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startGoogleOAuth({
        redirectUrl: Linking.createURL("/(app)/(tabs)/cookbook"),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(app)/(tabs)/cookbook");
      }
    } catch (err) {
      console.error("OAuth error:", err);
    }
  }, [startGoogleOAuth]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>HealthyMama</Text>
        <Text style={styles.tagline}>Your AI cooking companion</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>
          Sign in to access your recipes, meal plans, and AI cooking assistant
        </Text>

        <TouchableOpacity style={styles.googleButton} onPress={onGooglePress}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf2f8",
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 80,
    alignItems: "center",
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ec4899",
  },
  tagline: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 8,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  googleButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  footer: {
    paddingBottom: 40,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
});
