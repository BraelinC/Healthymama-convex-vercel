"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CompactRecipeCard } from "../recipe/CompactRecipeCard";
import { RecipeDetailSheet } from "../recipe/RecipeDetailSheet";
import { CookbookSelectionSheet } from "./CookbookSelectionSheet";
import { useState } from "react";

interface CookbookDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cookbookId: string;
  cookbookName: string;
  userId: string;
}

const COOKBOOK_EMOJIS: Record<string, string> = {
  uncategorized: "📦",
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
  dessert: "🍰",
  snacks: "🍿",
};

export function CookbookDetailSheet({
  isOpen,
  onClose,
  cookbookId,
  cookbookName,
  userId,
}: CookbookDetailSheetProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);
  const [isRecipeDetailOpen, setIsRecipeDetailOpen] = useState(false);
  const [recipeForDetail, setRecipeForDetail] = useState<any>(null);

  // Fetch recipes for this cookbook
  const recipes = useQuery(
    api.userRecipes.getUserRecipesByCookbook,
    isOpen && userId ? { userId, cookbookCategory: cookbookId } : "skip"
  );

  // Mutations
  const toggleFavorite = useMutation(api.userRecipes.toggleRecipeFavorite);
  const saveRecipe = useMutation(api.userRecipes.saveRecipeToUserCookbook);

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

  const handleRecipeClick = (recipe: any) => {
    setRecipeForDetail(recipe);
    setIsRecipeDetailOpen(true);
  };

  const emoji = COOKBOOK_EMOJIS[cookbookId] || "📚";

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl">
          <SheetHeader className="mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-2xl">
                {emoji}
              </div>
              <div className="flex-1">
                <SheetTitle className="text-left text-2xl">
                  {cookbookName}
                </SheetTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {recipes === undefined
                    ? "Loading..."
                    : `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`}
                </p>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable Content */}
          <div className="overflow-y-auto h-[calc(90vh-140px)] pb-6">
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {recipes.map((recipe: any) => (
                  <CompactRecipeCard
                    key={recipe._id}
                    recipe={recipe}
                    onClick={() => handleRecipeClick(recipe)}
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
