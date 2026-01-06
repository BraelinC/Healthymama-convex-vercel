import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  Mic,
  MicOff,
  Volume2,
  ChefHat,
  X,
  Star,
  Video,
  VideoOff,
} from "lucide-react-native";
import { useGeminiLive, GeminiLiveState } from "../../hooks/useGeminiLive";

interface Recipe {
  title: string;
  ingredients?: string[];
  instructions?: string[];
}

interface CookingAssistantFABProps {
  userId: string;
  recipe: Recipe;
}

export function CookingAssistantFAB({ userId, recipe }: CookingAssistantFABProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastMemory, setLastMemory] = useState<string | null>(null);
  const [enableVideo, setEnableVideo] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const handleMemorySaved = useCallback((text: string) => {
    setLastMemory(text);
    // Auto-clear after 5 seconds
    setTimeout(() => setLastMemory(null), 5000);
  }, []);

  const gemini = useGeminiLive({
    userId,
    recipe,
    enableVideo,
    cameraRef,
    onMemorySaved: handleMemorySaved,
    onError: console.error,
  });

  // Pulse animation when listening
  React.useEffect(() => {
    if (gemini.isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [gemini.isListening, pulseAnim]);

  const handleToggle = useCallback(async () => {
    if (gemini.isActive) {
      gemini.stop();
      setIsExpanded(false);
    } else {
      if (enableVideo && !permission?.granted) {
        await requestPermission();
      }
      setIsExpanded(true);
      await gemini.start();
    }
  }, [gemini, enableVideo, permission, requestPermission]);

  const handleClose = useCallback(() => {
    gemini.stop();
    setIsExpanded(false);
  }, [gemini]);

  const getStateIcon = () => {
    switch (gemini.state) {
      case "connecting":
      case "thinking":
      case "tool_executing":
        return <ActivityIndicator size="small" color="#fff" />;
      case "listening":
        return <Mic size={24} color="#fff" />;
      case "speaking":
        return <Volume2 size={24} color="#fff" />;
      case "error":
        return <MicOff size={24} color="#fff" />;
      default:
        return <ChefHat size={24} color="#fff" />;
    }
  };

  const getStateColor = () => {
    switch (gemini.state) {
      case "listening":
        return "#22c55e"; // green
      case "speaking":
        return "#3b82f6"; // blue
      case "thinking":
      case "tool_executing":
        return "#eab308"; // yellow
      case "connecting":
        return "#6b7280"; // gray
      case "error":
        return "#ef4444"; // red
      default:
        return "#ec4899"; // pink
    }
  };

  const getStateText = () => {
    switch (gemini.state) {
      case "connecting":
        return "Connecting...";
      case "listening":
        return "Listening...";
      case "thinking":
        return "Thinking...";
      case "speaking":
        return "Speaking...";
      case "tool_executing":
        return "Searching memories...";
      case "error":
        return "Error - tap to retry";
      default:
        return "Tap to start";
    }
  };

  return (
    <>
      {/* Expanded Panel Modal */}
      <Modal
        visible={isExpanded}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.panelContainer}>
            {/* Header */}
            <View style={[styles.panelHeader, { backgroundColor: getStateColor() }]}>
              <View style={styles.headerContent}>
                <ChefHat size={20} color="#fff" />
                <Text style={styles.headerTitle}>Cooking Assistant</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            <View style={styles.panelContent}>
              {/* Video Preview */}
              {enableVideo && gemini.isActive && (
                <View style={styles.cameraContainer}>
                  <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="back"
                  />
                  <View style={styles.cameraOverlay}>
                    <Video size={12} color="#fff" />
                    <Text style={styles.cameraOverlayText}>Live</Text>
                  </View>
                </View>
              )}

              {/* Video Toggle (before starting) */}
              {!gemini.isActive && (
                <TouchableOpacity
                  onPress={() => setEnableVideo(!enableVideo)}
                  style={[
                    styles.videoToggle,
                    enableVideo ? styles.videoToggleEnabled : styles.videoToggleDisabled,
                  ]}
                >
                  {enableVideo ? (
                    <>
                      <Video size={16} color="#1d4ed8" />
                      <Text style={styles.videoToggleTextEnabled}>
                        Camera enabled - show your cooking
                      </Text>
                    </>
                  ) : (
                    <>
                      <VideoOff size={16} color="#6b7280" />
                      <Text style={styles.videoToggleTextDisabled}>
                        Camera disabled - voice only
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Recipe Info */}
              <View style={styles.recipeInfo}>
                <Text style={styles.recipeLabel}>Recipe:</Text>
                <Text style={styles.recipeName}>{recipe.title}</Text>
              </View>

              {/* Status */}
              <View style={[styles.statusBadge, { backgroundColor: `${getStateColor()}20` }]}>
                {getStateIcon()}
                <Text style={[styles.statusText, { color: getStateColor() }]}>
                  {getStateText()}
                </Text>
              </View>

              {/* Transcript */}
              {gemini.transcript && (
                <View style={styles.transcriptBox}>
                  <Text style={styles.transcriptLabel}>You said:</Text>
                  <Text style={styles.transcriptText}>{gemini.transcript}</Text>
                </View>
              )}

              {/* Last Memory */}
              {lastMemory && (
                <View style={styles.memoryBox}>
                  <Star size={16} color="#eab308" />
                  <View style={styles.memoryContent}>
                    <Text style={styles.memoryLabel}>Remembered:</Text>
                    <Text style={styles.memoryText}>{lastMemory}</Text>
                  </View>
                </View>
              )}

              {/* Start Button (when not active) */}
              {!gemini.isActive && (
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={() => gemini.start()}
                >
                  <Mic size={20} color="#fff" />
                  <Text style={styles.startButtonText}>Start Cooking Assistant</Text>
                </TouchableOpacity>
              )}

              {/* Stop Button (when active) */}
              {gemini.isActive && (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={() => gemini.stop()}
                >
                  <MicOff size={20} color="#ef4444" />
                  <Text style={styles.stopButtonText}>Stop Assistant</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* FAB Button */}
      <Animated.View
        style={[
          styles.fabContainer,
          { transform: [{ scale: gemini.isListening ? pulseAnim : 1 }] },
        ]}
      >
        <TouchableOpacity
          onPress={handleToggle}
          style={[styles.fab, { backgroundColor: getStateColor() }]}
        >
          {getStateIcon()}
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  panelContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginHorizontal: 16,
    marginBottom: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  panelContent: {
    padding: 16,
  },
  cameraContainer: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    height: 180,
    marginBottom: 16,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cameraOverlayText: {
    color: "#fff",
    fontSize: 12,
  },
  videoToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  videoToggleEnabled: {
    backgroundColor: "#dbeafe",
  },
  videoToggleDisabled: {
    backgroundColor: "#f3f4f6",
  },
  videoToggleTextEnabled: {
    color: "#1d4ed8",
    fontSize: 14,
  },
  videoToggleTextDisabled: {
    color: "#6b7280",
    fontSize: 14,
  },
  recipeInfo: {
    flexDirection: "row",
    marginBottom: 12,
  },
  recipeLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginRight: 4,
  },
  recipeName: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  transcriptBox: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  transcriptLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
    color: "#374151",
  },
  memoryBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
  },
  memoryContent: {
    flex: 1,
  },
  memoryLabel: {
    fontSize: 12,
    color: "#92400e",
    marginBottom: 2,
  },
  memoryText: {
    fontSize: 14,
    color: "#78350f",
  },
  startButton: {
    backgroundColor: "#ec4899",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  stopButton: {
    backgroundColor: "#fef2f2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  stopButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    right: 16,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
