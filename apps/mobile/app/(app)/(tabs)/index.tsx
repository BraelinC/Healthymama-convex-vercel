import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@healthymama/convex";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../../components/shared/Header";
import { CookbookCard, NewRecipeCard } from "../../../components/cookbook/CookbookCard";
import { RecipesListModal } from "../../../components/cookbook/RecipesListModal";
import { AddRecipeModal } from "../../../components/recipe/AddRecipeModal";

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [showRecipesList, setShowRecipesList] = useState(false);
  const [selectedCookbook, setSelectedCookbook] = useState<{ id: string; name: string } | null>(null);

  const recipes = useQuery(api.recipes.userRecipes.listUserRecipes);

  // Group recipes by cookbook/category (for now, show all in "My Recipes")
  const cookbooks = [
    {
      id: "my-recipes",
      name: "My Recipes",
      recipes: recipes || [],
    },
  ];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleCookbookPress = (cookbookId: string, cookbookName: string) => {
    // Show recipes list modal instead of navigating
    setSelectedCookbook({ id: cookbookId, name: cookbookName });
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
              onPress={() => handleCookbookPress(cookbook.id, cookbook.name)}
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
        recipes={
          selectedCookbook?.id === "my-recipes"
            ? (recipes || [])
            : []
        }
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
