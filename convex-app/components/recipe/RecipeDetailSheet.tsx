"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UnifiedRecipeCard } from "./UnifiedRecipeCard";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface RecipeDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: any;
  userId: string;
  isFavorited?: boolean;
}

export function RecipeDetailSheet({
  isOpen,
  onClose,
  recipe,
  userId,
  isFavorited = false,
}: RecipeDetailSheetProps) {
  const { toast } = useToast();
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);

  // Mutations
  const toggleFavorite = useMutation(api.userRecipes.toggleRecipeFavorite);
  const saveRecipe = useMutation(api.userRecipes.saveRecipeToUserCookbook);

  const handleToggleFavorite = async () => {
    if (!userId || !recipe._id) return;

    try {
      await toggleFavorite({ userId, userRecipeId: recipe._id as any });
      toast({
        title: "Success",
        description: isFavorited ? "Removed from favorites" : "Added to favorites",
      });
    } catch (error) {
      console.error("Toggle favorite error:", error);
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      });
    }
  };

  const handleAddToCookbook = () => {
    setIsCookbookSelectionOpen(true);
  };

  const handleSelectCookbook = async (cookbookId: string, cookbookName: string) => {
    if (!userId) return;

    try {
      await saveRecipe({
        userId,
        recipeType: recipe.recipeType || "community",
        cookbookCategory: cookbookId,

        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],

        servings: recipe.servings,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        time_minutes: recipe.time_minutes,
        cuisine: recipe.cuisine,
        diet: recipe.diet,
        category: recipe.category,

        extractedRecipeId: recipe.extractedRecipeId,
        communityRecipeId: recipe.communityRecipeId,

        isFavorited: recipe.isFavorited || false,
      });

      toast({
        title: "Saved!",
        description: `Recipe added to ${cookbookName}`,
      });
      setIsCookbookSelectionOpen(false);
    } catch (error) {
      console.error("Save recipe error:", error);
      toast({
        title: "Error",
        description: "Failed to save recipe",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(recipe.title);
    toast({
      title: "Copied!",
      description: "Recipe name copied to clipboard",
    });
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left text-2xl">Recipe Details</SheetTitle>
          </SheetHeader>

          {/* Scrollable Content */}
          <div className="overflow-y-auto h-[calc(90vh-100px)] pb-6">
            <UnifiedRecipeCard
              recipe={recipe}
              isFavorited={isFavorited}
              onToggleFavorite={handleToggleFavorite}
              onAddToCookbook={handleAddToCookbook}
              onShare={handleShare}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Cookbook Selection Sheet */}
      <CookbookSelectionSheet
        isOpen={isCookbookSelectionOpen}
        onClose={() => setIsCookbookSelectionOpen(false)}
        recipe={recipe}
        onSelectCookbook={handleSelectCookbook}
      />
    </>
  );
}
