"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@healthymama/convex";
import { Button } from "@/components/ui/button";
import { Mic, Loader2, ChevronLeft, ChevronRight, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { useVoiceAssistant, type VoiceAssistantState } from "@/hooks/useVoiceAssistant";

interface VoiceInputViewProps {
  userId: string;
  onMessageSubmit: (message: string) => void;
}

export function VoiceInputView({ userId, onMessageSubmit }: VoiceInputViewProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [showRecipeSheet, setShowRecipeSheet] = useState(false);
  const [isWarmedUp, setIsWarmedUp] = useState(false);

  const getSuggestions = useAction(api.ai.userSuggestions.getOrGenerateSuggestions);

  // Voice assistant with direct tool calling
  const voiceAssistant = useVoiceAssistant({
    userId,
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Default ElevenLabs voice (Rachel)
    apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY!,
    onRecipesFound: (foundRecipes) => {
      console.log("[VOICE INPUT] Recipes found:", foundRecipes.length);
      setRecipes(foundRecipes);
      setShowRecipeSheet(true);
    },
    onShowRecipeDetails: (recipeId) => {
      console.log("[VOICE INPUT] Show recipe:", recipeId);
      // TODO: Implement recipe detail view
    },
    onNavigate: (page) => {
      console.log("[VOICE INPUT] Navigate to:", page);
      // TODO: Implement navigation
    },
  });

  // Pagination calculations
  const SUGGESTIONS_PER_PAGE = 3;
  const totalPages = Math.ceil(suggestions.length / SUGGESTIONS_PER_PAGE);
  const displayedSuggestions = suggestions.slice(
    currentPage * SUGGESTIONS_PER_PAGE,
    currentPage * SUGGESTIONS_PER_PAGE + SUGGESTIONS_PER_PAGE
  );

  const handlePreviousPage = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : 0));
  };

  // Load suggestions on mount
  useEffect(() => {
    loadSuggestions();
  }, [userId]);

  // Suppress ElevenLabs Scribe "WebSocket is not connected" errors during initialization
  useEffect(() => {
    // Suppress console.error calls
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const message = args[0]?.message || String(args[0]);

      // Suppress known harmless Scribe initialization errors
      if (
        message.includes("WebSocket is not connected") ||
        (args[0] instanceof Error && args[0].message === "WebSocket is not connected")
      ) {
        // Silently ignore - this is expected before Scribe connects
        return;
      }

      // Pass through all other errors
      originalError.apply(console, args);
    };

    // Suppress uncaught errors from Scribe library
    const errorHandler = (event: ErrorEvent) => {
      if (
        event.message?.includes("WebSocket is not connected") ||
        event.error?.message?.includes("WebSocket is not connected")
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    window.addEventListener("error", errorHandler);

    return () => {
      console.error = originalError;
      window.removeEventListener("error", errorHandler);
    };
  }, []);

  // Warm-up: Pre-initialize connections and contexts
  useEffect(() => {
    async function warmUp() {
      console.log("[WARM-UP] Starting pre-initialization...");

      try {
        // Run warm-up tasks in parallel
        await Promise.all([
          // 1. Pre-create AudioContext (suspended until needed)
          (async () => {
            try {
              const ctx = new AudioContext({ sampleRate: 22050 });
              await ctx.suspend();
              console.log("[WARM-UP] ✓ AudioContext ready");
            } catch (err) {
              console.warn("[WARM-UP] AudioContext creation failed (non-critical):", err);
            }
          })(),

          // 2. Pre-fetch Scribe token
          (async () => {
            try {
              const response = await fetch("/api/elevenlabs/token");
              if (response.ok) {
                const { token } = await response.json();
                // Store in sessionStorage for reuse
                sessionStorage.setItem("scribe_token", token);
                sessionStorage.setItem("scribe_token_expires", String(Date.now() + 3600000)); // 1 hour
                console.log("[WARM-UP] ✓ Token cached");
              }
            } catch (err) {
              console.warn("[WARM-UP] Token fetch failed (non-critical):", err);
            }
          })(),

          // 3. TTS will auto-connect on first speak() call
          (async () => {
            console.log("[WARM-UP] ✓ TTS ready (will connect on first use)");
          })(),
        ]);

        setIsWarmedUp(true);
        console.log("[WARM-UP] ✅ Complete - ready for instant activation");
      } catch (error) {
        console.error("[WARM-UP] Error during warm-up:", error);
        // Continue anyway - warm-up is optimization, not requirement
        setIsWarmedUp(true);
      }
    }

    // Small delay to avoid interfering with Scribe initialization
    const timer = setTimeout(warmUp, 100);
    return () => clearTimeout(timer);
  }, []);

  const loadSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      const result = await getSuggestions({ userId });
      setSuggestions(result.suggestions);
      console.log("[VOICE INPUT] Loaded suggestions:", result.fromCache ? "from cache" : "freshly generated");
    } catch (error) {
      console.error("[VOICE INPUT] Failed to load suggestions:", error);
      // Fallback suggestions
      setSuggestions([
        "Quick breakfast",
        "Healthy lunch",
        "Easy dinner",
        "Protein snack",
      ]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleStartVoiceChat = async () => {
    try {
      console.log("[VOICE INPUT] Starting voice chat...");
      await voiceAssistant.start();
    } catch (error) {
      console.error("[VOICE INPUT] Failed to start voice chat:", error);
      alert("Failed to start voice chat. Please check microphone permissions.");
    }
  };

  const handleStopVoiceChat = () => {
    console.log("[VOICE INPUT] Stopping voice chat...");
    voiceAssistant.stop();
  };

  const handleSuggestionClick = (suggestion: string) => {
    console.log("[VOICE INPUT] Suggestion clicked:", suggestion);
    onMessageSubmit(suggestion);
  };

  const isListening = voiceAssistant.state === "listening" || voiceAssistant.state === "thinking" || voiceAssistant.state === "speaking";
  const isSpeaking = voiceAssistant.isSpeaking;

  // Map voice assistant state to AgentState for Bar Visualizer
  const getAgentState = (): AgentState => {
    return voiceAssistant.state as AgentState;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 bg-gradient-to-b from-background to-muted/20 gap-8 md:gap-12">
      {/* Microphone button with Bar Visualizer */}
      <div className="flex flex-col items-center gap-3 md:gap-4">
        <div className="relative flex items-center justify-center">
          {/* Bar Visualizer - Always show when listening */}
          {isListening && (
            <BarVisualizer
              state={getAgentState()}
              barCount={15}
              mediaStream={null} // TODO: Get mediaStream from conversation
              centerAlign={true}
              className="w-40 h-8 md:w-56 md:h-12"
            />
          )}

          {/* Microphone Button - Only show when NOT listening */}
          {!isListening && (
            <button
              onClick={handleStartVoiceChat}
              className="w-24 h-24 md:w-32 md:h-32 rounded-full transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-primary/50 bg-gray-500 hover:bg-gray-600 shadow-xl"
              aria-label="Start voice chat"
            >
              <Mic className="w-12 h-12 md:w-16 md:h-16 text-white" />
            </button>
          )}

          {/* Stop button when listening - small and subtle */}
          {isListening && (
            <button
              onClick={handleStopVoiceChat}
              className="absolute -bottom-16 w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-500/80 hover:bg-red-600 transition-all flex items-center justify-center focus:outline-none"
              aria-label="Stop listening"
            >
              <StopCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </button>
          )}
        </div>

        {/* Status display */}
        {isListening && (
          <div className="px-4 py-2 md:px-6 md:py-3 bg-background border border-border rounded-lg shadow-lg max-w-md text-center mx-4">
            {voiceAssistant.error ? (
              <p className="text-xs md:text-sm text-red-500">
                ❌ {voiceAssistant.error}
              </p>
            ) : (
              <>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {isSpeaking ? "🔊 AI is speaking..." : voiceAssistant.state === "thinking" ? "🤔 Thinking..." : "🎤 Listening..."}
                </p>
                {voiceAssistant.transcript && !isSpeaking && (
                  <p className="text-xs md:text-sm text-foreground mt-1 italic">
                    "{voiceAssistant.transcript}"
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {!isListening && (
          <p className="text-muted-foreground text-xs md:text-sm px-4 text-center">
            Tap to start voice chat or choose a suggestion
          </p>
        )}
      </div>

      {/* Bottom suggestions */}
      <div className="w-full max-w-5xl">
        {isLoadingSuggestions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 md:gap-4">
            {/* Previous button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousPage}
              className="h-8 w-8 md:h-12 md:w-12 rounded-full flex-shrink-0"
              aria-label="Previous suggestions"
            >
              <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
            </Button>

            {/* 3 Large suggestion chips */}
            <div className="flex gap-2 md:gap-4 items-center justify-center flex-1 min-w-0">
              {displayedSuggestions.map((suggestion, i) => (
                <Button
                  key={currentPage * SUGGESTIONS_PER_PAGE + i}
                  variant="outline"
                  className="rounded-full whitespace-nowrap px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm md:px-8 md:py-6 md:text-lg font-medium hover:bg-primary hover:text-primary-foreground transition-all hover:scale-105 shadow-md min-w-0 flex-shrink"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            {/* Next button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPage}
              className="h-8 w-8 md:h-12 md:w-12 rounded-full flex-shrink-0"
              aria-label="Next suggestions"
            >
              <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
            </Button>
          </div>
        )}

        {/* Page indicator */}
        {!isLoadingSuggestions && totalPages > 1 && (
          <div className="flex justify-center gap-1.5 md:gap-2 mt-3 md:mt-4">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={cn(
                  "w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all",
                  i === currentPage
                    ? "bg-primary w-4 md:w-6"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                aria-label={`Go to page ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
