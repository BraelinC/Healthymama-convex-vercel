import { View, Text, ScrollView, StyleSheet, RefreshControl, Modal, TextInput, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import Header from "../../../components/shared/Header";
import { CookbookCard, NewCookbookCard } from "../../../components/cookbook/CookbookCard";
import { RecipesListModal } from "../../../components/cookbook/RecipesListModal";

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showNewCookbook, setShowNewCookbook] = useState(false);
  const [newCookbookName, setNewCookbookName] = useState("");
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

  const handleNewCookbook = () => {
    setShowNewCookbook(true);
  };

  const handleCreateCookbook = () => {
    // TODO: Create cookbook mutation
    setShowNewCookbook(false);
    setNewCookbookName("");
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
          <NewCookbookCard onPress={handleNewCookbook} />

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

      {/* New Cookbook Modal */}
      <Modal
        visible={showNewCookbook}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewCookbook(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Cookbook</Text>
              <TouchableOpacity onPress={() => setShowNewCookbook(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Cookbook name"
              placeholderTextColor="#9ca3af"
              value={newCookbookName}
              onChangeText={setNewCookbookName}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.createButton, !newCookbookName && styles.createButtonDisabled]}
              onPress={handleCreateCookbook}
              disabled={!newCookbookName}
            >
              <Text style={styles.createButtonText}>Create Cookbook</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
  },
  input: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1f2937",
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: "#ec4899",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  createButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
