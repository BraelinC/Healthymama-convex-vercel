import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { Image } from "expo-image";
import { Globe, ChevronRight } from "lucide-react-native";

interface WebSearchResult {
  title: string;
  url: string;
  description: string;
}

interface WebSearchResultCardProps {
  result: WebSearchResult;
  index: number;
  onPress: (url: string) => void;
}

export function WebSearchResultCard({
  result,
  index,
  onPress,
}: WebSearchResultCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Staggered entrance animation
    const delay = index * 100;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  // Extract domain from URL
  const getDomain = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  // Get favicon URL using Google's favicon service
  const getFaviconUrl = (url: string): string => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return "";
    }
  };

  const domain = getDomain(result.url);
  const faviconUrl = getFaviconUrl(result.url);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress(result.url)}
        activeOpacity={0.7}
      >
        <View style={styles.faviconContainer}>
          {faviconUrl ? (
            <Image
              source={{ uri: faviconUrl }}
              style={styles.favicon}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <Globe size={20} color="#6b7280" />
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {result.title}
          </Text>
          <Text style={styles.domain}>{domain}</Text>
          {result.description && (
            <Text style={styles.description} numberOfLines={2}>
              {result.description}
            </Text>
          )}
        </View>

        <View style={styles.chevronContainer}>
          <ChevronRight size={20} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  faviconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  favicon: {
    width: 24,
    height: 24,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    lineHeight: 20,
    marginBottom: 2,
  },
  domain: {
    fontSize: 12,
    color: "#ec4899",
    fontWeight: "500",
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  chevronContainer: {
    padding: 4,
  },
});
