"use client";

/**
 * CookingAssistantFAB - Floating Action Button for Gemini Live Cooking Assistant
 *
 * Appears on recipe pages. Tap to start voice-based cooking guidance.
 * Now with video support - show Gemini what you're cooking!
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2, Volume2, ChefHat, X, Star, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeminiLive, GeminiLiveState } from "@/hooks/useGeminiLive";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastMemory, setLastMemory] = useState<string | null>(null);
  const [enableVideo, setEnableVideo] = useState(true); // Video enabled by default
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    console.log("[CookingFAB] Transcript:", text, isFinal ? "(final)" : "(partial)");
  }, []);

  const handleMemorySaved = useCallback((text: string) => {
    setLastMemory(text);
    toast({
      title: "Preference saved",
      description: text.length > 50 ? text.substring(0, 50) + "..." : text,
    });
  }, [toast]);

  const handleError = useCallback((error: string) => {
    toast({
      title: "Connection error",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  const gemini = useGeminiLive({
    userId,
    recipe,
    enableVideo,
    onTranscript: handleTranscript,
    onMemorySaved: handleMemorySaved,
    onError: handleError,
  });

  // Connect video stream to video element when available
  useEffect(() => {
    if (videoRef.current && gemini.videoStream) {
      videoRef.current.srcObject = gemini.videoStream;
    }
  }, [gemini.videoStream]);

  const handleToggle = useCallback(async () => {
    if (gemini.isActive) {
      gemini.stop();
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      await gemini.start();
    }
  }, [gemini]);

  const getStateIcon = () => {
    switch (gemini.state) {
      case "connecting":
        return <Loader2 className="w-6 h-6 animate-spin" />;
      case "listening":
        return <Mic className="w-6 h-6" />;
      case "speaking":
        return <Volume2 className="w-6 h-6 animate-pulse" />;
      case "thinking":
      case "tool_executing":
        return <Loader2 className="w-6 h-6 animate-spin" />;
      case "error":
        return <MicOff className="w-6 h-6" />;
      default:
        return <ChefHat className="w-6 h-6" />;
    }
  };

  const getStateColor = (): string => {
    switch (gemini.state) {
      case "listening":
        return "bg-green-500 hover:bg-green-600";
      case "speaking":
        return "bg-blue-500 hover:bg-blue-600";
      case "thinking":
      case "tool_executing":
        return "bg-yellow-500 hover:bg-yellow-600";
      case "connecting":
        return "bg-gray-500 hover:bg-gray-600";
      case "error":
        return "bg-red-500 hover:bg-red-600";
      default:
        return "bg-healthymama-pink hover:bg-healthymama-pink/90";
    }
  };

  const getStateLabel = (): string => {
    switch (gemini.state) {
      case "connecting":
        return "Connecting...";
      case "listening":
        return "Listening...";
      case "speaking":
        return "Speaking...";
      case "thinking":
        return "Thinking...";
      case "tool_executing":
        return "Checking...";
      case "error":
        return "Error";
      default:
        return "Start Cooking";
    }
  };

  return (
    <>
      {/* Expanded Panel */}
      {isExpanded && (
        <div className="fixed bottom-24 right-4 z-40 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-healthymama-pink to-pink-400 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Cooking Assistant</span>
            </div>
            <button
              onClick={() => {
                gemini.stop();
                setIsExpanded(false);
              }}
              className="text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Video Preview */}
            {gemini.videoStream && (
              <div className="relative rounded-lg overflow-hidden bg-gray-900">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute top-2 right-2 bg-black/50 rounded-full px-2 py-1 text-xs text-white flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  Live
                </div>
              </div>
            )}

            {/* Video Toggle (before starting) */}
            {!gemini.isActive && (
              <button
                onClick={() => setEnableVideo(!enableVideo)}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors",
                  enableVideo
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                )}
              >
                {enableVideo ? (
                  <>
                    <Video className="w-4 h-4" />
                    Camera enabled - show your cooking
                  </>
                ) : (
                  <>
                    <VideoOff className="w-4 h-4" />
                    Camera disabled - voice only
                  </>
                )}
              </button>
            )}

            {/* Recipe Info */}
            <div className="text-sm text-gray-600">
              <span className="font-medium">Recipe:</span> {recipe.title}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  gemini.isActive ? "bg-green-500 animate-pulse" : "bg-gray-300"
                )}
              />
              <span className="text-sm text-gray-700">{getStateLabel()}</span>
            </div>

            {/* Transcript */}
            {gemini.transcript && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                <span className="text-gray-500 text-xs block mb-1">You said:</span>
                {gemini.transcript}
              </div>
            )}

            {/* Last Memory */}
            {lastMemory && (
              <div className="bg-yellow-50 rounded-lg p-3 text-sm text-gray-700 flex items-start gap-2">
                <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-gray-500 text-xs block mb-1">Remembered:</span>
                  {lastMemory}
                </div>
              </div>
            )}

            {/* Tips */}
            {gemini.isActive && (
              <div className="text-xs text-gray-500">
                <p>Try saying:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>"What can I use instead of butter?"</li>
                  <li>"What's the next step?"</li>
                  <li>"I'm allergic to nuts"</li>
                </ul>
              </div>
            )}

            {/* Error */}
            {gemini.error && (
              <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">
                {gemini.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main FAB Button */}
      <Button
        onClick={handleToggle}
        className={cn(
          "fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full shadow-lg",
          "flex items-center justify-center transition-all duration-300",
          getStateColor(),
          gemini.isListening && "ring-4 ring-green-300 ring-opacity-50"
        )}
        size="icon"
      >
        {getStateIcon()}
      </Button>

      {/* Pulse Animation for Listening State */}
      {gemini.isListening && (
        <div className="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-green-500 animate-ping opacity-30 pointer-events-none" />
      )}
    </>
  );
}
