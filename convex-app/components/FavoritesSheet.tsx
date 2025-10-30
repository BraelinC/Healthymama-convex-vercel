"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { CompactRecipeCard } from "./CompactRecipeCard";
import { RecipeDetailSheet } from "./RecipeDetailSheet";
import { Heart } from "lucide-react";
import { useState } from "react";

interface FavoritesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteRecipes?: any[]; // TODO: Type this properly
  userId: string;
  onToggleFavorite?: (recipeId: string) => void;
  onAddToCookbook?: (recipe: any) => void;
  onShare?: (recipe: any) => void;
}

export function FavoritesSheet({
  isOpen,
  onClose,
  favoriteRecipes = [],
  userId,
  onToggleFavorite,
  onAddToCookbook,
  onShare,
}: FavoritesSheetProps) {
  const [isRecipeDetailOpen, setIsRecipeDetailOpen] = useState(false);
  const [recipeForDetail, setRecipeForDetail] = useState<any>(null);

  const handleRecipeClick = (recipe: any) => {
    setRecipeForDetail(recipe);
    setIsRecipeDetailOpen(true);
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-600 dark:text-red-400 fill-red-600 dark:fill-red-400" />
            </div>
            <SheetTitle className="text-left text-2xl">
              Your Favorites
            </SheetTitle>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {favoriteRecipes.length} {favoriteRecipes.length === 1 ? 'recipe' : 'recipes'} saved
          </p>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="overflow-y-auto h-[calc(90vh-140px)] pb-6">
          {favoriteRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Heart className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No favorites yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                Start favoriting recipes by clicking the heart icon on any recipe card
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {favoriteRecipes.map((recipe) => (
                <CompactRecipeCard
                  key={recipe.id || recipe._id}
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
        isFavorited={true}
      />
    )}
    </>
  );
}
