"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { CookbookCategoryCard, NewCookbookCard } from "./CookbookCategoryCard";
import { PlusButtonMenu } from "../shared/PlusButtonMenu";
import { CreateRecipe } from "../recipe/CreateRecipe";
import { FavoritesSheet } from "../recipe/FavoritesSheet";
import { CookbookSelectionSheet } from "./CookbookSelectionSheet";
import { CookbookDetailSheet } from "./CookbookDetailSheet";
import { MealPlanView } from "../meal-plan/MealPlanView";
import { InstagramImportModal } from "../instagram/InstagramImportModal";
import { Button } from "@/components/ui/button";
import { Plus, HandPlatter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CookbooksView() {
  const { userId } = useAuth();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<"cookbooks" | "meal-plan">("cookbooks");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateRecipeOpen, setIsCreateRecipeOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);
  const [isCookbookDetailOpen, setIsCookbookDetailOpen] = useState(false);
  const [isInstagramImportOpen, setIsInstagramImportOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [selectedCookbook, setSelectedCookbook] = useState<{ id: string; name: string } | null>(null);

  // Fetch real data from Convex
  const cookbookStats = useQuery(
    api.recipes.userRecipes.getCookbookStats,
    userId ? { userId } : "skip"
  );
  const favoriteRecipes = useQuery(
    api.recipes.userRecipes.getFavoritedRecipes,
    userId ? { userId } : "skip"
  );

  // Mutations
  const saveRecipe = useMutation(api.recipes.userRecipes.saveRecipeToUserCookbook);
  const toggleFavorite = useMutation(api.recipes.userRecipes.toggleRecipeFavorite);

  const handleCategoryClick = (categoryId: string) => {
    const category = cookbookStats?.find((c: any) => c.id === categoryId);
    if (category) {
      setSelectedCookbook({ id: categoryId, name: category.name });
      setIsCookbookDetailOpen(true);
    }
  };

  const handleNewCookbook = () => {
    console.log("Create new cookbook");
    // TODO: Open dialog to create new cookbook/category
  };

  const handleAddRecipe = () => {
    console.log("Add own recipe");
    setIsCreateRecipeOpen(true);
  };

  const handleViewFavorites = () => {
    console.log("View favorites");
    setIsFavoritesOpen(true);
  };

  const handleImportInstagram = () => {
    console.log("Import from Instagram");
    setIsInstagramImportOpen(true);
  };

  const handleToggleFavorite = async (recipeId: string) => {
    if (!userId) return;

    try {
      await toggleFavorite({ userId, userRecipeId: recipeId as any });
      toast({
        title: "Success",
        description: "Recipe favorite status updated",
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

  const handleAddToCookbook = (recipe: any) => {
    console.log("Add to cookbook:", recipe);
    setSelectedRecipe(recipe);
    setIsCookbookSelectionOpen(true);
  };

  const handleSelectCookbook = async (cookbookId: string, cookbookName: string) => {
    if (!userId || !selectedRecipe) return;

    try {
      await saveRecipe({
        userId,
        recipeType: selectedRecipe.recipeType || "community",
        cookbookCategory: cookbookId,

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

        extractedRecipeId: selectedRecipe._id || selectedRecipe.extractedRecipeId,
        communityRecipeId: selectedRecipe.id || selectedRecipe.communityRecipeId,

        isFavorited: false,
      });

      toast({
        title: "Saved!",
        description: `Recipe added to ${cookbookName}`,
      });
    } catch (error) {
      console.error("Save recipe error:", error);
      toast({
        title: "Error",
        description: "Failed to save recipe",
        variant: "destructive",
      });
    }
  };

  const handleShare = (recipe: any) => {
    // Copy recipe title to clipboard as basic share
    navigator.clipboard.writeText(recipe.title);
    toast({
      title: "Copied!",
      description: "Recipe name copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Cookbooks/Meal Plan Section */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setViewMode(viewMode === "cookbooks" ? "meal-plan" : "cookbooks")}
                className="hover:opacity-70 transition-opacity cursor-pointer"
              >
                <h1 className="text-3xl font-bold text-gray-900">
                  {viewMode === "cookbooks" ? "Cookbooks" : "Meal Plan"}
                </h1>
              </button>
            </div>

            {/* Conditional Content: Cookbooks Grid or Meal Plan View */}
            {viewMode === "cookbooks" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cookbookStats ? (
                  <>
                    {cookbookStats.map((category: any) => (
                      <CookbookCategoryCard
                        key={category.id}
                        name={category.name}
                        recipeCount={category.recipeCount}
                        recipeImages={category.recipeImages}
                        onClick={() => handleCategoryClick(category.id)}
                      />
                    ))}
                    {/* New Cookbook Card */}
                    <NewCookbookCard onClick={handleNewCookbook} />
                  </>
                ) : (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    Loading cookbooks...
                  </div>
                )}
              </div>
            ) : (
              <div>
                {userId ? (
                  <MealPlanView userId={userId} />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Please sign in to view your meal plan
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating Add Button (bottom right) - Positioned above bottom nav */}
      <Button
        variant={null}
        onClick={() => setIsMenuOpen(true)}
        className="fixed bottom-24 right-8 w-16 h-16 rounded-full shadow-lg bg-gradient-to-br from-[#dc2626] to-[#ec4899] hover:shadow-red-glow text-white z-40 transition-all inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        size="icon"
      >
        <Plus className="w-8 h-8" />
      </Button>

      {/* Plus Button Menu */}
      <PlusButtonMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onAddRecipe={handleAddRecipe}
        onViewFavorites={handleViewFavorites}
        onImportInstagram={handleImportInstagram}
      />

      {/* Create Recipe Modal */}
      <CreateRecipe
        isOpen={isCreateRecipeOpen}
        onClose={() => setIsCreateRecipeOpen(false)}
      />

      {/* Favorites Sheet */}
      {userId && (
        <FavoritesSheet
          isOpen={isFavoritesOpen}
          onClose={() => setIsFavoritesOpen(false)}
          favoriteRecipes={favoriteRecipes}
          userId={userId}
          onToggleFavorite={handleToggleFavorite}
          onAddToCookbook={handleAddToCookbook}
          onShare={handleShare}
        />
      )}

      {/* Cookbook Selection Sheet */}
      {selectedRecipe && (
        <CookbookSelectionSheet
          isOpen={isCookbookSelectionOpen}
          onClose={() => setIsCookbookSelectionOpen(false)}
          recipe={selectedRecipe}
          onSelectCookbook={handleSelectCookbook}
        />
      )}

      {/* Instagram Import Modal */}
      {userId && (
        <InstagramImportModal
          isOpen={isInstagramImportOpen}
          onClose={() => setIsInstagramImportOpen(false)}
          userId={userId}
        />
      )}

      {/* Cookbook Detail Sheet */}
      {selectedCookbook && userId && (
        <CookbookDetailSheet
          isOpen={isCookbookDetailOpen}
          onClose={() => setIsCookbookDetailOpen(false)}
          cookbookId={selectedCookbook.id}
          cookbookName={selectedCookbook.name}
          userId={userId}
        />
      )}
    </div>
  );
}
