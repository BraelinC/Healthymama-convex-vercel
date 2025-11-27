"use client";

import { useState, useRef } from "react";
import { useMutation, useAction } from "convex/react";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Video, Youtube, Instagram, AlertCircle, CheckCircle2, Image, Upload, Link, X, Camera, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UniversalRecipeCard } from "@/components/recipe/UniversalRecipeCard";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";

interface UniversalVideoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
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
  difficulty?: "easy" | "medium" | "hard";
}

type ImportStep = "input" | "downloading" | "uploading" | "analyzing" | "preview" | "saving" | "success" | "error";
type Platform = "youtube" | "instagram" | "tiktok" | "pinterest" | "other" | null;
type ImportMode = "url" | "image";

/**
 * Detect platform from URL using strict regex patterns
 */
function detectPlatform(url: string): Platform {
  // Instagram patterns
  const instagramPatterns = [
    /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+/i,
    /^https?:\/\/(www\.)?instagram\.com\/stories\/[^/]+\/\d+/i,
  ];
  if (instagramPatterns.some(pattern => pattern.test(url))) return "instagram";

  // Pinterest patterns
  const pinterestPatterns = [
    /^https?:\/\/(www\.)?pinterest\.com\/pin\/\d+/i,
    /^https?:\/\/pin\.it\/[A-Za-z0-9]+/i,
  ];
  if (pinterestPatterns.some(pattern => pattern.test(url))) return "pinterest";

  // YouTube patterns
  const youtubePatterns = [
    /^https?:\/\/(www\.|m\.)?youtube\.com\/(watch|embed|v|shorts)/i,
    /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/i,
  ];
  if (youtubePatterns.some(pattern => pattern.test(url))) return "youtube";

  // TikTok patterns
  const tiktokPatterns = [
    /^https?:\/\/(www\.|vm\.)?tiktok\.com\/@[^/]+\/video\/\d+/i,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[A-Za-z0-9]+/i,
  ];
  if (tiktokPatterns.some(pattern => pattern.test(url))) return "tiktok";

  if (url.trim()) return "other";
  return null;
}

function getPlatformIcon(platform: Platform) {
  switch (platform) {
    case "youtube":
      return <Youtube className="w-5 h-5 text-red-600" />;
    case "instagram":
      return <Instagram className="w-5 h-5 text-pink-600" />;
    case "pinterest":
      return <Image className="w-5 h-5 text-red-700" />;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // State
  const [importMode, setImportMode] = useState<ImportMode>("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageContext, setImageContext] = useState("");
  const [step, setStep] = useState<ImportStep>("input");
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null);
  const [muxThumbnailUrl, setMuxThumbnailUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [platform, setPlatform] = useState<Platform>(null);
  const [imageRecipeData, setImageRecipeData] = useState<any>(null);
  const [videoSegments, setVideoSegments] = useState<any[] | null>(null);
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);

  // Convex mutations and actions
  const saveVideoRecipeToCookbook = useMutation(api.videoRecipes.saveVideoRecipeToCookbook);
  const importRecipe = useAction(api.instagram.importInstagramRecipe);

  // Reset state when modal closes
  const handleClose = () => {
    setVideoUrl("");
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    setImageContext("");
    setStep("input");
    setExtractedRecipe(null);
    setMuxPlaybackId(null);
    setMuxThumbnailUrl(null);
    setJobId(null);
    setErrorMessage("");
    setPlatform(null);
    setImportMode("url");
    setImageRecipeData(null);
    setVideoSegments(null);
    setIsCookbookSelectionOpen(false);
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
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
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

    const detectedPlatform = detectPlatform(videoUrl);

    // Check for unsupported platforms
    if (detectedPlatform === "youtube") {
      toast({
        title: "YouTube Temporarily Disabled",
        description: "YouTube import is temporarily disabled. Please use Instagram or Pinterest URLs.",
        variant: "destructive",
      });
      return;
    }

    setStep("downloading");
    setErrorMessage("");

    try {
      // Route to correct API based on platform
      // Instagram and Pinterest use /api/instagram/import (HikerAPI + Gemini)
      // Other platforms use /api/video/import (yt-dlp) - currently disabled
      const apiEndpoint = (detectedPlatform === "instagram" || detectedPlatform === "pinterest")
        ? "/api/instagram/import"
        : "/api/video/import";

      console.log(`[Video Import] Using endpoint: ${apiEndpoint} for platform: ${detectedPlatform}`);

      const response = await fetch(apiEndpoint, {
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

      // Store extracted data (handle both API response formats)
      setExtractedRecipe(data.recipe);
      setMuxPlaybackId(data.recipe?.muxPlaybackId || data.muxPlaybackId);
      setMuxThumbnailUrl(data.recipe?.instagramThumbnailUrl || data.muxThumbnailUrl);
      setVideoSegments(data.recipe?.videoSegments || null);
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

  // Extract recipe from uploaded image
  const handleExtractImage = async () => {
    if (!imageFile) {
      toast({
        title: "No image selected",
        description: "Please upload an image first",
        variant: "destructive",
      });
      return;
    }

    setStep("analyzing");
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

      // Store the recipe data for saving
      setImageRecipeData({
        ...data.recipe,
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

  // Step 2: Open cookbook selector
  const handleAddToCookbook = () => {
    setIsCookbookSelectionOpen(true);
  };

  // Step 3: Save recipe to selected cookbook
  const handleSelectCookbook = async (cookbookId: string, cookbookName: string) => {
    setIsCookbookSelectionOpen(false);
    setStep("saving");

    try {
      // Get recipe data from either image or video import
      const recipeData = importMode === "image" ? imageRecipeData : extractedRecipe;

      if (!recipeData) {
        throw new Error("No recipe data to save");
      }

      await importRecipe({
        title: recipeData.title,
        description: recipeData.description || undefined,
        ingredients: recipeData.ingredients || [],
        instructions: recipeData.instructions || [],
        servings: recipeData.servings || undefined,
        prep_time: recipeData.prep_time || undefined,
        cook_time: recipeData.cook_time || undefined,
        cuisine: recipeData.cuisine || undefined,
        cookbookCategory: cookbookId, // User-selected cookbook
        instagramThumbnailUrl: importMode === "image"
          ? imageRecipeData?.uploadedImageUrl
          : muxThumbnailUrl || undefined,
        muxPlaybackId: importMode === "url" ? muxPlaybackId || undefined : undefined,
        videoSegments: importMode === "url" ? videoSegments || undefined : undefined,
      });

      setStep("success");
      toast({
        title: "Recipe Saved!",
        description: `Recipe added to ${cookbookName}`,
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
            Paste any URL or upload a photo
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Step 1: Input - Both URL and Image in same view */}
          {step === "input" && (
            <div className="space-y-6">
              {/* URL Input Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-healthymama-red" />
                  <label className="text-sm font-medium text-gray-700">
                    Paste a URL
                  </label>
                </div>
                <div className="relative">
                  <Input
                    type="url"
                    placeholder="Instagram, Pinterest, or Website URL..."
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
                <Button
                  onClick={() => { setImportMode("url"); handleImport(); }}
                  disabled={!videoUrl.trim()}
                  className="w-full bg-healthymama-red hover:bg-healthymama-red/90"
                >
                  Import
                </Button>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-500">or</span>
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-emerald-500" />
                  <label className="text-sm font-medium text-gray-700">
                    Upload an image
                  </label>
                </div>

                {/* Image Upload Area */}
                {!imageFile ? (
                  <div className="space-y-3">
                    {/* Three buttons for upload options */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Camera button */}
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                      >
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Camera className="w-6 h-6 text-emerald-500" />
                        <span className="text-xs text-gray-600 font-medium">Camera</span>
                      </button>

                      {/* Gallery button */}
                      <button
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                      >
                        <input
                          ref={galleryInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <ImageIcon className="w-6 h-6 text-emerald-500" />
                        <span className="text-xs text-gray-600 font-medium">Gallery</span>
                      </button>

                      {/* Upload/Browse button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Upload className="w-6 h-6 text-emerald-500" />
                        <span className="text-xs text-gray-600 font-medium">Upload</span>
                      </button>
                    </div>

                    {/* Drop zone */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center"
                    >
                      <p className="text-xs text-gray-400">
                        or drag & drop an image here
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Selected recipe"
                        className="w-full h-40 object-cover rounded-lg"
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

                    {/* Optional Context Input - only show when image selected */}
                    <Textarea
                      placeholder="Add context (optional): e.g., 'Vegan chocolate cake' or 'My grandma's recipe'"
                      value={imageContext}
                      onChange={(e) => setImageContext(e.target.value)}
                      className="w-full resize-none text-sm"
                      rows={2}
                    />
                  </div>
                )}

                <Button
                  onClick={() => { setImportMode("image"); handleExtractImage(); }}
                  disabled={!imageFile}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Extract from Image
                </Button>
              </div>
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

          {/* Step 3: Recipe Preview - Video */}
          {step === "preview" && importMode === "url" && extractedRecipe && (
            <div className="space-y-4">
              <UniversalRecipeCard
                recipe={{
                  title: extractedRecipe.title,
                  description: extractedRecipe.description,
                  ingredients: extractedRecipe.ingredients,
                  instructions: extractedRecipe.instructions,
                  muxPlaybackId: muxPlaybackId || undefined,
                  imageUrl: muxThumbnailUrl || undefined,
                  cuisine: extractedRecipe.cuisine,
                  videoSegments: videoSegments || undefined,
                }}
                onAddToCookbook={handleAddToCookbook}
                onShare={() => {
                  navigator.clipboard.writeText(videoUrl);
                  toast({
                    title: "Link Copied!",
                    description: "Recipe link copied to clipboard",
                  });
                }}
              />
            </div>
          )}

          {/* Step 3: Recipe Preview - Image */}
          {step === "preview" && importMode === "image" && imageRecipeData && (
            <div className="space-y-4">
              <UniversalRecipeCard
                recipe={{
                  title: imageRecipeData.title || "Untitled Recipe",
                  description: imageRecipeData.description,
                  ingredients: imageRecipeData.ingredients || [],
                  instructions: imageRecipeData.instructions || [],
                  imageUrl: imageRecipeData.uploadedImageUrl,
                  cuisine: imageRecipeData.cuisine,
                }}
                onAddToCookbook={handleAddToCookbook}
                onShare={() => {
                  toast({
                    title: "Share",
                    description: "Recipe ready to share!",
                  });
                }}
              />
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

      {/* Cookbook Selection Sheet */}
      <CookbookSelectionSheet
        isOpen={isCookbookSelectionOpen}
        onClose={() => setIsCookbookSelectionOpen(false)}
        recipe={{
          title: extractedRecipe?.title || imageRecipeData?.title || "Recipe",
          imageUrl: muxThumbnailUrl || imageRecipeData?.uploadedImageUrl,
        }}
        onSelectCookbook={handleSelectCookbook}
      />
    </Sheet>
  );
}
