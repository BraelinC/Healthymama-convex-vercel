import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { Check, X, Globe, FileText, ChefHat, Sparkles } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

type ExtractionStep = "fetching" | "extracting" | "formatting" | "done" | "error";

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

interface ExtractionProgressModalProps {
  visible: boolean;
  url: string;
  currentStep: ExtractionStep;
  recipe: ExtractedRecipe | null;
  error?: string;
  onSave: () => void;
  onCancel: () => void;
}

const STEPS = [
  { key: "fetching", label: "Fetching page", icon: Globe },
  { key: "extracting", label: "Extracting recipe", icon: FileText },
  { key: "formatting", label: "Formatting", icon: ChefHat },
];

export function ExtractionProgressModal({
  visible,
  url,
  currentStep,
  recipe,
  error,
  onSave,
  onCancel,
}: ExtractionProgressModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Get domain from URL
  const getDomain = (urlString: string): string => {
    try {
      return new URL(urlString).hostname.replace("www.", "");
    } catch {
      return urlString;
    }
  };

  // Pulse animation for current step
  useEffect(() => {
    if (currentStep !== "done" && currentStep !== "error") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [currentStep]);

  // Slide in recipe preview when done
  useEffect(() => {
    if (currentStep === "done" && recipe) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(50);
      fadeAnim.setValue(0);
    }
  }, [currentStep, recipe]);

  const getStepStatus = (stepKey: string) => {
    const stepOrder = ["fetching", "extracting", "formatting", "done"];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepKey);

    if (currentStep === "error") return "error";
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* URL Info */}
          <View style={styles.urlInfo}>
            <Globe size={16} color="#9ca3af" />
            <Text style={styles.urlText} numberOfLines={1}>{getDomain(url)}</Text>
          </View>

          {/* Page Preview Image - shown during extraction */}
          {currentStep !== "done" && currentStep !== "error" && url && (
            <View style={styles.pagePreviewContainer}>
              <Image
                source={{ uri: `https://image.thum.io/get/width/400/crop/600/${url}` }}
                style={styles.pagePreview}
                contentFit="cover"
                transition={300}
              />
              <View style={styles.pagePreviewOverlay} />
            </View>
          )}

          {/* Progress Steps */}
          {currentStep !== "done" && (
            <View style={styles.stepsContainer}>
              {STEPS.map((step, index) => {
                const status = getStepStatus(step.key);
                const StepIcon = step.icon;

                return (
                  <View key={step.key} style={styles.stepRow}>
                    <View style={[
                      styles.stepIconContainer,
                      status === "completed" && styles.stepCompleted,
                      status === "active" && styles.stepActive,
                      status === "error" && styles.stepError,
                    ]}>
                      {status === "completed" ? (
                        <Check size={18} color="#ffffff" />
                      ) : status === "active" ? (
                        <Animated.View style={{ opacity: pulseAnim }}>
                          <StepIcon size={18} color="#ec4899" />
                        </Animated.View>
                      ) : (
                        <StepIcon size={18} color="#9ca3af" />
                      )}
                    </View>
                    <Text style={[
                      styles.stepLabel,
                      status === "completed" && styles.stepLabelCompleted,
                      status === "active" && styles.stepLabelActive,
                    ]}>
                      {step.label}
                      {status === "active" && "..."}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Error State */}
          {currentStep === "error" && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorEmoji}>😕</Text>
              <Text style={styles.errorTitle}>Extraction Failed</Text>
              <Text style={styles.errorMessage}>{error || "Could not extract recipe from this page."}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onCancel}>
                <Text style={styles.retryButtonText}>Try Another</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recipe Preview */}
          {currentStep === "done" && recipe && (
            <Animated.View style={[
              styles.recipePreview,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}>
              {/* Recipe Image */}
              {recipe.imageUrl && (
                <Image
                  source={{ uri: recipe.imageUrl }}
                  style={styles.recipeImage}
                  contentFit="cover"
                  transition={200}
                />
              )}

              {/* Recipe Info */}
              <View style={styles.recipeInfo}>
                <View style={styles.successBadge}>
                  <Sparkles size={14} color="#ec4899" />
                  <Text style={styles.successText}>Recipe Found!</Text>
                </View>

                <Text style={styles.recipeTitle}>{recipe.title}</Text>

                {recipe.description && (
                  <Text style={styles.recipeDescription} numberOfLines={2}>
                    {recipe.description}
                  </Text>
                )}

                {/* Meta Info */}
                <View style={styles.metaRow}>
                  {recipe.prep_time && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Prep</Text>
                      <Text style={styles.metaValue}>{recipe.prep_time}</Text>
                    </View>
                  )}
                  {recipe.cook_time && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Cook</Text>
                      <Text style={styles.metaValue}>{recipe.cook_time}</Text>
                    </View>
                  )}
                  {recipe.servings && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Serves</Text>
                      <Text style={styles.metaValue}>{recipe.servings}</Text>
                    </View>
                  )}
                </View>

                {/* Quick Stats */}
                <View style={styles.statsRow}>
                  <Text style={styles.statText}>{recipe.ingredients.length} ingredients</Text>
                  <Text style={styles.statDot}>•</Text>
                  <Text style={styles.statText}>{recipe.instructions.length} steps</Text>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity onPress={onSave} activeOpacity={0.8}>
                <LinearGradient
                  colors={["#ec4899", "#f472b6"]}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>Save to My Recipes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
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
    minHeight: 300,
    maxHeight: "85%",
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
  urlInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  urlText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  pagePreviewContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  pagePreview: {
    width: "100%",
    height: 120,
  },
  pagePreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.03)",
  },
  stepsContainer: {
    padding: 24,
    gap: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCompleted: {
    backgroundColor: "#10b981",
  },
  stepActive: {
    backgroundColor: "#fdf2f8",
    borderWidth: 2,
    borderColor: "#ec4899",
  },
  stepError: {
    backgroundColor: "#fef2f2",
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  stepLabel: {
    fontSize: 16,
    color: "#9ca3af",
  },
  stepLabelCompleted: {
    color: "#10b981",
  },
  stepLabelActive: {
    color: "#1f2937",
    fontWeight: "600",
  },
  errorContainer: {
    alignItems: "center",
    padding: 32,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  recipePreview: {
    padding: 20,
  },
  recipeImage: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "#f3f4f6",
  },
  recipeInfo: {
    marginBottom: 20,
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  successText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ec4899",
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 12,
  },
  metaItem: {},
  metaLabel: {
    fontSize: 11,
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statText: {
    fontSize: 13,
    color: "#6b7280",
  },
  statDot: {
    color: "#d1d5db",
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
