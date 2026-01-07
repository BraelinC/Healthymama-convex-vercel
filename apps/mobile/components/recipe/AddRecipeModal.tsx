import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Animated } from "react-native";
import { useState, useEffect, useRef } from "react";
import { Camera, X, Link2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";

interface AddRecipeModalProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (imageUri: string, base64: string) => void;
}

export function AddRecipeModal({
  visible,
  onClose,
  onImageSelected,
}: AddRecipeModalProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const imageHeightAnim = useRef(new Animated.Value(180)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
      Animated.timing(imageHeightAnim, {
        toValue: 80,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      Animated.timing(imageHeightAnim, {
        toValue: 180,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const resetState = () => {
    setImageUri(null);
    setImageBase64(null);
    setUrl("");
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleImagePress = async () => {
    Alert.alert(
      "Add Photo",
      "Choose how to add your recipe photo",
      [
        {
          text: "Take Photo",
          onPress: takePhoto,
        },
        {
          text: "Choose from Gallery",
          onPress: pickImage,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera access is needed to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const handleSubmit = async () => {
    // Determine which path to take
    if (url.trim()) {
      // URL path - Instagram/video import
      await handleUrlImport();
    } else if (imageUri && imageBase64) {
      // Image path - extract recipe from photo
      await handleImageExtract();
    } else {
      Alert.alert("Add Recipe", "Please add a photo or paste a URL to import a recipe.");
    }
  };

  const handleUrlImport = async () => {
    const trimmedUrl = url.trim();

    // Validate URL
    const isInstagram = trimmedUrl.includes("instagram.com") || trimmedUrl.includes("instagr.am");
    const isYouTube = trimmedUrl.includes("youtube.com") || trimmedUrl.includes("youtu.be");
    const isPinterest = trimmedUrl.includes("pinterest.com") || trimmedUrl.includes("pin.it");

    if (!isInstagram && !isYouTube && !isPinterest) {
      Alert.alert("Invalid URL", "Please enter a valid Instagram, YouTube, or Pinterest URL.");
      return;
    }

    setIsProcessing(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error("API URL not configured");
      }

      const response = await fetch(`${apiUrl}/api/instagram/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await response.json();

      if (data.success && data.recipe) {
        Alert.alert(
          "Recipe Imported!",
          `"${data.recipe.title}" has been added to your cookbook.`,
          [{ text: "OK", onPress: handleClose }]
        );
      } else {
        Alert.alert("Import Failed", data.error || "Could not extract recipe from this URL.");
      }
    } catch (error) {
      console.error("URL import error:", error);
      Alert.alert("Error", "Failed to import recipe. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageExtract = async () => {
    if (!imageBase64) return;

    setIsProcessing(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error("API URL not configured");
      }

      const response = await fetch(`${apiUrl}/api/recipe-image/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          imageType: "image/jpeg",
        }),
      });

      const data = await response.json();

      if (data.success && data.recipe) {
        // Pass to parent to open CreateRecipe with pre-filled data
        onImageSelected(imageUri!, imageBase64);
        handleClose();
      } else {
        Alert.alert("Extraction Failed", "Could not extract recipe from image. Try a clearer photo.");
      }
    } catch (error) {
      console.error("Image extraction error:", error);
      Alert.alert("Error", "Failed to process image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Recipe</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Image Upload Area - Shrinks when keyboard is visible */}
          <Animated.View style={[styles.imageAreaWrapper, { height: imageHeightAnim }]}>
            <TouchableOpacity
              style={styles.imageArea}
              onPress={handleImagePress}
              activeOpacity={0.8}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <LinearGradient
                    colors={["#ec4899", "#f472b6"]}
                    style={[styles.cameraCircle, keyboardVisible && styles.cameraCircleSmall]}
                  >
                    <Camera size={keyboardVisible ? 20 : 32} color="#ffffff" />
                  </LinearGradient>
                  {!keyboardVisible && (
                    <>
                      <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                      <Text style={styles.imagePlaceholderSubtext}>Take a photo or choose from gallery</Text>
                    </>
                  )}
                </View>
              )}
              {imageUri && (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => { setImageUri(null); setImageBase64(null); }}
                >
                  <X size={18} color="#ffffff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* OR Divider - Hide when keyboard visible */}
          {!keyboardVisible && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* URL Input */}
          <View style={[styles.urlContainer, keyboardVisible && styles.urlContainerKeyboard]}>
            <View style={styles.urlInputWrapper}>
              <Link2 size={20} color="#9ca3af" style={styles.urlIcon} />
              <TextInput
                style={styles.urlInput}
                value={url}
                onChangeText={setUrl}
                placeholder="Paste Instagram, YouTube, or Pinterest URL"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!imageUri && !url.trim()) && styles.submitButtonDisabled,
              keyboardVisible && styles.submitButtonKeyboard
            ]}
            onPress={handleSubmit}
            disabled={isProcessing || (!imageUri && !url.trim())}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {url.trim() ? "Import Recipe" : imageUri ? "Extract Recipe" : "Add Photo or URL"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: 40,
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
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
  },
  closeButton: {
    padding: 4,
  },
  imageAreaWrapper: {
    marginHorizontal: 20,
  },
  imageArea: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    overflow: "hidden",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cameraCircleSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 0,
  },
  imagePlaceholderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  imagePlaceholderSubtext: {
    fontSize: 13,
    color: "#9ca3af",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
    padding: 6,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
  urlContainer: {
    paddingHorizontal: 20,
  },
  urlContainerKeyboard: {
    marginTop: 12,
  },
  urlInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  urlIcon: {
    marginRight: 10,
  },
  urlInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1f2937",
  },
  submitButton: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#ec4899",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonKeyboard: {
    marginTop: 12,
    paddingVertical: 12,
  },
  submitButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
