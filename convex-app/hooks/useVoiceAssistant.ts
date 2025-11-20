import { useCallback, useState, useRef } from "react";
import { useScribe } from "@elevenlabs/react";
import { useTTSStream } from "./useTTSStream";

interface VoiceAssistantOptions {
  userId: string;
  voiceId: string;
  apiKey: string;
  onRecipesFound?: (recipes: any[]) => void;
  onShowRecipeDetails?: (recipeId: string) => void;
  onNavigate?: (page: string) => void;
}

export type VoiceAssistantState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export function useVoiceAssistant(options: VoiceAssistantOptions) {
  const { userId, voiceId, apiKey, onRecipesFound, onShowRecipeDetails, onNavigate } = options;

  const [state, setState] = useState<VoiceAssistantState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);
  const conversationHistoryRef = useRef<Array<{ role: string; content: string }>>([]);

  // TTS hook
  const tts = useTTSStream({
    voiceId,
    apiKey,
    onStart: () => setState("speaking"),
    onEnd: () => setState("listening"),
    onError: (err) => {
      console.error("[VOICE ASSISTANT] TTS error:", err);
      setError(err.message);
    },
  });

  // Handle AI response and tool calls with streaming
  const handleAIResponse = useCallback(async (userMessage: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setState("thinking");

    try {
      console.log("[VOICE ASSISTANT] Processing message:", userMessage);

      // Add user message to conversation history
      conversationHistoryRef.current.push({
        role: "user",
        content: userMessage,
      });

      // Call AI chat endpoint with streaming and conversation history
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          userId,
          conversationHistory: conversationHistoryRef.current,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI chat failed: ${response.status}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let sentenceBuffer = "";
      let hasStartedSpeaking = false;
      let fullAssistantMessage = ""; // Track full response for conversation history

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (data === "[DONE]") {
            // Flush any remaining sentence
            if (sentenceBuffer.trim()) {
              tts.streamText(sentenceBuffer, { flush: true });
              sentenceBuffer = "";
            }

            // Add assistant response to conversation history
            if (fullAssistantMessage.trim()) {
              conversationHistoryRef.current.push({
                role: "assistant",
                content: fullAssistantMessage,
              });
              console.log("[VOICE ASSISTANT] Added to history. Total messages:", conversationHistoryRef.current.length);
            }
            continue;
          }

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "token": {
                // Accumulate tokens into sentence buffer
                sentenceBuffer += event.data;
                fullAssistantMessage += event.data; // Track full message

                // Check for sentence boundaries (.!?)
                const sentenceMatch = sentenceBuffer.match(/^(.*?[.!?])\s*/);
                if (sentenceMatch) {
                  const completeSentence = sentenceMatch[1];
                  sentenceBuffer = sentenceBuffer.slice(sentenceMatch[0].length);

                  // Stream complete sentence to TTS
                  console.log("[VOICE ASSISTANT] Streaming sentence:", completeSentence);

                  if (!hasStartedSpeaking) {
                    // First sentence - start speaking immediately
                    tts.streamText(completeSentence, { flush: false });
                    hasStartedSpeaking = true;
                    setState("speaking");
                  } else {
                    // Subsequent sentences
                    tts.streamText(completeSentence, { flush: false });
                  }
                }
                break;
              }

              case "tool_call": {
                console.log("[VOICE ASSISTANT] Tool call:", event.data);
                break;
              }

              case "tool_result": {
                const { toolCall, result } = event.data;
                console.log("[VOICE ASSISTANT] Tool result:", toolCall.function.name, result);

                // Execute UI callbacks
                switch (toolCall.function.name) {
                  case "search_recipes":
                    onRecipesFound?.(result.recipes || []);
                    break;

                  case "show_recipe_details":
                    onShowRecipeDetails?.(JSON.parse(toolCall.function.arguments).recipeId);
                    break;

                  case "navigate_to_page":
                    onNavigate?.(JSON.parse(toolCall.function.arguments).page);
                    break;

                  default:
                    console.warn("[VOICE ASSISTANT] Unknown tool:", toolCall.function.name);
                }
                break;
              }

              case "tool_error": {
                console.error("[VOICE ASSISTANT] Tool error:", event.data);
                break;
              }

              case "error": {
                throw new Error(event.data);
              }

              case "finish": {
                console.log("[VOICE ASSISTANT] Stream finished:", event.data);
                break;
              }
            }
          } catch (e) {
            console.error("[VOICE ASSISTANT] Failed to parse SSE event:", e);
          }
        }
      }

      console.log("[VOICE ASSISTANT] Response complete");
    } catch (error) {
      console.error("[VOICE ASSISTANT] Error:", error);
      setError(error instanceof Error ? error.message : "Failed to process message");
      tts.speak("Sorry, I encountered an error. Could you try again?");
    } finally {
      isProcessingRef.current = false;
    }
  }, [userId, tts, onRecipesFound, onShowRecipeDetails, onNavigate]);

  // Scribe for speech-to-text (token will be fetched and set during connect)
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    onConnect: () => {
      console.log("[VOICE ASSISTANT] ✅ Scribe connected successfully");
    },
    onDisconnect: () => {
      console.log("[VOICE ASSISTANT] Scribe disconnected");
    },
    onPartialTranscript: (data) => {
      console.log("[VOICE ASSISTANT] 🎤 Partial transcript:", data.text);
      setTranscript(data.text);
    },
    onCommittedTranscript: (data) => {
      console.log("[VOICE ASSISTANT] ✅ Committed transcript:", data.text);
      setTranscript(data.text);

      // Process complete transcript
      if (data.text.trim()) {
        handleAIResponse(data.text);
      }
    },
    onError: (error) => {
      // Suppress "WebSocket is not connected" errors before we call connect()
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("WebSocket is not connected") && state === "idle") {
        // This is expected before connection - ignore it
        return;
      }

      console.error("[VOICE ASSISTANT] ❌ Scribe error:", error);
      console.error("[VOICE ASSISTANT] Error details:", JSON.stringify(error, null, 2));
      setError("Speech recognition error");
      setState("idle");
    },
    onAuthError: (data) => {
      console.error("[VOICE ASSISTANT] 🔐 Scribe AUTH ERROR:", data);
      setError("Authentication failed: " + data.error);
      setState("idle");
    },
    onSessionStarted: () => {
      console.log("[VOICE ASSISTANT] 📡 Scribe session started - ready to capture speech");
    },
  });

  // Start voice assistant
  const start = useCallback(async () => {
    try {
      console.log("[VOICE ASSISTANT] 🎤 Starting voice assistant...");
      setState("connecting");
      setError(null);

      // Connect TTS
      console.log("[VOICE ASSISTANT] 🔊 Connecting TTS...");
      tts.connect();

      // Fetch single-use token from backend
      console.log("[VOICE ASSISTANT] 🎙️ Fetching Scribe token...");
      const tokenResponse = await fetch("/api/elevenlabs/token");

      if (!tokenResponse.ok) {
        throw new Error("Failed to get Scribe token");
      }

      const { token } = await tokenResponse.json();
      console.log("[VOICE ASSISTANT] ✅ Token received, connecting Scribe...");

      // Connect Scribe with single-use token
      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("[VOICE ASSISTANT] ✅ Voice assistant started successfully");
      setState("listening");

      // Welcome message (TTS will auto-connect if needed)
      setTimeout(() => {
        tts.speak("Hi! I'm here to help you plan your meals!");
      }, 100);
    } catch (error) {
      console.error("[VOICE ASSISTANT] ❌ Failed to start:", error);
      setError(error instanceof Error ? error.message : "Failed to start voice assistant");
      setState("idle");
    }
  }, [scribe, tts]);

  // Stop voice assistant
  const stop = useCallback(() => {
    console.log("[VOICE ASSISTANT] Stopping");
    scribe.disconnect();
    tts.disconnect();
    setState("idle");
    setTranscript("");
    isProcessingRef.current = false;
    conversationHistoryRef.current = []; // Clear conversation history
    console.log("[VOICE ASSISTANT] Conversation history cleared");
  }, [scribe, tts]);

  return {
    state,
    transcript,
    error,
    isSpeaking: tts.isSpeaking,
    start,
    stop,
  };
}
