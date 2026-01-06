/**
 * Universal Import Modal Component
 *
 * A multi-step modal/sheet for importing recipes from:
 * - Instagram reels
 * - YouTube videos
 * - Pinterest pins
 * - **NEW: Uploaded images (food photos or recipe screenshots)**
 *
 * User Flow:
 * 1. Input: User chooses URL or Image mode
 * 2. Extracting: Shows loading spinner while AI processes
 * 3. Preview: Displays parsed recipe for review
 * 4. Saving: Shows loading spinner while saving to Convex
 * 5. Success: Shows checkmark, auto-closes modal
 * 6. Error: Shows error message with "Try Again" button
 */
"use client";

import { useState, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@healthymama/convex";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UniversalRecipeCard } from "../recipe/UniversalRecipeCard";
import { Loader2, Instagram, Youtube, AlertCircle, CheckCircle2, Pin, Image, Upload, Link, X } from "lucide-react";
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
  diet?: string;
  source?: "instagram" | "youtube" | "pinterest" | "image";
  instagramUrl?: string;
  instagramVideoUrl?: string;
  instagramThumbnailUrl?: string;
  instagramUsername?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeThumbnailUrl?: string;
  pinterestUrl?: string;
  pinterestPinId?: string;
  pinterestUsername?: string;
  pinterestBoardName?: string;
  pinterestImageUrls?: string[];
  pinterestThumbnailUrl?: string;
  muxPlaybackId?: string;
  muxAssetId?: string;
  videoSegments?: VideoSegment[];
  // For image imports
  uploadedImageUrl?: string;
}

type ImportStep = "input" | "extracting" | "preview" | "saving" | "success" | "error";
type ImportMode = "url" | "image";

/**
 * Parse time strings to total minutes
 */
function parseTimeToMinutes(prep_time?: string, cook_time?: string): number | undefined {
  if (!prep_time && !cook_time) return undefined;

  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs)/i);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [importMode, setImportMode] = useState<ImportMode>("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageContext, setImageContext] = useState("");
  const [step, setStep] = useState<ImportStep>("input");
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Convex mutation to save recipe
  const importRecipe = useAction(api.instagram.importInstagramRecipe);

  // Reset state when modal closes
  const handleClose = () => {
    setVideoUrl("");
    setImageFile(null);
    setImagePreview("");
    setImageContext("");
    setStep("input");
    setExtractedRecipe(null);
    setErrorMessage("");
    setImportMode("url");
    onClose();
  };

  // Handle image file selection
  const handleImageSelect = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 10MB",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageSelect(file);
  };

  // Clear selected image
  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /**
   * Extract Recipe from URL (Instagram, YouTube, Pinterest)
   */
  const handleExtractUrl = async () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Missing URL",
        description: "Please enter a video URL",
        variant: "destructive",
      });
      return;
    }

    const isInstagram = videoUrl.includes("instagram.com");
    const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
    const isPinterest = videoUrl.includes("pinterest.com") || videoUrl.includes("pin.it");

    if (!isInstagram && !isYouTube && !isPinterest) {
      toast({
        title: "Invalid URL",
        description: "Please enter an Instagram, YouTube, or Pinterest URL",
        variant: "destructive",
      });
      return;
    }

    setStep("extracting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/instagram/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to extract recipe");
      }

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
   * Extract Recipe from Uploaded Image
   */
  const handleExtractImage = async () => {
    if (!imageFile) {
      toast({
        title: "No image selected",
        description: "Please upload an image first",
        variant: "destructive",
      });
      return;
    }

    setStep("extracting");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (imageContext.trim()) {
        formData.append("context", imageContext.trim());
      }

      const response = await fetch("/api/recipe-image/extract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to extract recipe from image");
      }

      // Store the uploaded image URL for preview
      setExtractedRecipe({
        ...data.recipe,
        source: "image",
        uploadedImageUrl: imagePreview,
      });
      setStep("preview");

      toast({
        title: "Recipe Extracted!",
        description: "Preview your recipe below",
      });
    } catch (error: any) {
      console.error("[Image Import] Error:", error);
      setErrorMessage(error.message || "Failed to extract recipe from image");
      setStep("error");

      toast({
        title: "Extraction Failed",
        description: error.message || "Could not extract recipe from image",
        variant: "destructive",
      });
    }
  };

  /**
   * Save Recipe to Convex Database
   */
  const handleSave = async () => {
    if (!extractedRecipe) return;

    setStep("saving");

    try {
      const result = await importRecipe({
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
        instagramThumbnailUrl: extractedRecipe.source === "image"
          ? extractedRecipe.uploadedImageUrl
          : extractedRecipe.instagramThumbnailUrl || undefined,
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

        const cookbookName = extractedRecipe.source === "youtube" ? "YouTube"
          : extractedRecipe.source === "image" ? "Imported"
          : "Instagram";

        toast({
          title: "Recipe Saved!",
          description: `"${extractedRecipe.title}" added to ${cookbookName} cookbook`,
        });

        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        throw new Error(result.error || "Failed to save recipe");
      }
    } catch (error: any) {
      console.error("[Import] Save error:", error);
      setErrorMessage(error.message || "Failed to save recipe");
      setStep("error");

      toast({
        title: "Save Failed",
        description: error.message || "Could not save recipe to cookbook",
        variant: "destructive",
      });
    }
  };

  // Determine platform icon based on URL
  const isYouTubeUrl = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
  const isPinterestUrl = videoUrl.includes("pinterest.com") || videoUrl.includes("pin.it");
  const PlatformIcon = importMode === "image" ? Image
    : isPinterestUrl ? Pin
    : isYouTubeUrl ? Youtube
    : Instagram;
  const iconColor = importMode === "image" ? "text-emerald-500"
    : isPinterestUrl ? "text-red-600"
    : isYouTubeUrl ? "text-red-500"
    : "text-pink-500";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left flex items-center gap-2">
            <PlatformIcon className={`w-5 h-5 ${iconColor}`} />
            Import Recipe
          </SheetTitle>
          <SheetDescription className="text-left">
            {step === "input" && "Import from URL or upload an image"}
            {step === "extracting" && (importMode === "image" ? "Analyzing image with AI..." : "Extracting recipe from video...")}
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
              {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setImportMode("url")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    importMode === "url"
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Link className="w-4 h-4" />
                  Paste URL
                </button>
                <button
                  onClick={() => setImportMode("image")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    importMode === "image"
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Image className="w-4 h-4" />
                  Upload Image
                </button>
              </div>

              {/* URL Input Mode */}
              {importMode === "url" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="video-url" className="text-sm font-medium text-gray-700">
                      Video URL
                    </label>
                    <Input
                      id="video-url"
                      type="url"
                      placeholder="Instagram, YouTube, or Pinterest URL..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Paste a link to an Instagram reel, YouTube video, or Pinterest pin
                    </p>
                  </div>

                  <Button
                    onClick={handleExtractUrl}
                    className="w-full bg-gradient-to-br from-[#dc2626] to-[#ec4899] hover:shadow-red-glow text-white"
                  >
                    <PlatformIcon className="w-4 h-4 mr-2" />
                    Extract Recipe
                  </Button>
                </div>
              )}

              {/* Image Upload Mode */}
              {importMode === "image" && (
                <div className="space-y-4">
                  {/* Image Upload Area */}
                  {!imageFile ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-700">
                        Drop an image here or click to browse
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Food photos or recipe screenshots (JPEG, PNG, WebP)
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Selected recipe"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={clearImage}
                        className="absolute top-2 right-2"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Optional Context Input */}
                  <div className="space-y-2">
                    <label htmlFor="image-context" className="text-sm font-medium text-gray-700">
                      Add context (optional)
                    </label>
                    <Textarea
                      id="image-context"
                      placeholder="e.g., 'This is my grandma's apple pie recipe' or 'Vegan chocolate cake'"
                      value={imageContext}
                      onChange={(e) => setImageContext(e.target.value)}
                      className="w-full resize-none"
                      rows={2}
                    />
                    <p className="text-xs text-gray-500">
                      Help the AI better understand your image
                    </p>
                  </div>

                  <Button
                    onClick={handleExtractImage}
                    disabled={!imageFile}
                    className="w-full bg-gradient-to-br from-emerald-500 to-teal-500 hover:shadow-lg text-white disabled:opacity-50"
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Extract Recipe from Image
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Extracting Step */}
          {step === "extracting" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className={`w-12 h-12 ${iconColor} animate-spin`} />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  {importMode === "image" ? "Analyzing image..." : "Extracting recipe..."}
                </p>
                <p className="text-xs text-gray-500">
                  {importMode === "image"
                    ? "AI is reading your image and extracting recipe details"
                    : "Fetching video data and parsing with AI"}
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
                  imageUrl: extractedRecipe.source === "image"
                    ? extractedRecipe.uploadedImageUrl
                    : extractedRecipe.source === "youtube"
                      ? extractedRecipe.youtubeThumbnailUrl
                      : extractedRecipe.instagramThumbnailUrl,
                  ingredients: extractedRecipe.ingredients,
                  instructions: extractedRecipe.instructions,
                  cuisine: extractedRecipe.cuisine,
                  muxPlaybackId: extractedRecipe.muxPlaybackId,
                  instagramUsername: extractedRecipe.instagramUsername,
                  videoSegments: extractedRecipe.videoSegments,
                  category: extractedRecipe.source === "youtube" ? "YouTube"
                    : extractedRecipe.source === "image" ? "Imported"
                    : "Instagram",
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
                  Try Again
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
                  Adding to your cookbook
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
                  Check your cookbook to view it
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
