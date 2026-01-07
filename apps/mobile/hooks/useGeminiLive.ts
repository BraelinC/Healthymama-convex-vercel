import { useState, useCallback, useRef, useEffect } from "react";
import { Audio } from "expo-av";
import { File, Paths } from "expo-file-system";
import { CameraView } from "expo-camera";
import { useAction } from "convex/react";
import { useAuth } from "@clerk/clerk-expo";
import { api } from "@healthymama/convex";

export type GeminiLiveState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "tool_executing"
  | "error";

interface Recipe {
  title: string;
  ingredients?: string[];
  instructions?: string[];
}

interface UseGeminiLiveOptions {
  userId: string;
  recipe?: Recipe;
  enableVideo?: boolean;
  cameraRef?: React.RefObject<CameraView | null>;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onMemorySaved?: (text: string) => void;
  onError?: (error: string) => void;
}

const GEMINI_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const VIDEO_FRAME_INTERVAL_MS = 1000;

export function useGeminiLive(options: UseGeminiLiveOptions) {
  const {
    userId,
    recipe,
    enableVideo = false,
    cameraRef,
    onTranscript,
    onMemorySaved,
    onError,
  } = options;

  const [state, setState] = useState<GeminiLiveState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<string[]>([]);

  // Clerk auth for API calls
  const { getToken } = useAuth();

  // Convex actions for memory management
  const searchMemories = useAction(api.geminiLive.memories.search);
  const addMemory = useAction(api.geminiLive.memories.addMemory);
  const listFavourites = useAction(api.geminiLive.memories.listFavourites);

  // Clean up audio resources
  const cleanupAudio = useCallback(async () => {
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch {
        // Ignore cleanup errors
      }
      recordingRef.current = null;
    }

    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore cleanup errors
      }
      soundRef.current = null;
    }
  }, []);

  // Start audio recording
  const startAudioRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        throw new Error("Audio permission not granted");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: ".wav",
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: ".wav",
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      await recording.startAsync();
      recordingRef.current = recording;
      console.log("[GeminiLive Mobile] Audio recording started");

      // Periodically send audio chunks
      const sendAudioInterval = setInterval(async () => {
        if (recordingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            const uri = recordingRef.current.getURI();
            if (uri) {
              const audioFile = new File(uri);
              const base64Audio = await audioFile.base64();

              const message = {
                realtimeInput: {
                  mediaChunks: [
                    {
                      mimeType: "audio/pcm;rate=16000",
                      data: base64Audio,
                    },
                  ],
                },
              };

              wsRef.current.send(JSON.stringify(message));
            }
          } catch (err) {
            console.error("[GeminiLive Mobile] Audio chunk error:", err);
          }
        }
      }, 500);

      return () => clearInterval(sendAudioInterval);
    } catch (err: any) {
      console.error("[GeminiLive Mobile] Audio error:", err);
      setError("Failed to access microphone");
      onError?.("Failed to access microphone");
    }
  }, [onError]);

  // Capture and send video frame
  const captureAndSendVideoFrame = useCallback(async () => {
    if (!cameraRef?.current || wsRef.current?.readyState !== WebSocket.OPEN) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
        skipProcessing: true,
      });

      if (photo?.base64) {
        const message = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "image/jpeg",
                data: photo.base64,
              },
            ],
          },
        };
        wsRef.current.send(JSON.stringify(message));
        console.log("[GeminiLive Mobile] Video frame sent");
      }
    } catch (err) {
      console.error("[GeminiLive Mobile] Video capture error:", err);
    }
  }, [cameraRef]);

  // Play audio response
  const playAudioResponse = useCallback(async (base64Audio: string) => {
    try {
      const responseFile = new File(Paths.cache, `gemini_response_${Date.now()}.wav`);
      responseFile.create();
      responseFile.write(base64Audio, { encoding: "base64" });
      const uri = responseFile.uri;

      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;

      setState("speaking");
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setState("listening");
        }
      });
    } catch (err) {
      console.error("[GeminiLive Mobile] Playback error:", err);
    }
  }, []);

  // Execute tool calls from Gemini
  const executeToolCall = useCallback(
    async (toolCall: any): Promise<any> => {
      setState("tool_executing");
      try {
        switch (toolCall.name) {
          case "search_memories":
            return await searchMemories({
              userId,
              query: toolCall.args.query,
              topK: 5,
            });
          case "list_favourites":
            return await listFavourites({ userId, limit: 5 });
          case "save_preference":
            const result = await addMemory({
              userId,
              text: toolCall.args.preference,
              category: toolCall.args.category || "cooking_preference",
              isFavourite: false,
            });
            onMemorySaved?.(toolCall.args.preference);
            return result;
          default:
            return { error: `Unknown tool: ${toolCall.name}` };
        }
      } catch (err: any) {
        return { error: err.message };
      }
    },
    [userId, searchMemories, listFavourites, addMemory, onMemorySaved]
  );

  // Handle WebSocket messages (using generic event type for React Native compatibility)
  const handleWebSocketMessage = useCallback(
    async (event: { data?: string | ArrayBuffer | Blob }) => {
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data.setupComplete) {
          setState("listening");
          return;
        }

        // Handle audio response
        if (data.serverContent?.modelTurn?.parts) {
          for (const part of data.serverContent.modelTurn.parts) {
            if (part.inlineData?.mimeType?.startsWith("audio/")) {
              await playAudioResponse(part.inlineData.data);
            }
          }
        }

        // Handle transcript
        if (data.serverContent?.inputTranscription?.text) {
          setTranscript(data.serverContent.inputTranscription.text);
          onTranscript?.(data.serverContent.inputTranscription.text, false);
        }

        // Handle turn complete
        if (data.serverContent?.turnComplete) {
          setState("listening");
        }

        // Handle tool calls
        if (data.toolCall?.functionCalls) {
          for (const funcCall of data.toolCall.functionCalls) {
            const result = await executeToolCall(funcCall);
            const toolResponse = {
              toolResponse: {
                functionResponses: [{ id: funcCall.id, response: result }],
              },
            };
            wsRef.current?.send(JSON.stringify(toolResponse));
          }
        }
      } catch (err) {
        console.error("[GeminiLive Mobile] Message error:", err);
      }
    },
    [playAudioResponse, executeToolCall, onTranscript]
  );

  // Start the Gemini Live session
  const start = useCallback(async () => {
    if (state !== "idle" && state !== "error") return;

    setState("connecting");
    setError(null);

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error("API URL not configured");
      }

      // Get Clerk auth token
      const authToken = await getToken();
      if (!authToken) {
        throw new Error("Not authenticated");
      }

      // Fetch token from API with auth
      const tokenResponse = await fetch(`${apiUrl}/api/gemini-live/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ recipe }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to get Gemini token: ${errorText}`);
      }

      const { apiKey, model, config } = await tokenResponse.json() as {
        apiKey: string;
        model: string;
        config: { systemInstruction: string };
      };

      // Connect WebSocket (type assertion needed due to undici/browser WebSocket type conflicts)
      const ws = new WebSocket(`${GEMINI_WS_URL}?key=${apiKey}`) as unknown as WebSocket;
      wsRef.current = ws;

      ws.onopen = () => {
        const setupMessage = {
          setup: {
            model,
            generationConfig: { responseModalities: ["AUDIO"] },
            systemInstruction: {
              parts: [{ text: config.systemInstruction }],
            },
          },
        };
        ws.send(JSON.stringify(setupMessage));
        startAudioRecording();

        if (enableVideo && cameraRef?.current) {
          videoIntervalRef.current = setInterval(
            captureAndSendVideoFrame,
            VIDEO_FRAME_INTERVAL_MS
          );
        }
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = () => {
        setError("Connection error");
        onError?.("Connection error");
        setState("error");
      };

      ws.onclose = () => {
        setState("idle");
      };
    } catch (err: any) {
      setError(err.message);
      onError?.(err.message);
      setState("error");
    }
  }, [
    state,
    recipe,
    enableVideo,
    cameraRef,
    getToken,
    startAudioRecording,
    captureAndSendVideoFrame,
    handleWebSocketMessage,
    onError,
  ]);

  // Stop the session
  const stop = useCallback(async () => {
    await cleanupAudio();

    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    wsRef.current?.close();
    wsRef.current = null;

    setState("idle");
    setTranscript("");
    setError(null);
  }, [cleanupAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    state,
    transcript,
    error,
    start,
    stop,
    isActive: state !== "idle" && state !== "error",
    isListening: state === "listening",
    isSpeaking: state === "speaking",
    isThinking: state === "thinking" || state === "tool_executing",
  };
}
