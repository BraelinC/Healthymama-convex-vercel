import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { useState } from "react";
import { Image } from "expo-image";
import { X, ChevronRight, Plus, Heart, Coffee, Salad, UtensilsCrossed, Cake, Cookie, Users } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

interface ExtractedRecipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
}

interface CookbookSelectionSheetProps {
  visible: boolean;
  recipe: ExtractedRecipe | null;
  onSelectCookbook: (cookbookId: string, cookbookName: string) => void;
  onCreateCookbook: (name: string) => void;
  onClose: () => void;
}

const COOKBOOKS = [
  { id: "favorites", name: "Favorites", icon: Heart, color: "#ef4444" },
  { id: "breakfast", name: "Breakfast", icon: Coffee, color: "#f59e0b" },
  { id: "lunch", name: "Lunch", icon: Salad, color: "#22c55e" },
  { id: "dinner", name: "Dinner", icon: UtensilsCrossed, color: "#3b82f6" },
  { id: "dessert", name: "Dessert", icon: Cake, color: "#ec4899" },
  { id: "snacks", name: "Snacks", icon: Cookie, color: "#8b5cf6" },
];

export function CookbookSelectionSheet({
  visible,
  recipe,
  onSelectCookbook,
  onCreateCookbook,
  onClose,
}: CookbookSelectionSheetProps) {
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newCookbookName, setNewCookbookName] = useState("");

  const handleCreateCookbook = () => {
    if (newCookbookName.trim()) {
      onCreateCookbook(newCookbookName.trim());
      setNewCookbookName("");
      setShowCreateNew(false);
    }
  };

  if (!recipe) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Add to Cookbook</Text>

          {/* Recipe Preview */}
          <View style={styles.recipePreview}>
            {recipe.imageUrl ? (
              <Image
                source={{ uri: recipe.imageUrl }}
                style={styles.recipeImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.recipeImage, styles.recipeImagePlaceholder]}>
                <Text style={styles.placeholderEmoji}>🍽️</Text>
              </View>
            )}
            <View style={styles.recipeInfo}>
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {recipe.title}
              </Text>
              <Text style={styles.recipeSubtitle}>
                Select a cookbook to save this recipe
              </Text>
            </View>
          </View>

          <ScrollView style={styles.cookbookList} showsVerticalScrollIndicator={false}>
            {/* Default Cookbooks */}
            {COOKBOOKS.map((cookbook) => {
              const Icon = cookbook.icon;
              return (
                <TouchableOpacity
                  key={cookbook.id}
                  style={styles.cookbookItem}
                  onPress={() => onSelectCookbook(cookbook.id, cookbook.name)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.cookbookIcon, { backgroundColor: `${cookbook.color}15` }]}>
                    <Icon size={22} color={cookbook.color} />
                  </View>
                  <Text style={styles.cookbookName}>{cookbook.name}</Text>
                  <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>
              );
            })}

            {/* Create New Cookbook */}
            {showCreateNew ? (
              <View style={styles.createNewContainer}>
                <TextInput
                  style={styles.createInput}
                  placeholder="Cookbook name..."
                  placeholderTextColor="#9ca3af"
                  value={newCookbookName}
                  onChangeText={setNewCookbookName}
                  autoFocus
                  onSubmitEditing={handleCreateCookbook}
                />
                <View style={styles.createActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowCreateNew(false);
                      setNewCookbookName("");
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.createButton,
                      !newCookbookName.trim() && styles.createButtonDisabled,
                    ]}
                    onPress={handleCreateCookbook}
                    disabled={!newCookbookName.trim()}
                  >
                    <Text style={styles.createButtonText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.createNewButton}
                onPress={() => setShowCreateNew(true)}
                activeOpacity={0.7}
              >
                <View style={styles.createNewIcon}>
                  <Plus size={22} color="#8b5cf6" />
                </View>
                <Text style={styles.createNewText}>Create New Cookbook</Text>
              </TouchableOpacity>
            )}

            {/* Bottom spacing */}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  header: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 16,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  recipePreview: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 16,
  },
  recipeImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },
  recipeImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderEmoji: {
    fontSize: 28,
  },
  recipeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  recipeSubtitle: {
    fontSize: 13,
    color: "#6b7280",
  },
  cookbookList: {
    paddingHorizontal: 20,
  },
  cookbookItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  cookbookIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cookbookName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  createNewButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ddd6fe",
    backgroundColor: "#faf5ff",
  },
  createNewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  createNewText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8b5cf6",
  },
  createNewContainer: {
    backgroundColor: "#faf5ff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#ddd6fe",
  },
  createInput: {
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  createActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#8b5cf6",
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
});
