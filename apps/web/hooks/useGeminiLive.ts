/**
 * useGeminiLive - Real-time voice cooking assistant hook
 *
 * Connects to Gemini Live API via WebSocket for bidirectional audio streaming.
 * Handles microphone capture, audio playback, and tool call execution.
 */

import { useRef, useCallback, useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@healthymama/convex";

// ========== Types ==========

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
  enableVideo?: boolean; // Enable camera for visual context
  onTranscript?: (text: string, isFinal: boolean) => void;
  onMemorySaved?: (text: string) => void;
  onError?: (error: string) => void;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

// ========== Constants ==========

const GEMINI_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const INPUT_SAMPLE_RATE = 16000; // 16kHz for Gemini input
const OUTPUT_SAMPLE_RATE = 24000; // 24kHz from Gemini output
const AUDIO_CHUNK_MS = 250; // Send audio every 250ms
const VIDEO_FRAME_INTERVAL_MS = 1000; // Send video frame every 1 second
const VIDEO_WIDTH = 640; // Video capture width
const VIDEO_HEIGHT = 480; // Video capture height
const VIDEO_QUALITY = 0.8; // JPEG quality (0-1)

// ========== Hook ==========

export function useGeminiLive(options: UseGeminiLiveOptions) {
  const { userId, recipe, enableVideo = false, onTranscript, onMemorySaved, onError } = options;

  // State
  const [state, setState] = useState<GeminiLiveState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const pendingToolCallsRef = useRef<Map<string, ToolCall>>(new Map());

  // Video refs
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Convex actions for tool calls
  const searchMemories = useAction(api.geminiLive.memories.search);
  const listFavourites = useAction(api.geminiLive.memories.listFavourites);
  const addMemory = useAction(api.geminiLive.memories.addMemory);
  const toggleFavourite = useMutation(api.geminiLive.queries.toggleFavourite);

  // ========== Audio Context Management ==========

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    return audioContextRef.current;
  }, []);

  // ========== Audio Playback ==========

  const playAudioFromBuffer = useCallback(async (arrayBuffer: ArrayBuffer) => {
    try {
      const audioContext = getAudioContext();

      // Resume if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Convert raw bytes to Int16Array (PCM 16-bit)
      const int16Array = new Int16Array(arrayBuffer);

      // Create AudioBuffer
      const audioBuffer = audioContext.createBuffer(
        1, // mono
        int16Array.length,
        OUTPUT_SAMPLE_RATE
      );

      // Convert Int16 to Float32
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      // Queue and play
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();

      setState("speaking");
    } catch (err) {
      console.error("[GeminiLive] Audio buffer playback error:", err);
    }
  }, [getAudioContext]);

  const playAudioChunk = useCallback(async (base64Audio: string) => {
    try {
      const audioContext = getAudioContext();

      // Resume if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (PCM 16-bit)
      const int16Array = new Int16Array(bytes.buffer);

      // Create AudioBuffer
      const audioBuffer = audioContext.createBuffer(
        1, // mono
        int16Array.length,
        OUTPUT_SAMPLE_RATE
      );

      // Convert Int16 to Float32
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      // Schedule playback - queue chunks to play sequentially
      const currentTime = audioContext.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(startTime);

      // Update next play time to after this chunk finishes
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      setState("speaking");

      // Set state back to listening when audio finishes
      source.onended = () => {
        if (audioContext.currentTime >= nextPlayTimeRef.current - 0.05) {
          setState("listening");
        }
      };
    } catch (err) {
      console.error("[GeminiLive] Audio playback error:", err);
    }
  }, [getAudioContext]);

  // ========== Tool Call Execution ==========

  const executeToolCall = useCallback(async (toolCall: ToolCall): Promise<any> => {
    console.log(`[GeminiLive] Executing tool: ${toolCall.name}`, toolCall.args);
    setState("tool_executing");

    try {
      switch (toolCall.name) {
        case "search_memories": {
          const result = await searchMemories({
            userId,
            query: toolCall.args.query,
            topK: 5,
          });
          return result;
        }

        case "list_favourites": {
          const result = await listFavourites({
            userId,
            limit: toolCall.args.limit || 5,
          });
          return result;
        }

        case "save_preference": {
          const result = await addMemory({
            userId,
            text: toolCall.args.preference,
            category: toolCall.args.category || "cooking_preference",
            isFavourite: false,
          });
          onMemorySaved?.(toolCall.args.preference);
          return result;
        }

        case "substitute_ingredient": {
          // This is handled by Gemini itself - just return acknowledgment
          return {
            status: "acknowledged",
            message: "Substitution request received",
          };
        }

        default:
          console.warn(`[GeminiLive] Unknown tool: ${toolCall.name}`);
          return { error: `Unknown tool: ${toolCall.name}` };
      }
    } catch (err: any) {
      console.error(`[GeminiLive] Tool execution error:`, err);
      return { error: err.message || "Tool execution failed" };
    }
  }, [userId, searchMemories, listFavourites, addMemory, onMemorySaved]);

  // ========== WebSocket Message Handling ==========

  // Process a parsed Gemini message
  const processGeminiMessage = useCallback(async (data: any) => {
    console.log("[GeminiLive] Message keys:", Object.keys(data));

    // Setup complete
    if (data.setupComplete) {
      console.log("[GeminiLive] Setup complete");
      setState("listening");
      return;
    }

    // Server content (audio/text response)
    if (data.serverContent) {
      const content = data.serverContent;

      // Handle audio output
      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.mimeType) {
            console.log("[GeminiLive] Audio part:", {
              mimeType: part.inlineData.mimeType,
              dataLength: part.inlineData.data?.length || 0,
            });
            if (part.inlineData.mimeType.startsWith("audio/")) {
              await playAudioChunk(part.inlineData.data);
            }
          }
          if (part.text) {
            console.log("[GeminiLive] Text:", part.text);
          }
        }
      }

      // Handle transcriptions
      if (content.inputTranscription?.text) {
        const text = content.inputTranscription.text;
        setTranscript(text);
        onTranscript?.(text, false);
      }

      if (content.outputTranscription?.text) {
        console.log("[GeminiLive] Output:", content.outputTranscription.text);
      }

      // Turn complete - back to listening
      if (content.turnComplete) {
        setState("listening");
      }

      // Interrupted by user
      if (content.interrupted) {
        console.log("[GeminiLive] Interrupted");
        // Reset audio queue when interrupted
        nextPlayTimeRef.current = 0;
        setState("listening");
      }

      return;
    }

    // Tool call request
    if (data.toolCall?.functionCalls) {
      for (const funcCall of data.toolCall.functionCalls) {
        const toolCall: ToolCall = {
          id: funcCall.id,
          name: funcCall.name,
          args: funcCall.args || {},
        };

        // Execute tool and send response
        const result = await executeToolCall(toolCall);

        // Send tool response back to Gemini
        const toolResponse = {
          toolResponse: {
            functionResponses: [
              {
                id: toolCall.id,
                response: result,
              },
            ],
          },
        };

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(toolResponse));
          console.log("[GeminiLive] Tool response sent:", toolCall.name);
        }
      }
      return;
    }

    // Tool call cancellation
    if (data.toolCallCancellation?.ids) {
      console.log("[GeminiLive] Tool calls cancelled:", data.toolCallCancellation.ids);
      return;
    }

    // Go away (server disconnecting)
    if (data.goAway) {
      console.log("[GeminiLive] Server disconnecting:", data.goAway.timeLeft);
      return;
    }
  }, [playAudioChunk, executeToolCall, onTranscript]);

  const handleWebSocketMessage = useCallback(async (event: MessageEvent) => {
    try {
      // Handle blob data - Gemini Live sends binary WebSocket messages
      if (event.data instanceof Blob) {
        const text = await event.data.text();
        try {
          // Parse blob content as JSON
          const data = JSON.parse(text);
          await processGeminiMessage(data);
        } catch {
          // Not valid JSON - log for debugging
          console.log("[GeminiLive] Non-JSON blob:", event.data.size, "bytes, preview:", text.substring(0, 100));
        }
        return;
      }

      // Handle string data (fallback)
      try {
        const data = JSON.parse(event.data);
        await processGeminiMessage(data);
      } catch (parseErr) {
        console.log("[GeminiLive] Non-JSON string:", typeof event.data);
      }
    } catch (err) {
      console.error("[GeminiLive] Message handling error:", err);
    }
  }, [processGeminiMessage]);

  // ========== Microphone Capture ==========

  const startMicrophoneCapture = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: INPUT_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // Create audio context for processing
      const audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      const source = audioContext.createMediaStreamSource(stream);

      // Create script processor for capturing audio
      // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      let audioBuffer: Int16Array[] = [];
      let lastSendTime = Date.now();

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        audioBuffer.push(int16Data);

        // Send audio chunks periodically
        const now = Date.now();
        if (now - lastSendTime >= AUDIO_CHUNK_MS) {
          if (wsRef.current?.readyState === WebSocket.OPEN && audioBuffer.length > 0) {
            // Concatenate buffers
            const totalLength = audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
            const combined = new Int16Array(totalLength);
            let offset = 0;
            for (const buf of audioBuffer) {
              combined.set(buf, offset);
              offset += buf.length;
            }

            // Convert to base64
            const uint8Array = new Uint8Array(combined.buffer);
            const base64 = btoa(String.fromCharCode(...uint8Array));

            // Send to Gemini - using mediaChunks format
            const message = {
              realtimeInput: {
                mediaChunks: [{
                  mimeType: "audio/pcm;rate=16000",
                  data: base64,
                }],
              },
            };

            wsRef.current.send(JSON.stringify(message));
          }

          audioBuffer = [];
          lastSendTime = now;
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log("[GeminiLive] Microphone capture started");
    } catch (err: any) {
      console.error("[GeminiLive] Microphone error:", err);
      setError("Failed to access microphone");
      onError?.("Failed to access microphone");
      setState("error");
    }
  }, [onError]);

  const stopMicrophoneCapture = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    console.log("[GeminiLive] Microphone capture stopped");
  }, []);

  // ========== Video Capture ==========

  const captureVideoFrame = useCallback((): string | null => {
    if (!videoElementRef.current || !canvasRef.current) return null;

    const video = videoElementRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

    // Convert to base64 JPEG
    const dataUrl = canvas.toDataURL("image/jpeg", VIDEO_QUALITY);
    // Remove the "data:image/jpeg;base64," prefix
    return dataUrl.split(",")[1];
  }, []);

  const sendVideoFrame = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    const frameData = captureVideoFrame();
    if (!frameData) return;

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "image/jpeg",
            data: frameData,
          },
        ],
      },
    };

    wsRef.current.send(JSON.stringify(message));
    console.log("[GeminiLive] Video frame sent");
  }, [captureVideoFrame]);

  const startVideoCapture = useCallback(async () => {
    if (!enableVideo) return;

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT },
          facingMode: "environment", // Prefer back camera for cooking
        },
      });

      videoStreamRef.current = stream;
      setVideoStream(stream);

      // Create hidden video element for frame capture
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      videoElementRef.current = video;

      // Create canvas for frame capture
      const canvas = document.createElement("canvas");
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      canvasRef.current = canvas;

      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Start sending frames periodically
      videoIntervalRef.current = setInterval(() => {
        sendVideoFrame();
      }, VIDEO_FRAME_INTERVAL_MS);

      console.log("[GeminiLive] Video capture started");
    } catch (err: any) {
      console.error("[GeminiLive] Video capture error:", err);
      // Video is optional, continue without it
    }
  }, [enableVideo, sendVideoFrame]);

  const stopVideoCapture = useCallback(() => {
    // Stop interval
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    // Stop video stream
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }

    // Cleanup elements
    videoElementRef.current = null;
    canvasRef.current = null;
    setVideoStream(null);

    console.log("[GeminiLive] Video capture stopped");
  }, []);

  // ========== Session Management ==========

  const start = useCallback(async () => {
    if (state !== "idle" && state !== "error") {
      console.log("[GeminiLive] Already active");
      return;
    }

    setState("connecting");
    setError(null);

    try {
      // Fetch ephemeral token
      console.log("[GeminiLive] Fetching token...");
      const tokenResponse = await fetch("/api/gemini-live/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to get token");
      }

      const { apiKey, model, config } = await tokenResponse.json();
      console.log("[GeminiLive] Token received");

      // Connect to WebSocket
      const wsUrl = `${GEMINI_WS_URL}?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[GeminiLive] WebSocket connected");

        // Send setup message
        const setupMessage = {
          setup: {
            model,
            generationConfig: {
              responseModalities: ["AUDIO"],
            },
            systemInstruction: {
              parts: [{ text: config.systemInstruction }],
            },
            // Tools commented out for initial testing
            // tools: config.tools,
          },
        };

        console.log("[GeminiLive] Sending setup...");
        ws.send(JSON.stringify(setupMessage));

        // Start microphone and video capture
        startMicrophoneCapture();
        startVideoCapture();
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (event) => {
        console.error("[GeminiLive] WebSocket error:", event);
        setError("Connection error");
        onError?.("Connection error");
        setState("error");
      };

      ws.onclose = (event) => {
        console.log("[GeminiLive] WebSocket closed:", event.code, event.reason);
        stopMicrophoneCapture();
        if (state !== "idle") {
          setState("idle");
        }
      };
    } catch (err: any) {
      console.error("[GeminiLive] Start error:", err);
      setError(err.message);
      onError?.(err.message);
      setState("error");
    }
  }, [state, recipe, startMicrophoneCapture, stopMicrophoneCapture, startVideoCapture, handleWebSocketMessage, onError]);

  const stop = useCallback(() => {
    console.log("[GeminiLive] Stopping session");

    // Stop microphone and video
    stopMicrophoneCapture();
    stopVideoCapture();

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset state
    setState("idle");
    setTranscript("");
    setError(null);
    pendingToolCallsRef.current.clear();
    nextPlayTimeRef.current = 0;
  }, [stopMicrophoneCapture, stopVideoCapture]);

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
    videoStream, // Video stream for preview display
    start,
    stop,
    isActive: state !== "idle" && state !== "error",
    isListening: state === "listening",
    isSpeaking: state === "speaking",
    isThinking: state === "thinking" || state === "tool_executing",
  };
}
