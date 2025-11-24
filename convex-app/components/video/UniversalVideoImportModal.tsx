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
import { Loader2, Video, Youtube, Instagram, AlertCircle, CheckCircle2, Image, Upload, Link, X } from "lucide-react";
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
type ImportMode = "url" | "image";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Step 2: Save recipe to cookbook
  const handleSaveToCookbook = async () => {
    // Handle image recipe save
    if (importMode === "image" && imageRecipeData) {
      setStep("saving");
      try {
        await importRecipe({
          title: imageRecipeData.title,
          description: imageRecipeData.description || undefined,
          ingredients: imageRecipeData.ingredients || [],
          instructions: imageRecipeData.instructions || [],
          servings: imageRecipeData.servings || undefined,
          prep_time: imageRecipeData.prep_time || undefined,
          cook_time: imageRecipeData.cook_time || undefined,
          cuisine: imageRecipeData.cuisine || undefined,
          source: "image",
          instagramThumbnailUrl: imageRecipeData.uploadedImageUrl,
        });

        setStep("success");
        toast({
          title: "Recipe Saved!",
          description: "Recipe has been added to your cookbook",
        });

        setTimeout(() => {
          handleClose();
        }, 2000);
      } catch (error: any) {
        console.error("[Image Import] Save error:", error);
        setErrorMessage(error.message || "Failed to save recipe");
        setStep("error");
        toast({
          title: "Save Failed",
          description: error.message || "Could not save recipe to cookbook",
          variant: "destructive",
        });
      }
      return;
    }

    // Handle video recipe save
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
            Paste a video URL or upload a photo
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
                    Paste a video URL
                  </label>
                </div>
                <div className="relative">
                  <Input
                    type="url"
                    placeholder="YouTube, Instagram, or TikTok URL..."
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
                  Import from Video
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
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Drop image here or click to browse
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Food photos or recipe screenshots
                    </p>
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

          {/* Step 3: Recipe Preview - Image */}
          {step === "preview" && importMode === "image" && imageRecipeData && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                {/* Show uploaded image */}
                {imageRecipeData.uploadedImageUrl && (
                  <div className="relative aspect-video bg-gray-100">
                    <img
                      src={imageRecipeData.uploadedImageUrl}
                      alt={imageRecipeData.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">
                      From Image
                    </div>
                  </div>
                )}

                {/* Recipe Details */}
                <div className="p-4 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{imageRecipeData.title}</h3>
                    {imageRecipeData.description && (
                      <p className="text-sm text-gray-600 mt-1">{imageRecipeData.description}</p>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    {imageRecipeData.servings && <span>🍽️ {imageRecipeData.servings}</span>}
                    {imageRecipeData.prep_time && <span>⏱️ Prep: {imageRecipeData.prep_time}</span>}
                    {imageRecipeData.cook_time && <span>🔥 Cook: {imageRecipeData.cook_time}</span>}
                    {imageRecipeData.cuisine && <span>🍳 {imageRecipeData.cuisine}</span>}
                  </div>

                  {/* Ingredients */}
                  {imageRecipeData.ingredients?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Ingredients ({imageRecipeData.ingredients.length})
                      </h4>
                      <ul className="space-y-1">
                        {imageRecipeData.ingredients.slice(0, 5).map((ing: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700">
                            • {ing}
                          </li>
                        ))}
                        {imageRecipeData.ingredients.length > 5 && (
                          <li className="text-sm text-gray-500 italic">
                            + {imageRecipeData.ingredients.length - 5} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {imageRecipeData.instructions?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Instructions ({imageRecipeData.instructions.length})
                      </h4>
                      <ol className="space-y-2">
                        {imageRecipeData.instructions.slice(0, 3).map((inst: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700">
                            <span className="font-medium">{idx + 1}.</span> {inst}
                          </li>
                        ))}
                        {imageRecipeData.instructions.length > 3 && (
                          <li className="text-sm text-gray-500 italic">
                            + {imageRecipeData.instructions.length - 3} more steps...
                          </li>
                        )}
                      </ol>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("input")}
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button
                  onClick={handleSaveToCookbook}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  Save to Cookbook
                </Button>
              </div>
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
