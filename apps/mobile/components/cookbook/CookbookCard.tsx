import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Book, Plus } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

interface Recipe {
  _id: string;
  name: string;
  imageUrl?: string;
}

interface CookbookCardProps {
  name: string;
  recipes: Recipe[];
  onPress: () => void;
}

export function CookbookCard({ name, recipes, onPress }: CookbookCardProps) {
  // Get first 4 recipes that have images
  const recipesWithImages = recipes.filter(r => r.imageUrl).slice(0, 4);
  // If no recipes have images, just use first 4 recipes (will show placeholders)
  const recipeImages = recipesWithImages.length > 0 ? recipesWithImages : recipes.slice(0, 4);
  const recipeCount = recipes.length;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageGrid}>
        {recipeImages.length > 0 ? (
          recipeImages.map((recipe, index) => (
            <View key={recipe._id} style={styles.imageCell}>
              {recipe.imageUrl ? (
                <Image
                  source={{ uri: recipe.imageUrl }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                  placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Book size={24} color="#d1d5db" />
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyGrid}>
            <Book size={48} color="#d1d5db" />
          </View>
        )}
        {/* Fill remaining cells if less than 4 recipes */}
        {recipeImages.length > 0 && recipeImages.length < 4 &&
          Array.from({ length: 4 - recipeImages.length }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.imageCell}>
              <View style={styles.imagePlaceholder}>
                <Book size={20} color="#e5e7eb" />
              </View>
            </View>
          ))
        }
      </View>
      <View style={styles.footer}>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <Text style={styles.count}>{recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function NewCookbookCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.newCard} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={["rgba(254, 242, 242, 1)", "rgba(253, 242, 248, 1)"]}
        style={styles.newCardGradient}
      >
        <View style={styles.plusButton}>
          <LinearGradient
            colors={["#dc2626", "#ec4899"]}
            style={styles.plusCircle}
          >
            <Plus size={32} color="#ffffff" />
          </LinearGradient>
        </View>
        <Text style={styles.newCardText}>New cookbook</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
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
  imageGrid: {
    width: "100%",
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  imageCell: {
    width: "50%",
    height: "50%",
  },
  image: {
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
  emptyGrid: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  count: {
    fontSize: 13,
    color: "#6b7280",
  },
  newCard: {
    width: CARD_WIDTH,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#dc2626",
    overflow: "hidden",
  },
  newCardGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  plusButton: {
    marginBottom: 12,
  },
  plusCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  newCardText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
});
