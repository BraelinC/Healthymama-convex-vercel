import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, RefreshControl, Dimensions, Alert, Animated, ActivityIndicator } from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { Image } from "expo-image";
import { api } from "@healthymama/convex";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, X, Clock, Sparkles, Globe } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { WebSearchResultCard } from "../../../components/discover/WebSearchResultCard";
import { ExtractionProgressModal } from "../../../components/discover/ExtractionProgressModal";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface WebSearchResult {
  title: string;
  url: string;
  description: string;
}

interface ExtractedRecipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
}

type ExtractionStep = "fetching" | "extracting" | "formatting" | "done" | "error";

export default function DiscoverScreen() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [webResults, setWebResults] = useState<WebSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Extraction modal state
  const [extractionUrl, setExtractionUrl] = useState<string | null>(null);
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>("fetching");
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [extractionError, setExtractionError] = useState<string | undefined>();

  // Pulsing animation for search loading
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Get all extracted recipes from the database (shown when not searching)
  const recipesData = useQuery(api.discover.getAllExtractedRecipes, { limit: 50 });
  const saveRecipe = useMutation(api.recipes.userRecipes.saveRecipeToUserCookbook);

  // Perform web search when user presses Search
  const handleSearch = async () => {
    if (searchQuery.length < 2) return;

    setIsSearchingWeb(true);
    setHasSearched(true);
    setWebResults([]);

    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const response = await fetch(`${apiUrl}/api/brave-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${searchQuery} recipe` }),
      });

      const data = await response.json();

      if (data.success && data.results) {
        setWebResults(data.results);
      } else {
        setWebResults([]);
      }
    } catch (error) {
      console.error("Web search error:", error);
      setWebResults([]);
    } finally {
      setIsSearchingWeb(false);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Handle starting the extraction process
  const handleImportRecipe = async (url: string) => {
    // Check auth first
    if (!isSignedIn) {
      Alert.alert("Sign In Required", "Please sign in to import recipes.");
      return;
    }

    // Reset and show modal
    setExtractionUrl(url);
    setExtractionStep("fetching");
    setExtractedRecipe(null);
    setExtractionError(undefined);

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      // Get session token for API auth
      const token = await getToken();
      console.log("[Discover] Got auth token:", token ? "yes" : "no");

      if (!token) {
        throw new Error("Could not get authentication token");
      }

      // Step 1: Fetching
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      setExtractionStep("extracting");

      // Step 2: Extract recipe
      const response = await fetch(`${apiUrl}/api/recipe-url/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      console.log("[Discover] Extract response status:", response.status);

      const data = await response.json();

      if (data.success && data.recipe) {
        // Step 3: Formatting
        setExtractionStep("formatting");
        await new Promise(resolve => setTimeout(resolve, 400)); // Brief delay for UX

        // Done - show preview
        setExtractedRecipe({
          title: data.recipe.title,
          description: data.recipe.description,
          ingredients: data.recipe.ingredients || [],
          instructions: data.recipe.instructions || [],
          imageUrl: data.recipe.imageUrl,
          servings: data.recipe.servings,
          prep_time: data.recipe.prep_time,
          cook_time: data.recipe.cook_time,
          cuisine: data.recipe.cuisine,
        });
        setExtractionStep("done");
      } else {
        setExtractionError(data.error || "Could not extract recipe from this page.");
        setExtractionStep("error");
      }
    } catch (error: any) {
      console.error("Recipe extraction error:", error);
      setExtractionError("Failed to extract recipe. Please try again.");
      setExtractionStep("error");
    }
  };

  // Handle saving the extracted recipe
  const handleSaveRecipe = async () => {
    if (!extractedRecipe || !user?.id || !extractionUrl) return;

    try {
      const recipeId = await saveRecipe({
        userId: user.id,
        recipeType: "custom",
        cookbookCategory: "My Recipes",
        title: extractedRecipe.title,
        description: extractedRecipe.description || "",
        ingredients: extractedRecipe.ingredients,
        instructions: extractedRecipe.instructions,
        servings: extractedRecipe.servings,
        prep_time: extractedRecipe.prep_time,
        cook_time: extractedRecipe.cook_time,
        cuisine: extractedRecipe.cuisine,
        imageUrl: extractedRecipe.imageUrl,
      });

      // Close modal and clear search
      setExtractionUrl(null);
      setSearchQuery("");
      setWebResults([]);
      setHasSearched(false);

      // Navigate to saved recipe
      router.push({ pathname: "/(app)/recipe/[id]", params: { id: recipeId } });
    } catch (error: any) {
      console.error("Recipe save error:", error);
      Alert.alert("Error", "Failed to save recipe. Please try again.");
    }
  };

  // Handle closing extraction modal
  const handleCancelExtraction = () => {
    setExtractionUrl(null);
    setExtractedRecipe(null);
    setExtractionError(undefined);
  };

  // Show local recipes when not searching
  const displayRecipes = recipesData?.recipes || [];

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
              placeholder="Search any recipe..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(""); setWebResults([]); setHasSearched(false); }} style={styles.clearButton}>
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Web Search Loading State */}
        {isSearchingWeb && (
          <View style={styles.searchingContainer}>
            <Animated.View style={{ opacity: pulseAnim }}>
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color="#ec4899" />
                <Text style={styles.searchingText}>Searching the web...</Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Web Search Results */}
        {hasSearched && !isSearchingWeb && webResults.length > 0 && (
          <View style={styles.webResultsSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Globe size={18} color="#ec4899" />
                <Text style={styles.sectionTitle}>Web Results</Text>
              </View>
              <Text style={styles.resultCount}>{webResults.length} recipes found</Text>
            </View>

            {webResults.map((result, index) => (
              <WebSearchResultCard
                key={result.url}
                result={result}
                index={index}
                onPress={handleImportRecipe}
              />
            ))}
          </View>
        )}

        {/* No Web Results */}
        {hasSearched && !isSearchingWeb && webResults.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No recipes found</Text>
            <Text style={styles.emptySubtitle}>
              Try different keywords
            </Text>
          </View>
        )}

        {/* Local Recipes (shown when not searching) */}
        {!hasSearched && !isSearchingWeb && (
          <>
            {displayRecipes.length > 0 && (
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Sparkles size={18} color="#ec4899" />
                  <Text style={styles.sectionTitle}>Popular Recipes</Text>
                </View>
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

            {displayRecipes.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>Discover Recipes</Text>
                <Text style={styles.emptySubtitle}>
                  Search for any recipe to import from the web
                </Text>
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* Extraction Progress Modal */}
      <ExtractionProgressModal
        visible={!!extractionUrl}
        url={extractionUrl || ""}
        currentStep={extractionStep}
        recipe={extractedRecipe}
        error={extractionError}
        onSave={handleSaveRecipe}
        onCancel={handleCancelExtraction}
      />
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
  searchingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchingText: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "500",
  },
  webResultsSection: {
    marginBottom: 20,
  },
});
