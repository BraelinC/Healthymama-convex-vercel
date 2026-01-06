import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Image } from "expo-image";
import { useUser } from "@clerk/clerk-expo";
import { api } from "@healthymama/convex";
import { ArrowLeft, Clock, Users } from "lucide-react-native";
import { Id } from "@healthymama/convex/dataModel";
import { CookingAssistantFAB } from "@/components/recipe/CookingAssistantFAB";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"ingredients" | "instructions">("ingredients");

  const recipe = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    id ? { recipeId: id as Id<"userRecipes"> } : "skip"
  );

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipe.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Image */}
        {recipe.imageUrl && (
          <Image
            source={{ uri: recipe.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        )}

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{recipe.name}</Text>
          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}
        </View>

        {/* Meta Badges */}
        <View style={styles.metaRow}>
          {recipe.prepTime && (
            <View style={styles.metaBadge}>
              <Clock size={14} color="#6b7280" />
              <Text style={styles.metaText}>{recipe.prepTime}</Text>
            </View>
          )}
          {recipe.servings && (
            <View style={styles.metaBadge}>
              <Users size={14} color="#6b7280" />
              <Text style={styles.metaText}>{recipe.servings}</Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "ingredients" && styles.tabActive]}
            onPress={() => setActiveTab("ingredients")}
          >
            <Text style={[styles.tabText, activeTab === "ingredients" && styles.tabTextActive]}>
              Ingredients
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "instructions" && styles.tabActive]}
            onPress={() => setActiveTab("instructions")}
          >
            <Text style={[styles.tabText, activeTab === "instructions" && styles.tabTextActive]}>
              Instructions
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === "ingredients" ? (
            <View style={styles.ingredientsList}>
              {recipe.ingredients?.map((ingredient: string, index: number) => (
                <View key={index} style={styles.ingredientCard}>
                  <View style={styles.bullet} />
                  <Text style={styles.ingredientText}>{ingredient}</Text>
                </View>
              ))}
              {(!recipe.ingredients || recipe.ingredients.length === 0) && (
                <Text style={styles.emptyText}>No ingredients listed</Text>
              )}
            </View>
          ) : (
            <View style={styles.instructionsList}>
              {recipe.instructions?.map((instruction: string, index: number) => (
                <View key={index} style={styles.instructionCard}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
              {(!recipe.instructions || recipe.instructions.length === 0) && (
                <Text style={styles.emptyText}>No instructions listed</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cooking Assistant FAB */}
      {user?.id && recipe && (
        <CookingAssistantFAB
          userId={user.id}
          recipe={{
            title: recipe.name,
            ingredients: recipe.ingredients || [],
            instructions: recipe.instructions || [],
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    textAlign: "center",
  },
  content: {
    paddingBottom: 100,
  },
  heroImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#f3f4f6",
  },
  titleSection: {
    backgroundColor: "#ffffff",
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
  },
  description: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  metaText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#ec4899",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  tabContent: {
    padding: 16,
  },
  ingredientsList: {
    gap: 8,
  },
  ingredientCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ec4899",
    marginTop: 5,
    marginRight: 12,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
  instructionsList: {
    gap: 12,
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ec4899",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    paddingVertical: 20,
  },
});
