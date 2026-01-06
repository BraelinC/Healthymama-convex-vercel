import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Camera, Upload, X, Save, Plus, Minus, ChefHat } from "lucide-react-native";
import { useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { getUnitSuggestions } from "@healthymama/shared";

interface Ingredient {
  id: string;
  amount: string;
  unit: string;
  name: string;
}

interface Instruction {
  id: string;
  step: number;
  text: string;
}

interface CreateRecipeProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateRecipe({ isOpen, onClose, onSuccess }: CreateRecipeProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Form state
  const [recipeName, setRecipeName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: "1", amount: "", unit: "", name: "" },
  ]);
  const [instructions, setInstructions] = useState<Instruction[]>([
    { id: "1", step: 1, text: "" },
  ]);
  const [activeTab, setActiveTab] = useState<"basics" | "ingredients" | "instructions">("basics");

  const saveRecipe = useMutation(api.recipes.createUserRecipe);

  const resetForm = () => {
    setRecipeName("");
    setDescription("");
    setServings("");
    setPrepTime("");
    setCookTime("");
    setIngredients([{ id: "1", amount: "", unit: "", name: "" }]);
    setInstructions([{ id: "1", step: 1, text: "" }]);
    setRecipeImage(null);
    setActiveTab("basics");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to take photos of recipes.");
        return;
      }
    }
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });

        if (photo?.uri) {
          setRecipeImage(photo.uri);
          setShowCamera(false);
          if (photo.base64) {
            await extractRecipeFromImage(photo.base64);
          }
        }
      } catch (error) {
        console.error("Camera error:", error);
        Alert.alert("Error", "Failed to take photo");
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setRecipeImage(result.assets[0].uri);
        if (result.assets[0].base64) {
          await extractRecipeFromImage(result.assets[0].base64);
        }
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to select image");
    }
  };

  const extractRecipeFromImage = async (base64Image: string) => {
    setIsExtracting(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error("API URL not configured");
      }

      const response = await fetch(`${apiUrl}/api/recipe-image/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          imageType: "image/jpeg",
        }),
      });

      const data = await response.json() as {
        success?: boolean;
        recipe?: {
          title?: string;
          description?: string;
          servings?: number;
          prep_time?: string;
          cook_time?: string;
          ingredients?: string[];
          instructions?: string[];
        };
      };

      if (data.success && data.recipe) {
        // Auto-fill form with extracted data
        setRecipeName(data.recipe.title || "");
        setDescription(data.recipe.description || "");
        setServings(data.recipe.servings?.toString() || "");
        setPrepTime(data.recipe.prep_time || "");
        setCookTime(data.recipe.cook_time || "");

        // Parse ingredients
        if (data.recipe.ingredients && Array.isArray(data.recipe.ingredients)) {
          const parsedIngredients = data.recipe.ingredients.map((ing: string, idx: number) => ({
            id: (idx + 1).toString(),
            amount: "",
            unit: "",
            name: ing,
          }));
          setIngredients(parsedIngredients.length > 0 ? parsedIngredients : [{ id: "1", amount: "", unit: "", name: "" }]);
        }

        // Parse instructions
        if (data.recipe.instructions && Array.isArray(data.recipe.instructions)) {
          const parsedInstructions = data.recipe.instructions.map((inst: string, idx: number) => ({
            id: (idx + 1).toString(),
            step: idx + 1,
            text: inst,
          }));
          setInstructions(parsedInstructions.length > 0 ? parsedInstructions : [{ id: "1", step: 1, text: "" }]);
        }

        Alert.alert("Success", "Recipe extracted! Review and save.");
      } else {
        Alert.alert("Extraction Failed", "Could not extract recipe from image. Try entering manually.");
      }
    } catch (error) {
      console.error("Extraction error:", error);
      Alert.alert("Error", "Failed to extract recipe. Try entering manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const addIngredient = () => {
    const newId = (ingredients.length + 1).toString();
    setIngredients([...ingredients, { id: newId, amount: "", unit: "", name: "" }]);
  };

  const removeIngredient = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((ing) => ing.id !== id));
    }
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(
      ingredients.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing))
    );
  };

  const addInstruction = () => {
    const newStep = instructions.length + 1;
    setInstructions([...instructions, { id: newStep.toString(), step: newStep, text: "" }]);
  };

  const removeInstruction = (id: string) => {
    if (instructions.length > 1) {
      const filtered = instructions.filter((inst) => inst.id !== id);
      setInstructions(filtered.map((inst, idx) => ({ ...inst, step: idx + 1 })));
    }
  };

  const updateInstruction = (id: string, text: string) => {
    setInstructions(
      instructions.map((inst) => (inst.id === id ? { ...inst, text } : inst))
    );
  };

  const handleSave = async () => {
    if (!recipeName.trim()) {
      Alert.alert("Required", "Please enter a recipe name");
      return;
    }

    const validIngredients = ingredients.filter((ing) => ing.name.trim());
    if (validIngredients.length === 0) {
      Alert.alert("Required", "Please add at least one ingredient");
      return;
    }

    const validInstructions = instructions.filter((inst) => inst.text.trim());
    if (validInstructions.length === 0) {
      Alert.alert("Required", "Please add at least one instruction");
      return;
    }

    setIsSaving(true);
    try {
      await saveRecipe({
        name: recipeName,
        description: description || undefined,
        servings: servings || undefined,
        prepTime: prepTime || undefined,
        cookTime: cookTime || undefined,
        ingredients: validIngredients.map(
          (ing) => `${ing.amount} ${ing.unit} ${ing.name}`.trim()
        ),
        instructions: validInstructions.map((inst) => inst.text),
        sourceType: "custom",
      });

      Alert.alert("Success", "Recipe saved to your cookbook!");
      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save recipe");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={handleClose}>
      {showCamera ? (
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back">
            <View style={styles.cameraOverlay}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowCamera(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.captureContainer}>
                <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                  <Camera size={32} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Recipe</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#ec4899" />
              ) : (
                <Save size={24} color="#ec4899" />
              )}
            </TouchableOpacity>
          </View>

          {isExtracting && (
            <View style={styles.extractingBanner}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.extractingText}>Extracting recipe...</Text>
            </View>
          )}

          {/* Image capture buttons */}
          <View style={styles.imageSection}>
            {recipeImage ? (
              <View style={styles.imagePreview}>
                <Image source={{ uri: recipeImage }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setRecipeImage(null)}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageButtons}>
                <TouchableOpacity style={styles.imageButton} onPress={openCamera}>
                  <Camera size={24} color="#ec4899" />
                  <Text style={styles.imageButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                  <Upload size={24} color="#8b5cf6" />
                  <Text style={styles.imageButtonText}>From Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Tab navigation */}
          <View style={styles.tabBar}>
            {(["basics", "ingredients", "instructions"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {activeTab === "basics" && (
              <View style={styles.formSection}>
                <Text style={styles.label}>Recipe Name *</Text>
                <TextInput
                  style={styles.input}
                  value={recipeName}
                  onChangeText={setRecipeName}
                  placeholder="Enter recipe name"
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Brief description of the recipe"
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>Servings</Text>
                    <TextInput
                      style={styles.input}
                      value={servings}
                      onChangeText={setServings}
                      placeholder="4"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>Prep Time</Text>
                    <TextInput
                      style={styles.input}
                      value={prepTime}
                      onChangeText={setPrepTime}
                      placeholder="15 min"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Cook Time</Text>
                <TextInput
                  style={styles.input}
                  value={cookTime}
                  onChangeText={setCookTime}
                  placeholder="30 min"
                />
              </View>
            )}

            {activeTab === "ingredients" && (
              <View style={styles.formSection}>
                {ingredients.map((ingredient, index) => (
                  <View key={ingredient.id} style={styles.ingredientRow}>
                    <View style={styles.ingredientInputs}>
                      <TextInput
                        style={[styles.input, styles.amountInput]}
                        value={ingredient.amount}
                        onChangeText={(v) => updateIngredient(ingredient.id, "amount", v)}
                        placeholder="1"
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={[styles.input, styles.unitInput]}
                        value={ingredient.unit}
                        onChangeText={(v) => updateIngredient(ingredient.id, "unit", v)}
                        placeholder="cup"
                      />
                      <TextInput
                        style={[styles.input, styles.nameInput]}
                        value={ingredient.name}
                        onChangeText={(v) => updateIngredient(ingredient.id, "name", v)}
                        placeholder="Ingredient name"
                      />
                    </View>
                    {ingredients.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeIngredient(ingredient.id)}
                      >
                        <Minus size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addButton} onPress={addIngredient}>
                  <Plus size={16} color="#ec4899" />
                  <Text style={styles.addButtonText}>Add Ingredient</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === "instructions" && (
              <View style={styles.formSection}>
                {instructions.map((instruction, index) => (
                  <View key={instruction.id} style={styles.instructionRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{instruction.step}</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.instructionInput]}
                      value={instruction.text}
                      onChangeText={(v) => updateInstruction(instruction.id, v)}
                      placeholder={`Step ${instruction.step}`}
                      multiline
                    />
                    {instructions.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeInstruction(instruction.id)}
                      >
                        <Minus size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addButton} onPress={addInstruction}>
                  <Plus size={16} color="#ec4899" />
                  <Text style={styles.addButtonText}>Add Step</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf2f8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  extractingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ec4899",
    paddingVertical: 8,
    gap: 8,
  },
  extractingText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  imageSection: {
    padding: 16,
    backgroundColor: "#ffffff",
  },
  imageButtons: {
    flexDirection: "row",
    gap: 12,
  },
  imageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fdf2f8",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  imagePreview: {
    position: "relative",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 4,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#ec4899",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  activeTabText: {
    color: "#ec4899",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  formSection: {},
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  ingredientInputs: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  amountInput: {
    width: 60,
  },
  unitInput: {
    width: 70,
  },
  nameInput: {
    flex: 1,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ec4899",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  stepBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  instructionInput: {
    flex: 1,
    minHeight: 60,
    textAlignVertical: "top",
  },
  removeButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#fdf2f8",
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ec4899",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 16,
    padding: 8,
  },
  captureContainer: {
    alignItems: "center",
    paddingBottom: 40,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
});
