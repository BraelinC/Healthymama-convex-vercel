import { View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Image } from "expo-image";
import { X, Clock, Users } from "lucide-react-native";
import { useRouter } from "expo-router";

const { height } = Dimensions.get("window");

interface Recipe {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  prepTime?: string;
  servings?: string;
  ingredients?: string[];
}

interface RecipesListModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  recipes: Recipe[];
}

export function RecipesListModal({ visible, onClose, title, recipes }: RecipesListModalProps) {
  const router = useRouter();

  const handleRecipePress = (recipeId: string) => {
    onClose();
    router.push({ pathname: "/(app)/recipe/[id]", params: { id: recipeId } });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Recipe count */}
          <Text style={styles.recipeCount}>{recipes.length} recipes</Text>

          {/* Recipes List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {recipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={styles.emptyTitle}>No recipes yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start adding recipes to your cookbook!
                </Text>
              </View>
            ) : (
              recipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe._id}
                  style={styles.recipeCard}
                  onPress={() => handleRecipePress(recipe._id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeImageContainer}>
                    {recipe.imageUrl ? (
                      <Image
                        source={{ uri: recipe.imageUrl }}
                        style={styles.recipeImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.placeholderEmoji}>🍽️</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeName} numberOfLines={2}>{recipe.name}</Text>
                    {recipe.description && (
                      <Text style={styles.recipeDescription} numberOfLines={2}>
                        {recipe.description}
                      </Text>
                    )}

                    <View style={styles.recipeMeta}>
                      {recipe.prepTime && (
                        <View style={styles.metaItem}>
                          <Clock size={12} color="#9ca3af" />
                          <Text style={styles.metaText}>{recipe.prepTime}</Text>
                        </View>
                      )}
                      {recipe.servings && (
                        <View style={styles.metaItem}>
                          <Users size={12} color="#9ca3af" />
                          <Text style={styles.metaText}>{recipe.servings}</Text>
                        </View>
                      )}
                      {recipe.ingredients && (
                        <View style={styles.metaItem}>
                          <Text style={styles.metaText}>
                            {recipe.ingredients.length} ingredients
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
    minHeight: height * 0.5,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
  },
  closeButton: {
    padding: 4,
  },
  recipeCount: {
    fontSize: 14,
    color: "#6b7280",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: "center",
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
  recipeCard: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  recipeImageContainer: {
    width: 100,
    height: 100,
  },
  recipeImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderEmoji: {
    fontSize: 28,
  },
  recipeInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  recipeName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  recipeDescription: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
    marginBottom: 8,
  },
  recipeMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#9ca3af",
  },
});
