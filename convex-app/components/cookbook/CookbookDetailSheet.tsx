"use client";

import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CompactRecipeCard } from "../recipe/CompactRecipeCard";
import { RecipeDetailSheet } from "../recipe/RecipeDetailSheet";
import { CookbookSelectionSheet } from "./CookbookSelectionSheet";
import { useState, useCallback } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";

interface CookbookDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cookbookId: string;
  cookbookName: string;
  userId: string;
}

const COOKBOOK_EMOJIS: Record<string, string> = {
  favorites: "❤️",
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
  dessert: "🍰",
  snacks: "🍿",
};

const COOKBOOK_GRADIENTS: Record<string, string> = {
  favorites: "from-red-400 to-pink-500",
  breakfast: "from-amber-400 to-orange-500",
  lunch: "from-green-400 to-emerald-500",
  dinner: "from-purple-400 to-indigo-500",
  dessert: "from-pink-400 to-rose-500",
  snacks: "from-yellow-400 to-amber-500",
};

export function CookbookDetailSheet({
  isOpen,
  onClose,
  cookbookId,
  cookbookName,
  userId,
}: CookbookDetailSheetProps) {
  const router = useRouter();
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);
  const [isRecipeDetailOpen, setIsRecipeDetailOpen] = useState(false);
  const [recipeForDetail, setRecipeForDetail] = useState<any>(null);
  const [prefetchRecipeId, setPrefetchRecipeId] = useState<string | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  // Prefetch individual recipe - warms cache before navigation to recipe page
  const _prefetchedRecipe = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    prefetchRecipeId ? { recipeId: prefetchRecipeId as Id<"userRecipes"> } : "skip"
  );

  // Fetch recipes for this cookbook
  const recipes = useQuery(
    api.recipes.userRecipes.getUserRecipesByCookbook,
    isOpen && userId ? { userId, cookbookCategory: cookbookId } : "skip"
  );

  // Batch prefetch ALL enriched recipes in this cookbook (server-side)
  // This warms the cache so individual recipe clicks are instant
  const _prefetchedRecipes = useQuery(
    api.recipes.userRecipes.prefetchCookbookRecipes,
    isOpen && userId ? { userId, cookbookCategory: cookbookId } : "skip"
  );

  // Mutations and actions
  const toggleFavorite = useMutation(api.recipes.userRecipes.toggleRecipeFavorite);
  const saveRecipe = useAction(api.recipes.userRecipes.saveRecipeWithParsedIngredients);
  const removeRecipe = useMutation(api.recipes.userRecipes.removeRecipeFromCookbook);

  const handleToggleFavorite = async (recipeId: string) => {
    if (!userId) return;

    try {
      await toggleFavorite({ userId, userRecipeId: recipeId as any });
    } catch (error) {
      console.error("Toggle favorite error:", error);
    }
  };

  const handleAddToCookbook = (recipe: any) => {
    setSelectedRecipe(recipe);
    setIsCookbookSelectionOpen(true);
  };

  const handleSelectCookbook = async (newCookbookId: string, newCookbookName: string) => {
    if (!userId || !selectedRecipe) return;

    try {
      // Save recipe to new cookbook (will update if it already exists)
      await saveRecipe({
        userId,
        recipeType: selectedRecipe.recipeType,
        cookbookCategory: newCookbookId,

        title: selectedRecipe.title,
        description: selectedRecipe.description,
        imageUrl: selectedRecipe.imageUrl,
        ingredients: selectedRecipe.ingredients || [],
        instructions: selectedRecipe.instructions || [],

        servings: selectedRecipe.servings,
        prep_time: selectedRecipe.prep_time,
        cook_time: selectedRecipe.cook_time,
        time_minutes: selectedRecipe.time_minutes,
        cuisine: selectedRecipe.cuisine,
        diet: selectedRecipe.diet,
        category: selectedRecipe.category,

        extractedRecipeId: selectedRecipe.extractedRecipeId,
        communityRecipeId: selectedRecipe.communityRecipeId,

        isFavorited: selectedRecipe.isFavorited,

        // Video fields
        muxPlaybackId: selectedRecipe.muxPlaybackId,
        muxAssetId: selectedRecipe.muxAssetId,
        instagramVideoUrl: selectedRecipe.instagramVideoUrl,
        instagramUsername: selectedRecipe.instagramUsername,
        videoSegments: selectedRecipe.videoSegments,
      });

      alert(`Recipe moved to ${newCookbookName}!`);
    } catch (error) {
      console.error("Move recipe error:", error);
      alert("Failed to move recipe");
    }
  };

  const handleShare = (recipe: any) => {
    navigator.clipboard.writeText(recipe.title);
    alert("Recipe name copied to clipboard!");
  };

  const handleEnterDeleteMode = useCallback(() => {
    setIsDeleteMode(true);
  }, []);

  const handleExitDeleteMode = useCallback(() => {
    setIsDeleteMode(false);
  }, []);

  const handleDeleteRecipe = useCallback(
    async (recipeId: string) => {
      if (!userId) return;
      try {
        await removeRecipe({
          userId,
          userRecipeId: recipeId as Id<"userRecipes">,
        });
      } catch (error) {
        console.error("Delete recipe error:", error);
        alert("Failed to delete recipe");
      }
    },
    [userId, removeRecipe]
  );

  const handleRecipeClick = (recipe: any) => {
    // Start prefetching immediately - cache will be warm when recipe page loads
    setPrefetchRecipeId(recipe._id);
    router.push(`/recipe/${recipe._id}`);
    onClose();
  };

  const emoji = COOKBOOK_EMOJIS[cookbookId] || "📚";
  const gradient = COOKBOOK_GRADIENTS[cookbookId] || "from-purple-400 to-indigo-500";

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => {
          if (!open) {
            setIsDeleteMode(false);
            onClose();
          }
        }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0" hideCloseButton>
          {/* Visually hidden title for accessibility */}
          <SheetTitle className="sr-only">{cookbookName} Cookbook</SheetTitle>
          {/* Header with gradient background */}
          <div className="relative">
            <div className={`h-32 bg-gradient-to-br ${gradient}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl opacity-30">{emoji}</span>
              </div>
            </div>

            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute top-4 left-4 bg-white/90 hover:bg-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            {/* Cookbook Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{emoji}</span>
                <h2 className="text-xl font-bold text-white">
                  {cookbookName}
                </h2>
              </div>
            </div>
          </div>

          {/* Recipe Count and Delete Mode Controls */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {isDeleteMode ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExitDeleteMode}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Done
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <BookOpen className="w-4 h-4" />
                <span>
                  {recipes === undefined
                    ? "Loading..."
                    : `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`}
                </span>
              </div>
            </div>
            {isDeleteMode && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Tap the X to remove a recipe. Tap Done when finished.
              </p>
            )}
          </div>

          {/* Recipe Grid */}
          <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {recipes === undefined ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Loading recipes...
              </div>
            ) : recipes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-6xl mb-4">{emoji}</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No recipes yet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                  Save recipes to this cookbook by clicking the + button on any recipe
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recipes.map((recipe: any) => (
                  <CompactRecipeCard
                    key={recipe._id}
                    recipe={recipe}
                    onClick={() => handleRecipeClick(recipe)}
                    isDeleteMode={isDeleteMode}
                    onDelete={handleDeleteRecipe}
                    onLongPress={handleEnterDeleteMode}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Recipe Detail Sheet */}
      {recipeForDetail && (
        <RecipeDetailSheet
          isOpen={isRecipeDetailOpen}
          onClose={() => setIsRecipeDetailOpen(false)}
          recipe={recipeForDetail}
          userId={userId}
          isFavorited={recipeForDetail.isFavorited}
        />
      )}

      {/* Cookbook Selection Sheet for moving recipes */}
      {selectedRecipe && (
        <CookbookSelectionSheet
          isOpen={isCookbookSelectionOpen}
          onClose={() => setIsCookbookSelectionOpen(false)}
          recipe={selectedRecipe}
          onSelectCookbook={handleSelectCookbook}
        />
      )}
    </>
  );
}
