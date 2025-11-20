/**
 * Universal Video Import Modal Component
 *
 * A multi-step modal/sheet for importing recipes from Instagram reels and YouTube videos.
 * Guides users through URL input → extraction → preview → save workflow.
 *
 * Supported Platforms:
 * - Instagram Reels: Railway service + Gemini video analysis
 * - YouTube Videos: YouTube Data API + Regex parsing + GPT formatting + Gemini video analysis
 *
 * User Flow:
 * 1. Input: User pastes Instagram or YouTube URL
 * 2. Extracting: Shows loading spinner while fetching + parsing
 * 3. Preview: Displays parsed recipe for review (ingredients, instructions, metadata)
 * 4. Saving: Shows loading spinner while saving to Convex
 * 5. Success: Shows checkmark, auto-closes modal after 1.5 seconds
 * 6. Error: Shows error message with "Try Again" button
 *
 * Technical Flow:
 * 1. User pastes URL → Frontend validation (Instagram or YouTube)
 * 2. Call /api/instagram/import (Next.js API route)
 * 3. API route orchestrates platform-specific extraction:
 *    - Instagram: Railway service + Gemini video analysis
 *    - YouTube: Regex description parsing → GPT formatting → Gemini video analysis
 * 4. Return formatted recipe JSON with platform-specific fields
 * 5. Display preview in modal with correct thumbnail and metadata
 * 6. User clicks "Save" → Call Convex mutation (importInstagramRecipe)
 * 7. Recipe saved to platform-specific cookbook ("Instagram" or "YouTube")
 * 8. Success toast + modal closes
 *
 * Component Architecture:
 * - Uses shadcn/ui Sheet component (bottom drawer on mobile)
 * - State-driven step transitions (input → extracting → preview → saving → success/error)
 * - Dynamic platform icon display (Instagram/YouTube)
 * - Toast notifications for user feedback
 * - Responsive design (mobile-first)
 *
 * Props:
 * @param isOpen - Controls modal visibility
 * @param onClose - Callback to close modal and reset state
 * @param userId - Clerk user ID (required for Convex mutation)
 *
 * Dependencies:
 * - Convex: importInstagramRecipe action (handles both platforms)
 * - API Route: /api/instagram/import (universal video import endpoint)
 * - UI Components: Sheet, Button, Input, Loader, Icons
 */
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UniversalRecipeCard } from "../recipe/UniversalRecipeCard";
import { Loader2, Instagram, Youtube, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InstagramImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface VideoSegment {
  stepNumber: number;
  instruction: string;
  startTime: number;
  endTime: number;
}

interface ExtractedRecipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
  source?: "instagram" | "youtube";
  instagramUrl?: string;
  instagramVideoUrl?: string;
  instagramThumbnailUrl?: string;
  instagramUsername?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeThumbnailUrl?: string;
  muxPlaybackId?: string;
  muxAssetId?: string;
  videoSegments?: VideoSegment[];
}

type ImportStep = "input" | "extracting" | "preview" | "saving" | "success" | "error";

/**
 * Parse time strings to total minutes
 *
 * Converts time strings like "15 minutes", "1 hour", "30 min" to total minutes.
 * Combines prep_time and cook_time into a single time_minutes value.
 *
 * @param prep_time - Prep time string (e.g., "15 minutes")
 * @param cook_time - Cook time string (e.g., "30 minutes")
 * @returns Total minutes or undefined if no times provided
 *
 * @example
 * parseTimeToMinutes("15 minutes", "30 minutes") // 45
 * parseTimeToMinutes("1 hour", "15 min") // 75
 * parseTimeToMinutes(undefined, "20 minutes") // 20
 */
function parseTimeToMinutes(prep_time?: string, cook_time?: string): number | undefined {
  if (!prep_time && !cook_time) return undefined;

  const parseTime = (timeStr: string): number => {
    // Match patterns like: "15 minutes", "1 hour", "30 min", "2 hrs"
    const match = timeStr.match(/(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs)/i);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    // Convert hours to minutes
    if (unit.startsWith('h')) return value * 60;
    return value;
  };

  const prep = prep_time ? parseTime(prep_time) : 0;
  const cook = cook_time ? parseTime(cook_time) : 0;

  return prep + cook || undefined;
}

export function InstagramImportModal({
  isOpen,
  onClose,
  userId,
}: InstagramImportModalProps) {
  const { toast } = useToast();
  const [videoUrl, setVideoUrl] = useState("");
  const [step, setStep] = useState<ImportStep>("input");
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Convex mutation to save recipe
  const importRecipe = useAction(api.instagram.importInstagramRecipe);

  // Reset state when modal closes
  const handleClose = () => {
    setVideoUrl("");
    setStep("input");
    setExtractedRecipe(null);
    setErrorMessage("");
    onClose();
  };

  /**
   * Step 1: Extract Recipe from Video (Instagram or YouTube)
   *
   * Calls the Next.js API route to orchestrate:
   * - Instagram: Railway service (data extraction) + Gemini (video analysis)
   * - YouTube: YouTube Data API + Regex parsing + GPT formatting + Gemini (video analysis)
   *
   * Process:
   * 1. Validate video URL (must contain "instagram.com" or "youtube.com")
   * 2. Set step to "extracting" (shows loading UI)
   * 3. Call /api/instagram/import with URL
   * 4. Parse response and store extracted recipe
   * 5. Transition to "preview" step
   * 6. Show success toast
   *
   * Error Handling:
   * - Invalid URL: Toast error, don't call API
   * - API error: Set step to "error", show error message
   * - Network error: Caught and displayed in error step
   *
   * Expected Duration: 5-15 seconds
   * - Platform fetch: 2-5 seconds
   * - AI parsing: 2-5 seconds
   * - Network latency: 1-5 seconds
   */
  const handleExtract = async () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Missing URL",
        description: "Please enter a video URL",
        variant: "destructive",
      });
      return;
    }

    // Validate Instagram or YouTube URL
    const isInstagram = videoUrl.includes("instagram.com");
    const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");

    if (!isInstagram && !isYouTube) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Instagram or YouTube URL",
        variant: "destructive",
      });
      return;
    }

    setStep("extracting");
    setErrorMessage("");

    try {
      // Call Next.js API route
      const response = await fetch("/api/instagram/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to extract recipe");
      }

      // Store extracted recipe
      setExtractedRecipe(data.recipe);
      setStep("preview");

      toast({
        title: "Recipe Extracted!",
        description: "Preview your recipe below",
      });
    } catch (error: any) {
      console.error("[Video Import] Error:", error);
      setErrorMessage(error.message || "Failed to import recipe");
      setStep("error");

      toast({
        title: "Import Failed",
        description: error.message || "Could not extract recipe from video",
        variant: "destructive",
      });
    }
  };

  /**
   * Step 2: Save Recipe to Convex Database
   *
   * Calls the Convex action to save the extracted recipe to the user's cookbook.
   * The recipe is automatically saved to the platform-specific cookbook category:
   * - YouTube recipes → "YouTube" cookbook
   * - Instagram recipes → "Instagram" cookbook
   *
   * Process:
   * 1. Validate extractedRecipe exists
   * 2. Set step to "saving" (shows loading UI)
   * 3. Call importInstagramRecipe action with all recipe data (both platforms)
   * 4. Handle response (success or duplicate error)
   * 5. Transition to "success" step
   * 6. Auto-close modal after 1.5 seconds
   *
   * Error Handling:
   * - Duplicate recipe: Action returns {success: false, error: "already imported"}
   * - Database error: Caught and displayed in error step
   * - Network error: Caught and displayed in error step
   *
   * Convex Action:
   * - Function: api.instagram.importInstagramRecipe (handles both platforms)
   * - Result: {success: boolean, recipeId?: string, error?: string}
   * - Auto-creates platform-specific cookbook if doesn't exist
   *
   * Post-Success:
   * - Shows success step with checkmark
   * - Displays platform-aware success toast
   * - Auto-closes modal after 1.5 seconds
   * - User can view recipe in platform-specific cookbook (Instagram or YouTube)
   */
  const handleSave = async () => {
    if (!extractedRecipe) return;

    setStep("saving");

    try {
      const result = await importRecipe({
        // SECURITY: userId removed - now retrieved from authenticated context in Convex action
        title: extractedRecipe.title,
        description: extractedRecipe.description || undefined,
        ingredients: extractedRecipe.ingredients,
        instructions: extractedRecipe.instructions,
        servings: extractedRecipe.servings || undefined,
        prep_time: extractedRecipe.prep_time || undefined,
        cook_time: extractedRecipe.cook_time || undefined,
        cuisine: extractedRecipe.cuisine || undefined,
        source: extractedRecipe.source || undefined,
        instagramUrl: extractedRecipe.instagramUrl || undefined,
        instagramVideoUrl: extractedRecipe.instagramVideoUrl || undefined,
        instagramThumbnailUrl: extractedRecipe.instagramThumbnailUrl || undefined,
        instagramUsername: extractedRecipe.instagramUsername || undefined,
        youtubeUrl: extractedRecipe.youtubeUrl || undefined,
        youtubeVideoId: extractedRecipe.youtubeVideoId || undefined,
        youtubeThumbnailUrl: extractedRecipe.youtubeThumbnailUrl || undefined,
        muxPlaybackId: extractedRecipe.muxPlaybackId || undefined,
        muxAssetId: extractedRecipe.muxAssetId || undefined,
        videoSegments: extractedRecipe.videoSegments || undefined,
      });

      if (result.success) {
        setStep("success");

        const cookbookName = extractedRecipe.source === "youtube" ? "YouTube" : "Instagram";
        toast({
          title: "Recipe Saved!",
          description: `"${extractedRecipe.title}" added to ${cookbookName} cookbook`,
        });

        // Close modal after 1.5 seconds
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        throw new Error(result.error || "Failed to save recipe");
      }
    } catch (error: any) {
      console.error("[Video Import] Save error:", error);
      setErrorMessage(error.message || "Failed to save recipe");
      setStep("error");

      toast({
        title: "Save Failed",
        description: error.message || "Could not save recipe to cookbook",
        variant: "destructive",
      });
    }
  };

  // Determine platform based on URL
  const isYouTubeUrl = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
  const isInstagramUrl = videoUrl.includes("instagram.com");
  const PlatformIcon = isYouTubeUrl ? Youtube : Instagram;
  const iconColor = isYouTubeUrl ? "text-red-500" : "text-pink-500";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left flex items-center gap-2">
            <PlatformIcon className={`w-5 h-5 ${iconColor}`} />
            Import Recipe from Video
          </SheetTitle>
          <SheetDescription className="text-left">
            {step === "input" && "Paste an Instagram or YouTube URL to extract the recipe"}
            {step === "extracting" && "Extracting recipe from video..."}
            {step === "preview" && "Preview and save your recipe"}
            {step === "saving" && "Saving to your cookbook..."}
            {step === "success" && "Recipe saved successfully!"}
            {step === "error" && "Something went wrong"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Input Step */}
          {step === "input" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="video-url" className="text-sm font-medium text-gray-700">
                  Video URL
                </label>
                <Input
                  id="video-url"
                  type="url"
                  placeholder="https://www.instagram.com/reel/... or https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Paste a link to an Instagram reel or YouTube video with a recipe
                </p>
              </div>

              <Button
                onClick={handleExtract}
                className="w-full bg-gradient-to-br from-[#dc2626] to-[#ec4899] hover:shadow-red-glow text-white"
              >
                <PlatformIcon className="w-4 h-4 mr-2" />
                Extract Recipe
              </Button>
            </div>
          )}

          {/* Extracting Step */}
          {step === "extracting" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className={`w-12 h-12 ${iconColor} animate-spin`} />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-gray-900">Extracting recipe...</p>
                <p className="text-xs text-gray-500">
                  Fetching video data and parsing with AI
                </p>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && extractedRecipe && (
            <div className="space-y-4">
              <UniversalRecipeCard
                recipe={{
                  title: extractedRecipe.title,
                  description: extractedRecipe.description,
                  imageUrl: extractedRecipe.source === "youtube"
                    ? extractedRecipe.youtubeThumbnailUrl
                    : extractedRecipe.instagramThumbnailUrl,
                  ingredients: extractedRecipe.ingredients,
                  instructions: extractedRecipe.instructions,
                  cuisine: extractedRecipe.cuisine,
                  muxPlaybackId: extractedRecipe.muxPlaybackId,
                  instagramUsername: extractedRecipe.instagramUsername,
                  videoSegments: extractedRecipe.videoSegments,
                  category: extractedRecipe.source === "youtube" ? "YouTube" : "Instagram",
                  time_minutes: parseTimeToMinutes(
                    extractedRecipe.prep_time,
                    extractedRecipe.cook_time
                  ),
                }}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("input")}
                  className="flex-1"
                >
                  Try Another URL
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-br from-[#dc2626] to-[#ec4899] hover:shadow-red-glow text-white"
                >
                  Save to Cookbook
                </Button>
              </div>
            </div>
          )}

          {/* Saving Step */}
          {step === "saving" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className={`w-12 h-12 ${iconColor} animate-spin`} />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-gray-900">Saving recipe...</p>
                <p className="text-xs text-gray-500">
                  Adding to {extractedRecipe?.source === "youtube" ? "YouTube" : "Instagram"} cookbook
                </p>
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-gray-900">Recipe Saved!</p>
                <p className="text-sm text-gray-600">
                  Check your {extractedRecipe?.source === "youtube" ? "YouTube" : "Instagram"} cookbook to view it
                </p>
              </div>
            </div>
          )}

          {/* Error Step */}
          {step === "error" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-gray-900">Import Failed</p>
                  <p className="text-xs text-gray-600 max-w-xs">{errorMessage}</p>
                </div>
              </div>

              <Button
                onClick={() => setStep("input")}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
