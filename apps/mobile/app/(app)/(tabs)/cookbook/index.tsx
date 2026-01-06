import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@healthymama/convex";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Book, ChefHat } from "lucide-react-native";

export default function CookbookScreen() {
  const router = useRouter();
  const recipes = useQuery(api.recipes.userRecipes.listUserRecipes);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Cookbook</Text>
        <Text style={styles.subtitle}>
          {recipes?.length || 0} recipes saved
        </Text>
      </View>

      {!recipes || recipes.length === 0 ? (
        <View style={styles.emptyState}>
          <ChefHat size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptySubtitle}>
            Add recipes by extracting from photos or URLs
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/(app)/(tabs)/create" as const)}
          >
            <Text style={styles.addButtonText}>Add Recipe</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.recipeCard}
              onPress={() => router.push({ pathname: "/(app)/recipe/[id]", params: { id: item._id } })}
            >
              <View style={styles.recipeIcon}>
                <Book size={24} color="#ec4899" />
              </View>
              <View style={styles.recipeInfo}>
                <Text style={styles.recipeName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.recipeDescription} numberOfLines={2}>
                  {item.description || "No description"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf2f8",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
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
  list: {
    padding: 16,
  },
  recipeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recipeIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#fdf2f8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  recipeDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
  addButton: {
    backgroundColor: "#ec4899",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
