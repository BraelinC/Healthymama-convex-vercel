import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, RefreshControl, Dimensions } from "react-native";
import { useState, useCallback } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Image } from "expo-image";
import { api } from "@healthymama/convex";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, X, Clock, Sparkles } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

export default function DiscoverScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Get all extracted recipes from the database
  const recipesData = useQuery(api.discover.getAllExtractedRecipes, { limit: 50 });
  const searchResults = useQuery(
    api.discover.searchExtractedRecipes,
    searchQuery.length > 0 ? { searchTerm: searchQuery, limit: 30 } : "skip"
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Use search results if searching, otherwise use all recipes
  const displayRecipes = searchQuery.length > 0
    ? (searchResults || [])
    : (recipesData?.recipes || []);

  const handleRecipePress = (recipeId: string) => {
    // Navigate to extracted recipe route (different from userRecipes)
    router.push({ pathname: "/(app)/recipe/extracted/[id]", params: { id: recipeId } });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header with Search */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleRow}>
            <LinearGradient colors={["#dc2626", "#ec4899"]} style={styles.iconCircle}>
              <Search size={18} color="#ffffff" />
            </LinearGradient>
            <Text style={styles.title}>Discover Recipes</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={18} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
                <X size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
        }
      >
        {searchQuery && (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Sparkles size={18} color="#ec4899" />
              <Text style={styles.sectionTitle}>Search Results</Text>
            </View>
            <Text style={styles.resultCount}>{displayRecipes.length} recipes found</Text>
          </View>
        )}

        <View style={styles.grid}>
          {displayRecipes.map((recipe: { _id: string; title?: string; imageUrl?: string; cook_time?: string; category?: string }) => (
            <TouchableOpacity
              key={recipe._id}
              style={styles.recipeCard}
              onPress={() => handleRecipePress(recipe._id)}
              activeOpacity={0.9}
            >
              <View style={styles.imageContainer}>
                {recipe.imageUrl ? (
                  <Image
                    source={{ uri: recipe.imageUrl }}
                    style={styles.recipeImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderEmoji}>🍽️</Text>
                  </View>
                )}
                {recipe.cook_time && (
                  <View style={styles.timeBadge}>
                    <Clock size={12} color="#374151" />
                    <Text style={styles.timeText}>{recipe.cook_time}</Text>
                  </View>
                )}
              </View>
              <View style={styles.recipeInfo}>
                <Text style={styles.recipeName} numberOfLines={2}>{recipe.title}</Text>
                {recipe.category && (
                  <View style={styles.tagsRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{recipe.category}</Text>
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {displayRecipes.length === 0 && !searchQuery && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>Discover Recipes</Text>
            <Text style={styles.emptySubtitle}>
              Browse recipes from the community
            </Text>
          </View>
        )}

        {displayRecipes.length === 0 && searchQuery && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>😕</Text>
            <Text style={styles.emptyTitle}>No recipes found</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search term
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  header: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTop: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: "#1f2937",
  },
  clearButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  resultCount: {
    fontSize: 13,
    color: "#6b7280",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  recipeCard: {
    width: CARD_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: "100%",
    height: 120,
    backgroundColor: "#f3f4f6",
    position: "relative",
  },
  recipeImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  placeholderEmoji: {
    fontSize: 32,
  },
  timeBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "500",
  },
  recipeInfo: {
    padding: 12,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: "#fdf2f8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: "#be185d",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});
