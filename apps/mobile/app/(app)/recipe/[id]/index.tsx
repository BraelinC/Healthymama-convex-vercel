import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { useState, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { useUser } from "@clerk/clerk-expo";
import { api } from "@healthymama/convex";
import { ArrowLeft, Clock, Users, Play, Pause, Volume2, VolumeX } from "lucide-react-native";
import { Id } from "@healthymama/convex/dataModel";
import { CookingAssistantFAB } from "@/components/recipe/CookingAssistantFAB";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"ingredients" | "instructions">("ingredients");

  // Video playback state
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);

  const recipe = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    id ? { recipeId: id as Id<"userRecipes"> } : "skip"
  );

  // Generate MUX stream URL
  const muxStreamUrl = recipe?.muxPlaybackId
    ? `https://stream.mux.com/${recipe.muxPlaybackId}.m3u8`
    : null;

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = async () => {
    if (videoRef.current) {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    }
  };

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
          {recipe.title || recipe.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Media - Video or Image */}
        {muxStreamUrl ? (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowControls(!showControls)}
            style={styles.videoContainer}
          >
            <Video
              ref={videoRef}
              source={{ uri: muxStreamUrl }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              isLooping
              isMuted={isMuted}
              posterSource={recipe.imageUrl ? { uri: recipe.imageUrl } : undefined}
              usePoster
              posterStyle={styles.videoPoster}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                  setIsPlaying(status.isPlaying);
                }
              }}
            />
            {/* Video Controls Overlay */}
            {showControls && (
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.6)"]}
                style={styles.videoOverlay}
              >
                <View style={styles.videoControls}>
                  <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                    {isPlaying ? (
                      <Pause size={32} color="#ffffff" fill="#ffffff" />
                    ) : (
                      <Play size={32} color="#ffffff" fill="#ffffff" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleMuteToggle} style={styles.muteButton}>
                    {isMuted ? (
                      <VolumeX size={24} color="#ffffff" />
                    ) : (
                      <Volume2 size={24} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                </View>
                {recipe.instagramUsername && (
                  <Text style={styles.instagramCredit}>@{recipe.instagramUsername}</Text>
                )}
              </LinearGradient>
            )}
          </TouchableOpacity>
        ) : recipe.imageUrl ? (
          <Image
            source={{ uri: recipe.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : null}

        {/* Recipe Info Card - Title, Meta, Description */}
        <View style={styles.infoCard}>
          {/* Title */}
          <Text style={styles.title}>{recipe.title || recipe.name}</Text>

          {/* Meta Row */}
          <View style={styles.metaRow}>
            {(recipe.prep_time || recipe.cook_time) && (
              <View style={styles.metaBadge}>
                <Clock size={14} color="#6b7280" />
                <Text style={styles.metaText}>{recipe.prep_time || recipe.cook_time}</Text>
              </View>
            )}
            {recipe.servings && (
              <View style={styles.metaBadge}>
                <Users size={14} color="#6b7280" />
                <Text style={styles.metaText}>{recipe.servings}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
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
            title: recipe.title || recipe.name || "Recipe",
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
  videoContainer: {
    width: "100%",
    height: 400,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoPoster: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  videoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  videoControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  muteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  instagramCredit: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    opacity: 0.9,
  },
  infoCard: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 22,
    marginTop: 12,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
