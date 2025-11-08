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

  // Step 1: Extract recipe from Instagram
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

  // Step 2: Save recipe to Convex
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
