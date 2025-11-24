"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Loader2, Video, Youtube, Instagram, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UniversalVideoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface ExtractedRecipe {
  title: string;
  description?: string;
  ingredients: Array<{
    name: string;
    quantity?: string;
    unit?: string;
  }>;
  instructions: Array<{
    step: number;
    description: string;
    timestamp?: string;
    keyActions?: string[];
  }>;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
  difficulty?: "easy" | "medium" | "hard";
  keyFrames?: Array<{
    timestamp: string;
    description: string;
    thumbnailUrl: string;
    actionType: "ingredient_prep" | "cooking_technique" | "final_plating" | "other";
  }>;
}

type ImportStep = "input" | "downloading" | "uploading" | "analyzing" | "preview" | "saving" | "success" | "error";
type Platform = "youtube" | "instagram" | "tiktok" | "other" | null;

function detectPlatform(url: string): Platform {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) return "youtube";
  if (lowerUrl.includes("instagram.com")) return "instagram";
  if (lowerUrl.includes("tiktok.com")) return "tiktok";
  if (url.trim()) return "other";
  return null;
}

function getPlatformIcon(platform: Platform) {
  switch (platform) {
    case "youtube":
      return <Youtube className="w-5 h-5 text-red-600" />;
    case "instagram":
      return <Instagram className="w-5 h-5 text-pink-600" />;
    case "tiktok":
      return <Video className="w-5 h-5 text-black" />;
    default:
      return <Video className="w-5 h-5 text-gray-600" />;
  }
}

export function UniversalVideoImportModal({
  isOpen,
  onClose,
  userId,
}: UniversalVideoImportModalProps) {
  const { toast } = useToast();
  const [videoUrl, setVideoUrl] = useState("");
  const [step, setStep] = useState<ImportStep>("input");
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null);
  const [muxThumbnailUrl, setMuxThumbnailUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [platform, setPlatform] = useState<Platform>(null);

  // Convex mutation to save to cookbook
  const saveVideoRecipeToCookbook = useMutation(api.videoRecipes.saveVideoRecipeToCookbook);

  // Reset state when modal closes
  const handleClose = () => {
    setVideoUrl("");
    setStep("input");
    setExtractedRecipe(null);
    setMuxPlaybackId(null);
    setMuxThumbnailUrl(null);
    setJobId(null);
    setErrorMessage("");
    setPlatform(null);
    onClose();
  };

  // Handle URL input change
  const handleUrlChange = (url: string) => {
    setVideoUrl(url);
    setPlatform(detectPlatform(url));
  };

  // Step 1: Import video and extract recipe
  const handleImport = async () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Missing URL",
        description: "Please enter a video URL",
        variant: "destructive",
      });
      return;
    }

    setStep("downloading");
    setErrorMessage("");

    try {
      // Call Next.js API route
      const response = await fetch("/api/video/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: videoUrl, userId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to import video");
      }

      // Store extracted data
      setExtractedRecipe(data.recipe);
      setMuxPlaybackId(data.muxPlaybackId);
      setMuxThumbnailUrl(data.muxThumbnailUrl);
      setJobId(data.jobId);
      setStep("preview");

      toast({
        title: "Recipe Extracted!",
        description: "Preview your recipe below",
      });
    } catch (error: any) {
      console.error("[Video Import] Error:", error);
      setErrorMessage(error.message || "Failed to import video");
      setStep("error");

      toast({
        title: "Import Failed",
        description: error.message || "Could not extract recipe from video",
        variant: "destructive",
      });
    }
  };

  // Step 2: Save recipe to cookbook
  const handleSaveToCookbook = async () => {
    if (!jobId) return;

    setStep("saving");

    try {
      await saveVideoRecipeToCookbook({
        videoRecipeId: jobId as any,
        cookbookCategory: "uncategorized",
      });

      setStep("success");

      toast({
        title: "Recipe Saved!",
        description: "Recipe has been added to your cookbook",
      });

      // Close modal after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
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

  // Get step message
  const getStepMessage = () => {
    switch (step) {
      case "downloading":
        return "Downloading video...";
      case "uploading":
        return "Uploading to Mux...";
      case "analyzing":
        return "Analyzing with AI...";
      case "saving":
        return "Saving to cookbook...";
      default:
        return "";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-healthymama-red" />
            Import from Anywhere
          </SheetTitle>
          <SheetDescription>
            Import recipes from YouTube, Instagram, TikTok, and more
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Step 1: URL Input */}
          {step === "input" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Video URL
                </label>
                <div className="relative">
                  <Input
                    type="url"
                    placeholder="Paste YouTube, Instagram, or TikTok URL..."
                    value={videoUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="pr-10"
                  />
                  {platform && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {getPlatformIcon(platform)}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Supports YouTube, Instagram Reels, TikTok, and other video platforms
                </p>
              </div>

              <Button
                onClick={handleImport}
                disabled={!videoUrl.trim()}
                className="w-full bg-healthymama-red hover:bg-healthymama-red/90"
              >
                Import Recipe
              </Button>
            </div>
          )}

          {/* Step 2: Processing States */}
          {(step === "downloading" || step === "uploading" || step === "analyzing") && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-healthymama-red animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900">{getStepMessage()}</p>
                <p className="text-sm text-gray-500 mt-1">
                  This may take a minute...
                </p>
              </div>
              {/* Progress Steps */}
              <div className="flex items-center gap-2 mt-4">
                <div className={`w-2 h-2 rounded-full ${step === "downloading" ? "bg-healthymama-red animate-pulse" : "bg-gray-300"}`} />
                <div className={`w-2 h-2 rounded-full ${step === "uploading" ? "bg-healthymama-red animate-pulse" : "bg-gray-300"}`} />
                <div className={`w-2 h-2 rounded-full ${step === "analyzing" ? "bg-healthymama-red animate-pulse" : "bg-gray-300"}`} />
              </div>
            </div>
          )}

          {/* Step 3: Recipe Preview */}
          {step === "preview" && extractedRecipe && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                {/* Video Player - Show Mux thumbnail for now */}
                {muxThumbnailUrl && (
                  <div className="relative aspect-video bg-gray-900">
                    <img
                      src={muxThumbnailUrl}
                      alt={extractedRecipe.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/50 rounded-full p-4">
                        <Video className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Recipe Details */}
                <div className="p-4 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{extractedRecipe.title}</h3>
                    {extractedRecipe.description && (
                      <p className="text-sm text-gray-600 mt-1">{extractedRecipe.description}</p>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    {extractedRecipe.servings && <span>🍽️ {extractedRecipe.servings}</span>}
                    {extractedRecipe.prep_time && <span>⏱️ Prep: {extractedRecipe.prep_time}</span>}
                    {extractedRecipe.cook_time && <span>🔥 Cook: {extractedRecipe.cook_time}</span>}
                    {extractedRecipe.difficulty && <span>📊 {extractedRecipe.difficulty}</span>}
                  </div>

                  {/* Ingredients */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Ingredients ({extractedRecipe.ingredients.length})</h4>
                    <ul className="space-y-1">
                      {extractedRecipe.ingredients.slice(0, 5).map((ing, idx) => (
                        <li key={idx} className="text-sm text-gray-700">
                          • {ing.quantity} {ing.unit} {ing.name}
                        </li>
                      ))}
                      {extractedRecipe.ingredients.length > 5 && (
                        <li className="text-sm text-gray-500 italic">
                          + {extractedRecipe.ingredients.length - 5} more...
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Instructions */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Instructions ({extractedRecipe.instructions.length})</h4>
                    <ol className="space-y-2">
                      {extractedRecipe.instructions.slice(0, 3).map((inst) => (
                        <li key={inst.step} className="text-sm text-gray-700">
                          <span className="font-medium">{inst.step}.</span> {inst.description}
                          {inst.timestamp && (
                            <span className="text-xs text-healthymama-red ml-2">@ {inst.timestamp}</span>
                          )}
                        </li>
                      ))}
                      {extractedRecipe.instructions.length > 3 && (
                        <li className="text-sm text-gray-500 italic">
                          + {extractedRecipe.instructions.length - 3} more steps...
                        </li>
                      )}
                    </ol>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveToCookbook}
                className="w-full bg-healthymama-red hover:bg-healthymama-red/90"
              >
                Save to Cookbook
              </Button>
            </div>
          )}

          {/* Step 4: Saving */}
          {step === "saving" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-healthymama-red animate-spin" />
              <p className="text-lg font-medium text-gray-900">Saving to cookbook...</p>
            </div>
          )}

          {/* Step 5: Success */}
          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900">Recipe Saved!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Check your cookbook to view the recipe
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Error */}
          {step === "error" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">Import Failed</p>
                  <p className="text-sm text-gray-600 mt-1">{errorMessage}</p>
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
