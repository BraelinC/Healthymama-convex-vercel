"use client";

import { useState, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Loader2, Video, Youtube, Instagram, AlertCircle, CheckCircle2, Image, X, Camera, PenLine, Search, Plus, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UniversalRecipeCard } from "@/components/recipe/UniversalRecipeCard";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";
import { useRouter } from "next/navigation";

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
  instagramThumbnailUrl?: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

type ImportStep =
  | "input"
  | "downloading"
  | "uploading"
  | "analyzing"
  | "identifying"      // Gemini analyzing image (lightweight)
  | "choose-path"      // Show 2 options: manual vs search
  | "manual-entry"     // PATH A: Structured form
  | "searching"        // PATH B: Brave Search running
  | "select-recipe"    // PATH B: Show 3 recipe cards
  | "extracting"       // PATH B: Extracting from URL
  | "preview"
  | "saving"
  | "success"
  | "error";
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
  const router = useRouter();
  const { user } = useUser();
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
  const [videoSegments, setVideoSegments] = useState<any[] | null>(null);
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<Id<"userRecipes"> | null>(null);
  const recipeSavedToCookbookRef = useRef(false);
  const isSavingToCookbookRef = useRef(false); // Track if currently saving to prevent premature cleanup

  // Image identification states (dual path flow)
  const [identifiedDish, setIdentifiedDish] = useState<{
    dishName: string;
    ingredients: string[];
  } | null>(null);

  // Manual entry path states
  const [manualIngredients, setManualIngredients] = useState<Array<{
    name: string;
    amount: string;
    unit: string;
  }>>([]);
  const [manualInstructions, setManualInstructions] = useState<string[]>([""]);

  // Search path states
  const [searchResults, setSearchResults] = useState<Array<{
    title: string;
    url: string;
    description: string;
  }>>([]);

  // Extracted recipes from search (for carousel display)
  const [extractedSearchRecipes, setExtractedSearchRecipes] = useState<ExtractedRecipe[]>([]);
  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number } | null>(null);

  // Convex mutations and actions
  const saveVideoRecipeToCookbook = useMutation(api.videoRecipes.saveVideoRecipeToCookbook);
  const importRecipe = useAction(api.instagram.importInstagramRecipe);
  const updateCookbook = useMutation(api.recipes.userRecipes.updateRecipeCookbook);
  const deleteRecipe = useMutation(api.recipes.userRecipes.removeRecipeFromCookbook);

  // Helper: Delete ghost recipe (recipe without cookbook category)
  const deleteGhostRecipe = async (recipeId: Id<"userRecipes">) => {
    if (!user?.id) return;

    try {
      await deleteRecipe({
        userId: user.id,
        userRecipeId: recipeId,
      });
      console.log("[Cleanup] Deleted ghost recipe:", recipeId);
    } catch (error) {
      console.error("[Cleanup] Failed to delete ghost recipe:", error);
      // Don't show error to user - this is background cleanup
    }
  };

  // Reset state when modal closes
  const handleClose = () => {
    // CRITICAL: Don't cleanup if we're in the middle of saving to cookbook
    if (isSavingToCookbookRef.current) {
      console.log("[Cleanup] Save in progress - ignoring close request to prevent data loss");
      return; // Abort close - let the save operation complete first
    }

    // If recipe was saved but NOT added to cookbook, delete it (ghost recipe cleanup)
    console.log("[Cleanup] Checking if should delete - savedRecipeId:", savedRecipeId, "extractedRecipe:", !!extractedRecipe, "recipeSavedToCookbook:", recipeSavedToCookbookRef.current);
    if (savedRecipeId && extractedRecipe && !recipeSavedToCookbookRef.current) {
      deleteGhostRecipe(savedRecipeId);
    } else {
      console.log("[Cleanup] Skipping deletion - recipe was saved to cookbook");
    }

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
    setSavedRecipeId(null);
    recipeSavedToCookbookRef.current = false;
    isSavingToCookbookRef.current = false;
    // Reset dual path states
    setIdentifiedDish(null);
    setManualIngredients([]);
    setManualInstructions([""]);
    setSearchResults([]);
    setExtractedSearchRecipes([]);
    setExtractionProgress(null);
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

    const detectedPlatform = detectPlatform(videoUrl);

    // Check for unsupported platforms - only Instagram and Pinterest are supported
    if (detectedPlatform !== "instagram" && detectedPlatform !== "pinterest") {
      toast({
        title: "Platform Not Supported",
        description: "Currently only Instagram and Pinterest URLs are supported.",
        variant: "destructive",
      });
      return;
    }

    setStep("downloading");
    setErrorMessage("");

    try {
      // Instagram and Pinterest use /api/instagram/import (HikerAPI + Gemini)
      const apiEndpoint = "/api/instagram/import";

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
      const recipe = data.recipe;
      setExtractedRecipe(recipe);
      setMuxPlaybackId(recipe?.muxPlaybackId || data.muxPlaybackId);
      setMuxThumbnailUrl(recipe?.instagramThumbnailUrl || data.muxThumbnailUrl);
      setVideoSegments(recipe?.videoSegments || null);
      setJobId(data.jobId);
      setStep("preview");

      toast({
        title: "Recipe Extracted!",
        description: "Preview your recipe below",
      });

      // Save recipe in background WITHOUT cookbook category (ghost recipe)
      // This allows the user to add to cookbook later
      try {
        const result = await importRecipe({
          title: recipe.title,
          description: recipe.description || undefined,
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || [],
          servings: recipe.servings || undefined,
          prep_time: recipe.prep_time || undefined,
          cook_time: recipe.cook_time || undefined,
          cuisine: recipe.cuisine || undefined,
          cookbookCategory: undefined, // NO COOKBOOK - ghost recipe
          instagramThumbnailUrl: recipe.instagramThumbnailUrl || recipe.imageUrl,
          muxPlaybackId: recipe.muxPlaybackId || undefined,
          videoSegments: recipe.videoSegments || undefined,
        });

        if (result.success && result.recipeId) {
          setSavedRecipeId(result.recipeId as Id<"userRecipes">);
          console.log("[URL Import] Ghost recipe saved:", result.recipeId);
        } else if (result.recipeId) {
          // Recipe already exists - use existing ID
          setSavedRecipeId(result.recipeId as Id<"userRecipes">);
          console.log("[URL Import] Recipe already exists, using existing ID:", result.recipeId);
        } else {
          console.error("[URL Import] Failed to save ghost recipe:", result.error);
        }
      } catch (saveError: any) {
        console.error("[URL Import] Error saving ghost recipe:", saveError);
        // Don't show error - user can still see the preview
      }
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

  // Identify dish from uploaded image (lightweight - just name + ingredients)
  const handleIdentifyDish = async () => {
    if (!imageFile) {
      toast({
        title: "No image selected",
        description: "Please upload an image first",
        variant: "destructive",
      });
      return;
    }

    setStep("identifying");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const response = await fetch("/api/recipe-image/identify", {
        method: "POST",
        body: formData,
      });

      console.log("[Image Identify] Response status:", response.status, response.statusText);

      // Get response text first to handle non-JSON responses
      const responseText = await response.text();
      console.log("[Image Identify] Response text (first 200 chars):", responseText.substring(0, 200));

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[Image Identify] JSON parse error:", parseError);
        console.error("[Image Identify] Full response:", responseText);
        // Show first 100 chars of response in error message for debugging
        const preview = responseText.substring(0, 100);
        throw new Error(`Server returned invalid response: ${preview}${responseText.length > 100 ? '...' : ''}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to identify dish from image");
      }

      // Store identified dish and go to choose-path step
      setIdentifiedDish({
        dishName: data.dishName,
        ingredients: data.ingredients,
      });
      setStep("choose-path");

      toast({
        title: "Dish Identified!",
        description: `Looks like ${data.dishName}`,
      });
    } catch (error: any) {
      console.error("[Image Identify] Error:", error);
      setErrorMessage(error.message || "Failed to identify dish from image");
      setStep("error");

      toast({
        title: "Identification Failed",
        description: error.message || "Could not identify dish from image",
        variant: "destructive",
      });
    }
  };

  // Manual entry helpers
  const updateIngredient = (index: number, field: 'name' | 'amount' | 'unit', value: string) => {
    setManualIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addIngredient = () => {
    setManualIngredients(prev => [...prev, { name: "", amount: "", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setManualIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, value: string) => {
    setManualInstructions(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const addInstruction = () => {
    setManualInstructions(prev => [...prev, ""]);
  };

  const removeInstruction = (index: number) => {
    setManualInstructions(prev => prev.filter((_, i) => i !== index));
  };

  // Format manual ingredients for saving
  const formatManualIngredients = () => {
    return manualIngredients
      .filter(ing => ing.name.trim())
      .map(ing => {
        const parts = [ing.amount, ing.unit, ing.name].filter(Boolean);
        return parts.join(" ");
      });
  };

  // Save manual recipe (Path A)
  const handleSaveManualRecipe = () => {
    if (!identifiedDish) return;

    const recipe = {
      title: identifiedDish.dishName,
      ingredients: formatManualIngredients(),
      instructions: manualInstructions.filter(i => i.trim()),
      uploadedImageUrl: imagePreview,
    };
    setImageRecipeData(recipe);
    setStep("preview");
  };

  // Search for recipes using Brave Search and extract top 3 (Path B)
  const handleSearchRecipes = async () => {
    if (!identifiedDish) return;

    setStep("searching");
    setExtractedSearchRecipes([]);
    setExtractionProgress(null);
    const query = `${identifiedDish.dishName} recipe`;

    try {
      // Step 1: Search for recipes
      const response = await fetch("/api/brave-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Search failed");
      }

      const searchUrls = data.results || [];

      if (searchUrls.length === 0) {
        toast({
          title: "No recipes found",
          description: "Try adding the recipe manually instead",
          variant: "destructive",
        });
        setStep("choose-path");
        return;
      }

      setSearchResults(searchUrls);

      // Step 2: Extract top 8 recipes in parallel (show top 3 successful)
      // Now that we filter blocked sites, we should get mostly successful extractions
      setStep("extracting");
      const urlsToExtract = searchUrls.slice(0, 8);
      setExtractionProgress({ current: 0, total: 8 });

      const extractedRecipes: ExtractedRecipe[] = [];

      // Extract recipes in parallel using the general recipe URL extractor
      const extractionPromises = urlsToExtract.map(async (result: { url: string; title: string }, index: number) => {
        try {
          // Use the new recipe URL extraction endpoint (works with any recipe website)
          const extractResponse = await fetch("/api/recipe-url/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: result.url }),
          });

          const extractData = await extractResponse.json();

          if (extractResponse.ok && extractData.success && extractData.recipe) {
            return {
              ...extractData.recipe,
              sourceUrl: result.url,
              sourceTitle: result.title,
            };
          }
          return null;
        } catch (error) {
          console.error(`[Extract] Failed to extract from ${result.url}:`, error);
          return null;
        }
      });

      // Wait for all extractions and update progress
      const results = await Promise.all(extractionPromises);
      const successfulRecipes = results.filter((r): r is ExtractedRecipe => r !== null);

      if (successfulRecipes.length === 0) {
        toast({
          title: "Extraction failed",
          description: "Could not extract recipes. Try adding manually instead.",
          variant: "destructive",
        });
        setStep("choose-path");
        return;
      }

      // Show top 3 successful extractions
      const top3Recipes = successfulRecipes.slice(0, 3);
      setExtractedSearchRecipes(top3Recipes);
      setExtractionProgress({ current: successfulRecipes.length, total: 6 });
      setStep("select-recipe");

      toast({
        title: "Recipes Found!",
        description: `Found ${successfulRecipes.length} recipe${successfulRecipes.length > 1 ? 's' : ''}, showing top 3`,
      });
    } catch (error: any) {
      console.error("[Brave Search] Error:", error);
      toast({
        title: "Search Failed",
        description: error.message || "Could not search for recipes",
        variant: "destructive",
      });
      setStep("choose-path");
    }
  };

  // Select a recipe from the carousel (Path B)
  const handleSelectExtractedRecipe = async (recipe: ExtractedRecipe) => {
    console.log("[DEBUG] 1. Carousel card clicked, recipe:", recipe.title);
    setExtractedRecipe(recipe);
    setMuxThumbnailUrl(recipe.instagramThumbnailUrl || null);
    setImportMode("url"); // Set to url mode for carousel recipes

    console.log("[DEBUG] 2. Saving ghost recipe to database...");
    // Save recipe WITHOUT cookbook category (ghost recipe) - WAIT for completion
    try {
      const result = await importRecipe({
        title: recipe.title,
        description: recipe.description || undefined,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: recipe.servings || undefined,
        prep_time: recipe.prep_time || undefined,
        cook_time: recipe.cook_time || undefined,
        cuisine: recipe.cuisine || undefined,
        cookbookCategory: undefined, // NO COOKBOOK - ghost recipe
        instagramThumbnailUrl: recipe.instagramThumbnailUrl || recipe.imageUrl,
        muxPlaybackId: undefined,
        videoSegments: undefined,
      });

      if (result.success && result.recipeId) {
        console.log("[DEBUG] 3. Ghost recipe saved with ID:", result.recipeId);
        setSavedRecipeId(result.recipeId as Id<"userRecipes">);
        console.log("[DEBUG] 4. Going to preview step");
        setStep("preview"); // Only go to preview AFTER save completes
      } else if (result.recipeId) {
        // Recipe already exists - use existing ID
        console.log("[DEBUG] 3. Recipe already exists, using existing ID:", result.recipeId);
        setSavedRecipeId(result.recipeId as Id<"userRecipes">);
        console.log("[DEBUG] 4. Going to preview step");
        setStep("preview");
      } else {
        console.error("[DEBUG] Failed to save ghost recipe:", result.error);
        setErrorMessage("Failed to load recipe");
        setStep("error");
      }
    } catch (error: any) {
      console.error("[DEBUG] Error saving ghost recipe:", error);
      setErrorMessage("Failed to load recipe");
      setStep("error");
    }
  };

  // Legacy: Extract recipe from selected search result URL (Path B) - kept for fallback
  const handleSelectSearchResult = async (url: string) => {
    setStep("extracting");

    try {
      const response = await fetch("/api/instagram/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, userId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to extract recipe");
      }

      setExtractedRecipe(data.recipe);
      setMuxThumbnailUrl(data.recipe?.instagramThumbnailUrl || null);
      setStep("preview");

      toast({
        title: "Recipe Extracted!",
        description: "Preview your recipe below",
      });
    } catch (error: any) {
      console.error("[URL Extract] Error:", error);

      // Remove failed result and show remaining
      const remainingResults = searchResults.filter(r => r.url !== url);
      setSearchResults(remainingResults);

      if (remainingResults.length > 0) {
        setStep("select-recipe");
        toast({
          title: "That link failed",
          description: "Try another recipe",
          variant: "destructive",
        });
      } else {
        setErrorMessage("Could not extract recipe. Try adding manually.");
        setStep("error");
      }
    }
  };

  // Step 2: Open cookbook selector
  const handleAddToCookbook = () => {
    console.log("[DEBUG] 6. + button clicked, savedRecipeId:", savedRecipeId);
    if (!savedRecipeId) {
      console.log("[DEBUG] ERROR: No savedRecipeId, cannot open cookbook sheet");
      toast({
        title: "Recipe Not Ready",
        description: "Please wait while recipe loads...",
        variant: "destructive",
      });
      return;
    }
    console.log("[DEBUG] 7. Opening cookbook selection sheet");
    setIsCookbookSelectionOpen(true);
  };

  // Step 3: Save recipe to selected cookbook
  const handleSelectCookbook = async (cookbookId: string, cookbookName: string) => {
    console.log("[DEBUG] 8. Cookbook selected:", cookbookName, "ID:", cookbookId);
    console.log("[DEBUG] 9. Closing cookbook sheet and showing 'Importing Recipes...' loading");
    setIsCookbookSelectionOpen(false);

    if (!savedRecipeId || !user?.id) {
      console.log("[DEBUG] ERROR: Missing savedRecipeId or user.id");
      toast({
        title: "Error",
        description: "Recipe not ready to save",
        variant: "destructive",
      });
      return;
    }

    // CRITICAL: Mark that we're starting to save - this prevents premature modal close
    isSavingToCookbookRef.current = true;
    console.log("[DEBUG] Set isSavingToCookbookRef to TRUE - save starting");

    setStep("saving");
    console.log("[DEBUG] 10. Updating recipe with cookbook category...");

    try {
      // Update ghost recipe with cookbook category
      await updateCookbook({
        userId: user.id,
        userRecipeId: savedRecipeId,
        newCookbookCategory: cookbookId,
      });

      console.log("[DEBUG] 11. Recipe saved successfully to", cookbookName);
      recipeSavedToCookbookRef.current = true; // Mark as saved to prevent cleanup deletion
      isSavingToCookbookRef.current = false; // Save complete - allow close now
      console.log("[DEBUG] Set recipeSavedToCookbookRef to true, isSavingToCookbookRef to false");
      setStep("success");
      toast({
        title: "Recipe Saved!",
        description: `Added to ${cookbookName}`,
      });

      // Close modal after save
      setTimeout(() => {
        console.log("[DEBUG] 12. Closing modal");
        handleClose();
      }, 1500);
    } catch (error: any) {
      console.error("[DEBUG] ERROR saving to cookbook:", error);
      isSavingToCookbookRef.current = false; // Save failed - allow close now
      console.log("[DEBUG] Set isSavingToCookbookRef to false (error case)");
      setErrorMessage(error.message || "Failed to save to cookbook");
      setStep("error");
      toast({
        title: "Save Failed",
        description: error.message || "Could not save to cookbook",
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
      case "identifying":
        return "Identifying dish...";
      case "searching":
        return "Searching for recipes...";
      case "extracting":
        return "Finding Recipes";
      case "saving":
        return "Importing Recipes...";
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
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Step 1: Input - Both URL and Image in same view */}
          {step === "input" && (
            <div className="space-y-6">
              {/* URL Input Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">
                  Paste a URL
                </label>
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
                    {/* Single Insert a pic button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Camera className="w-6 h-6 text-emerald-500" />
                      <span className="text-sm text-gray-600 font-medium">Insert a pic</span>
                    </button>
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
                  onClick={() => { setImportMode("image"); handleIdentifyDish(); }}
                  disabled={!imageFile}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Identify Dish
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Processing States */}
          {(step === "downloading" || step === "uploading" || step === "analyzing" || step === "identifying" || step === "searching" || step === "extracting") && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-healthymama-red animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900">{getStepMessage()}</p>
                <p className="text-sm text-gray-500 mt-1">
                  This may take a minute...
                </p>
              </div>
              {/* Progress Steps - only show for URL import */}
              {importMode === "url" && (
                <div className="flex items-center gap-2 mt-4">
                  <div className={`w-2 h-2 rounded-full ${step === "downloading" ? "bg-healthymama-red animate-pulse" : "bg-gray-300"}`} />
                  <div className={`w-2 h-2 rounded-full ${step === "uploading" ? "bg-healthymama-red animate-pulse" : "bg-gray-300"}`} />
                  <div className={`w-2 h-2 rounded-full ${step === "analyzing" ? "bg-healthymama-red animate-pulse" : "bg-gray-300"}`} />
                </div>
              )}
            </div>
          )}

          {/* Choose Path Step - After dish identification */}
          {step === "choose-path" && identifiedDish && (
            <div className="space-y-6">
              {/* Identified dish summary */}
              <div className="text-center">
                <img
                  src={imagePreview}
                  alt={identifiedDish.dishName}
                  className="w-32 h-32 mx-auto rounded-xl object-cover shadow-md"
                />
                <h3 className="text-xl font-semibold mt-4 text-gray-900">
                  {identifiedDish.dishName}
                </h3>
                <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                  {identifiedDish.ingredients.slice(0, 5).join(", ")}
                  {identifiedDish.ingredients.length > 5 && ` +${identifiedDish.ingredients.length - 5} more`}
                </p>
              </div>

              {/* Path Selection */}
              <div className="space-y-3">
                <p className="text-sm text-center text-gray-600 font-medium">
                  How would you like to continue?
                </p>

                {/* Path A: Manual Entry */}
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex flex-col items-center gap-1 hover:border-healthymama-red hover:bg-red-50"
                  onClick={() => {
                    // Pre-populate ingredients from AI
                    setManualIngredients(identifiedDish.ingredients.map(ing => ({
                      name: ing,
                      amount: "",
                      unit: ""
                    })));
                    setManualInstructions([""]);
                    setStep("manual-entry");
                  }}
                >
                  <PenLine className="w-6 h-6 text-healthymama-red" />
                  <span className="font-medium text-gray-900">Add My Own Recipe</span>
                  <span className="text-xs text-gray-500">Add amounts & instructions</span>
                </Button>

                {/* Path B: Search */}
                <Button
                  className="w-full h-auto py-4 flex flex-col items-center gap-1 bg-healthymama-red hover:bg-healthymama-red/90"
                  onClick={handleSearchRecipes}
                >
                  <Search className="w-6 h-6" />
                  <span className="font-medium">Search for Recipes</span>
                  <span className="text-xs text-white/80">Find recipes online</span>
                </Button>
              </div>

              {/* Back button */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setStep("input")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            </div>
          )}

          {/* Manual Entry Step (Path A) */}
          {step === "manual-entry" && identifiedDish && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt={identifiedDish.dishName}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <h3 className="font-semibold text-gray-900">{identifiedDish.dishName}</h3>
                  <p className="text-sm text-gray-500">Add recipe details below</p>
                </div>
              </div>

              {/* Ingredients with amounts */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Ingredients</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {manualIngredients.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        placeholder="Amt"
                        value={ing.amount}
                        onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                        className="w-16 text-sm"
                      />
                      <Select
                        value={ing.unit}
                        onValueChange={(v) => updateIngredient(i, 'unit', v)}
                      >
                        <SelectTrigger className="w-20 text-sm bg-white border-gray-300">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cups">cups</SelectItem>
                          <SelectItem value="tbsp">tbsp</SelectItem>
                          <SelectItem value="tsp">tsp</SelectItem>
                          <SelectItem value="oz">oz</SelectItem>
                          <SelectItem value="lbs">lbs</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="pcs">pcs</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={ing.name}
                        onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                        className="flex-1 text-sm"
                        placeholder="Ingredient"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                        onClick={() => removeIngredient(i)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Ingredient
                </Button>
              </div>

              {/* Instructions */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Instructions</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {manualInstructions.map((inst, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-gray-400 mt-2 text-sm font-medium w-6">{i + 1}.</span>
                      <Textarea
                        value={inst}
                        onChange={(e) => updateInstruction(i, e.target.value)}
                        className="flex-1 text-sm resize-none"
                        rows={2}
                        placeholder={`Step ${i + 1}...`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-500 mt-1"
                        onClick={() => removeInstruction(i)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addInstruction}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Step
                </Button>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <Button
                  className="w-full bg-healthymama-red hover:bg-healthymama-red/90"
                  onClick={handleSaveManualRecipe}
                  disabled={manualIngredients.filter(i => i.name.trim()).length === 0}
                >
                  Preview Recipe
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setStep("choose-path")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Select Recipe Step (Path B - Extracted Recipes Carousel) */}
          {step === "select-recipe" && extractedSearchRecipes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Choose a Recipe</h3>
                <span className="text-sm text-gray-500">
                  {extractedSearchRecipes.length} recipe{extractedSearchRecipes.length > 1 ? 's' : ''} found
                </span>
              </div>

              {/* Recipe Carousel */}
              <div className="px-8">
                <Carousel
                  opts={{
                    align: "start",
                    loop: false,
                  }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-2">
                    {extractedSearchRecipes.map((recipe, i) => (
                      <CarouselItem key={i} className="pl-2 basis-full">
                        <div
                          className="cursor-pointer"
                          onClick={() => handleSelectExtractedRecipe(recipe)}
                        >
                          <UniversalRecipeCard
                            recipe={{
                              title: recipe.title,
                              description: recipe.description,
                              ingredients: recipe.ingredients,
                              instructions: recipe.instructions,
                              imageUrl: recipe.instagramThumbnailUrl || recipe.imageUrl,
                              cuisine: recipe.cuisine,
                              servings: recipe.servings,
                              prep_time: recipe.prep_time,
                              cook_time: recipe.cook_time,
                            }}
                            onAddToCookbook={() => handleSelectExtractedRecipe(recipe)}
                          />
                        </div>
                        {recipe.sourceUrl && (
                          <p className="text-xs text-gray-400 mt-2 text-center">
                            From: {(() => {
                              try {
                                return new URL(recipe.sourceUrl).hostname.replace('www.', '');
                              } catch {
                                return 'web';
                              }
                            })()}
                          </p>
                        )}
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {extractedSearchRecipes.length > 1 && (
                    <>
                      <CarouselPrevious className="text-gray-900 border-gray-300 hover:bg-gray-100 -left-8" />
                      <CarouselNext className="text-gray-900 border-gray-300 hover:bg-gray-100 -right-8" />
                    </>
                  )}
                </Carousel>
              </div>

              {/* Carousel dots indicator */}
              {extractedSearchRecipes.length > 1 && (
                <div className="flex justify-center gap-1.5 pt-2">
                  {extractedSearchRecipes.map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-gray-300"
                    />
                  ))}
                </div>
              )}

              <p className="text-sm text-center text-gray-500">
                Swipe or use arrows to browse • Tap to select
              </p>

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setStep("choose-path")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          )}

          {/* Step 3: Recipe Preview - Video */}
          {console.log("[DEBUG] Preview check - step:", step, "importMode:", importMode, "extractedRecipe:", !!extractedRecipe, "savedRecipeId:", savedRecipeId)}
          {step === "preview" && importMode === "url" && extractedRecipe && (
            <div className="space-y-4">
              {savedRecipeId ? (
                <>
                  {console.log("[DEBUG] 5. Rendering preview with recipe ID:", savedRecipeId, "imageUrl:", extractedRecipe.instagramThumbnailUrl || extractedRecipe.imageUrl)}
                  <UniversalRecipeCard
                    recipe={{
                      _id: savedRecipeId,
                      title: extractedRecipe.title,
                      description: extractedRecipe.description,
                      ingredients: extractedRecipe.ingredients,
                      instructions: extractedRecipe.instructions,
                      muxPlaybackId: muxPlaybackId || undefined,
                      imageUrl: extractedRecipe.instagramThumbnailUrl || extractedRecipe.imageUrl || muxThumbnailUrl || undefined,
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
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500">Loading recipe...</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Recipe Preview - Image */}
          {step === "preview" && importMode === "image" && imageRecipeData && (
            <div className="space-y-4">
              <UniversalRecipeCard
                recipe={{
                  _id: savedRecipeId,
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
              <p className="text-lg font-medium text-gray-900">Importing Recipes...</p>
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
          id: savedRecipeId || undefined,
          title: extractedRecipe?.title || imageRecipeData?.title || "Recipe",
          imageUrl: extractedRecipe?.instagramThumbnailUrl || extractedRecipe?.imageUrl || muxThumbnailUrl || imageRecipeData?.uploadedImageUrl,
        }}
        onSelectCookbook={handleSelectCookbook}
      />
    </Sheet>
  );
}
