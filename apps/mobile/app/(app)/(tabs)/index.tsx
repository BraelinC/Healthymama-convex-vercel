import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@healthymama/convex";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../../components/shared/Header";
import { CookbookCard, NewRecipeCard } from "../../../components/cookbook/CookbookCard";
import { RecipesListModal } from "../../../components/cookbook/RecipesListModal";
import { AddRecipeModal } from "../../../components/recipe/AddRecipeModal";

// Default cookbook categories with display order (lowercase to match database values)
const COOKBOOK_ORDER = ["favorites", "breakfast", "lunch", "dinner", "dessert", "snacks"];

// Display names for categories
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  favorites: "Favorites",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  dessert: "Dessert",
  snacks: "Snacks",
  uncategorized: "My Recipes",
};

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [showRecipesList, setShowRecipesList] = useState(false);
  const [selectedCookbook, setSelectedCookbook] = useState<{ id: string; name: string; recipes: any[] } | null>(null);

  const recipes = useQuery(api.recipes.userRecipes.listUserRecipes);

  // Group recipes by cookbookCategory
  const cookbooks = useMemo(() => {
    if (!recipes || recipes.length === 0) return [];

    // Group by category (lowercase)
    const grouped: Record<string, any[]> = {};

    for (const recipe of recipes) {
      // Database stores lowercase categories like "favorites", "breakfast", etc.
      const category = recipe.cookbookCategory || "uncategorized";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(recipe);
    }

    // Convert to array with display names
    const result = Object.entries(grouped).map(([categoryId, recipeList]) => ({
      id: categoryId,
      name: CATEGORY_DISPLAY_NAMES[categoryId] || categoryId.charAt(0).toUpperCase() + categoryId.slice(1),
      recipes: recipeList,
    }));

    // Sort: known categories first in order, then custom ones alphabetically
    result.sort((a, b) => {
      const aIndex = COOKBOOK_ORDER.indexOf(a.id);
      const bIndex = COOKBOOK_ORDER.indexOf(b.id);

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [recipes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleCookbookPress = (cookbook: { id: string; name: string; recipes: any[] }) => {
    // Show recipes list modal instead of navigating
    setSelectedCookbook(cookbook);
    setShowRecipesList(true);
  };

  const handleAddRecipe = () => {
    setShowAddRecipe(true);
  };

  const handleImageSelected = (imageUri: string, base64: string) => {
    // Recipe was extracted from image - it's already saved by the modal
    // Just close and let Convex update the list
    console.log("Recipe extracted from image");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
        }
      >
        <View style={styles.grid}>
          <NewRecipeCard onPress={handleAddRecipe} />

          {cookbooks.map((cookbook) => (
            <CookbookCard
              key={cookbook.id}
              name={cookbook.name}
              recipes={cookbook.recipes}
              onPress={() => handleCookbookPress(cookbook)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Add Recipe Modal */}
      <AddRecipeModal
        visible={showAddRecipe}
        onClose={() => setShowAddRecipe(false)}
        onImageSelected={handleImageSelected}
      />

      {/* Recipes List Modal */}
      <RecipesListModal
        visible={showRecipesList}
        onClose={() => {
          setShowRecipesList(false);
          setSelectedCookbook(null);
        }}
        title={selectedCookbook?.name || "Recipes"}
        recipes={selectedCookbook?.recipes || []}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
});
