import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Image, Link, FileText } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { CreateRecipe } from "@/components/recipe/CreateRecipe";

export default function CreateScreen() {
  const router = useRouter();
  const [showCreateRecipe, setShowCreateRecipe] = useState(false);
  const [initialMode, setInitialMode] = useState<"camera" | "gallery" | "manual">("manual");

  const openCreateRecipe = (mode: "camera" | "gallery" | "manual") => {
    setInitialMode(mode);
    setShowCreateRecipe(true);
  };

  const options = [
    {
      icon: Camera,
      title: "Take Photo",
      description: "Snap a photo of a recipe or dish to extract",
      action: () => openCreateRecipe("camera"),
      color: "#ec4899",
    },
    {
      icon: Image,
      title: "From Gallery",
      description: "Choose a photo from your gallery",
      action: () => openCreateRecipe("gallery"),
      color: "#8b5cf6",
    },
    {
      icon: Link,
      title: "From URL",
      description: "Extract recipe from a website link",
      action: () => {/* URL extraction - future feature */},
      color: "#3b82f6",
    },
    {
      icon: FileText,
      title: "Manual Entry",
      description: "Create a recipe from scratch",
      action: () => openCreateRecipe("manual"),
      color: "#10b981",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Recipe</Text>
          <Text style={styles.subtitle}>
            Choose how you want to add your recipe
          </Text>
        </View>

        <View style={styles.optionsGrid}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.optionCard}
              onPress={option.action}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${option.color}15` }]}>
                <option.icon size={28} color={option.color} />
              </View>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <CreateRecipe
        isOpen={showCreateRecipe}
        onClose={() => setShowCreateRecipe(false)}
        onSuccess={() => router.push("/(app)/(tabs)/cookbook")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf2f8",
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  optionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    width: "48%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: "#6b7280",
  },
});
