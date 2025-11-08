/**
 * Instagram Import Modal Component
 *
 * A multi-step modal/sheet for importing recipes from Instagram reels.
 * Guides users through URL input → extraction → preview → save workflow.
 *
 * User Flow:
 * 1. Input: User pastes Instagram reel URL
 * 2. Extracting: Shows loading spinner while fetching + parsing
 * 3. Preview: Displays parsed recipe for review (ingredients, instructions, metadata)
 * 4. Saving: Shows loading spinner while saving to Convex
 * 5. Success: Shows checkmark, auto-closes modal after 1.5 seconds
 * 6. Error: Shows error message with "Try Again" button
 *
 * Technical Flow:
 * 1. User pastes URL → Frontend validation
 * 2. Call /api/instagram/import (Next.js API route)
 * 3. API route calls Railway service + OpenRouter AI
 * 4. Return formatted recipe JSON
 * 5. Display preview in modal
 * 6. User clicks "Save" → Call Convex mutation (importInstagramRecipe)
 * 7. Recipe saved to "Instagram" cookbook
 * 8. Success toast + modal closes
 *
 * Component Architecture:
 * - Uses shadcn/ui Sheet component (bottom drawer on mobile)
 * - State-driven step transitions (input → extracting → preview → saving → success/error)
 * - Toast notifications for user feedback
 * - Responsive design (mobile-first)
 *
 * Props:
 * @param isOpen - Controls modal visibility
 * @param onClose - Callback to close modal and reset state
 * @param userId - Clerk user ID (required for Convex mutation)
 *
 * Dependencies:
 * - Convex: importInstagramRecipe mutation
 * - API Route: /api/instagram/import
 * - UI Components: Sheet, Button, Input, Loader, Icons
 */
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
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
import { Loader2, Instagram, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InstagramImportModalProps {
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
  instagramUrl: string;
  instagramVideoUrl?: string;
  instagramThumbnailUrl?: string;
  instagramUsername?: string;
}

type ImportStep = "input" | "extracting" | "preview" | "saving" | "success" | "error";

export function InstagramImportModal({
  isOpen,
  onClose,
  userId,
}: InstagramImportModalProps) {
  const { toast } = useToast();
  const [instagramUrl, setInstagramUrl] = useState("");
  const [step, setStep] = useState<ImportStep>("input");
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Convex mutation to save recipe
  const importRecipe = useMutation(api.instagram.importInstagramRecipe);

  // Reset state when modal closes
  const handleClose = () => {
    setInstagramUrl("");
    setStep("input");
    setExtractedRecipe(null);
    setErrorMessage("");
    onClose();
  };

  /**
   * Step 1: Extract Recipe from Instagram
   *
   * Calls the Next.js API route to orchestrate:
   * - Railway service (Instagram data extraction)
   * - OpenRouter AI (recipe parsing)
   *
   * Process:
   * 1. Validate Instagram URL (must contain "instagram.com")
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
   * - Railway fetch: 2-5 seconds
   * - AI parsing: 2-5 seconds
   * - Network latency: 1-5 seconds
   */
  const handleExtract = async () => {
    if (!instagramUrl.trim()) {
      toast({
        title: "Missing URL",
        description: "Please enter an Instagram URL",
        variant: "destructive",
      });
      return;
    }

    // Validate Instagram URL
    if (!instagramUrl.includes("instagram.com")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Instagram URL",
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
        body: JSON.stringify({ url: instagramUrl }),
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
      console.error("[Instagram Import] Error:", error);
      setErrorMessage(error.message || "Failed to import recipe");
      setStep("error");

      toast({
        title: "Import Failed",
        description: error.message || "Could not extract recipe from Instagram",
        variant: "destructive",
      });
    }
  };

  /**
   * Step 2: Save Recipe to Convex Database
   *
   * Calls the Convex mutation to save the extracted recipe to the user's cookbook.
   * The recipe is automatically saved to the "Instagram" cookbook category.
   *
   * Process:
   * 1. Validate extractedRecipe exists
   * 2. Set step to "saving" (shows loading UI)
   * 3. Call importInstagramRecipe mutation with all recipe data
   * 4. Handle response (success or duplicate error)
   * 5. Transition to "success" step
   * 6. Auto-close modal after 1.5 seconds
   *
   * Error Handling:
   * - Duplicate recipe: Mutation returns {success: false, error: "already imported"}
   * - Database error: Caught and displayed in error step
   * - Network error: Caught and displayed in error step
   *
   * Convex Mutation:
   * - Function: api.instagram.importInstagramRecipe
   * - Result: {success: boolean, recipeId?: string, error?: string}
   * - Auto-creates "Instagram" cookbook if doesn't exist
   *
   * Post-Success:
   * - Shows success step with checkmark
   * - Displays success toast
   * - Auto-closes modal after 1.5 seconds
   * - User can view recipe in Instagram cookbook
   */
  const handleSave = async () => {
    if (!extractedRecipe) return;

    setStep("saving");

    try {
      const result = await importRecipe({
        userId,
        title: extractedRecipe.title,
        description: extractedRecipe.description,
        ingredients: extractedRecipe.ingredients,
        instructions: extractedRecipe.instructions,
        servings: extractedRecipe.servings,
        prep_time: extractedRecipe.prep_time,
        cook_time: extractedRecipe.cook_time,
        cuisine: extractedRecipe.cuisine,
        instagramUrl: extractedRecipe.instagramUrl,
        instagramVideoUrl: extractedRecipe.instagramVideoUrl,
        instagramThumbnailUrl: extractedRecipe.instagramThumbnailUrl,
        instagramUsername: extractedRecipe.instagramUsername,
      });

      if (result.success) {
        setStep("success");

        toast({
          title: "Recipe Saved!",
          description: `"${extractedRecipe.title}" added to Instagram cookbook`,
        });

        // Close modal after 1.5 seconds
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        throw new Error(result.error || "Failed to save recipe");
      }
    } catch (error: any) {
      console.error("[Instagram Import] Save error:", error);
      setErrorMessage(error.message || "Failed to save recipe");
      setStep("error");

      toast({
        title: "Save Failed",
        description: error.message || "Could not save recipe to cookbook",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-500" />
            Import from Instagram
          </SheetTitle>
          <SheetDescription className="text-left">
            {step === "input" && "Paste an Instagram reel URL to extract the recipe"}
            {step === "extracting" && "Extracting recipe from Instagram..."}
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
                <label htmlFor="instagram-url" className="text-sm font-medium text-gray-700">
                  Instagram Reel URL
                </label>
                <Input
                  id="instagram-url"
                  type="url"
                  placeholder="https://www.instagram.com/reel/ABC123/"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Paste a link to an Instagram reel with a recipe in the caption or comments
                </p>
              </div>

              <Button
                onClick={handleExtract}
                className="w-full bg-gradient-to-br from-[#dc2626] to-[#ec4899] hover:shadow-red-glow text-white"
              >
                <Instagram className="w-4 h-4 mr-2" />
                Extract Recipe
              </Button>
            </div>
          )}

          {/* Extracting Step */}
          {step === "extracting" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-gray-900">Extracting recipe...</p>
                <p className="text-xs text-gray-500">
                  Fetching Instagram data and parsing with AI
                </p>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && extractedRecipe && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-gray-900">{extractedRecipe.title}</h3>
                    {extractedRecipe.description && (
                      <p className="text-sm text-gray-600">{extractedRecipe.description}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  {extractedRecipe.servings && (
                    <div>
                      <span className="font-medium">Servings:</span> {extractedRecipe.servings}
                    </div>
                  )}
                  {extractedRecipe.prep_time && (
                    <div>
                      <span className="font-medium">Prep:</span> {extractedRecipe.prep_time}
                    </div>
                  )}
                  {extractedRecipe.cook_time && (
                    <div>
                      <span className="font-medium">Cook:</span> {extractedRecipe.cook_time}
                    </div>
                  )}
                  {extractedRecipe.cuisine && (
                    <div>
                      <span className="font-medium">Cuisine:</span> {extractedRecipe.cuisine}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">
                    Ingredients ({extractedRecipe.ingredients.length})
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                    {extractedRecipe.ingredients.slice(0, 5).map((ingredient, i) => (
                      <li key={i}>• {ingredient}</li>
                    ))}
                    {extractedRecipe.ingredients.length > 5 && (
                      <li className="text-gray-400">
                        + {extractedRecipe.ingredients.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">
                    Instructions ({extractedRecipe.instructions.length} steps)
                  </p>
                  <ol className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto list-decimal list-inside">
                    {extractedRecipe.instructions.slice(0, 3).map((instruction, i) => (
                      <li key={i}>{instruction}</li>
                    ))}
                    {extractedRecipe.instructions.length > 3 && (
                      <li className="text-gray-400">
                        + {extractedRecipe.instructions.length - 3} more steps
                      </li>
                    )}
                  </ol>
                </div>

                {extractedRecipe.instagramUsername && (
                  <p className="text-xs text-gray-500">
                    From @{extractedRecipe.instagramUsername}
                  </p>
                )}
              </div>

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
              <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-gray-900">Saving recipe...</p>
                <p className="text-xs text-gray-500">Adding to Instagram cookbook</p>
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
                  Check your Instagram cookbook to view it
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
