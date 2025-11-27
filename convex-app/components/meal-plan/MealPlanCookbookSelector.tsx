"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CompactRecipeCard } from "../recipe/CompactRecipeCard";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MealPlanCookbookSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  dayNumber: number;
  mealType: string;
  onRecipeSelected: (recipeId: string) => void;
}

const COOKBOOK_EMOJIS: Record<string, string> = {
  favorites: "❤️",
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
  dessert: "🍰",
  snacks: "🍿",
};

export function MealPlanCookbookSelector({
  isOpen,
  onClose,
  userId,
  dayNumber,
  mealType,
  onRecipeSelected,
}: MealPlanCookbookSelectorProps) {
  const [selectedCookbook, setSelectedCookbook] = useState<string | null>(null);

  // Fetch cookbook stats (categories)
  const cookbookStats = useQuery(
    api.recipes.userRecipes.getCookbookStats,
    userId ? { userId } : "skip"
  );

  // Fetch recipes for selected cookbook
  const recipes = useQuery(
    api.recipes.userRecipes.getUserRecipesByCookbook,
    selectedCookbook && userId
      ? { userId, cookbookCategory: selectedCookbook }
      : "skip"
  );

  const handleBack = () => {
    setSelectedCookbook(null);
  };

  const handleCookbookClick = (cookbookId: string) => {
    setSelectedCookbook(cookbookId);
  };

  const handleRecipeClick = (recipeId: string) => {
    onRecipeSelected(recipeId);
    // Reset state
    setSelectedCookbook(null);
  };

  const handleSheetClose = () => {
    setSelectedCookbook(null);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleSheetClose()}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl">
        <SheetHeader className="mb-6">
          {selectedCookbook ? (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <SheetTitle className="text-left text-2xl">
                  Select Recipe
                </SheetTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Day {dayNumber} - {mealType}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <SheetTitle className="text-left text-2xl">
                Choose Cookbook
              </SheetTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Day {dayNumber} - {mealType}
              </p>
            </div>
          )}
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="overflow-y-auto h-[calc(90vh-140px)] pb-6">
          {!selectedCookbook ? (
            /* Step 1: Show Cookbook Categories */
            <div className="space-y-3">
              {cookbookStats ? (
                cookbookStats.map((category: any) => (
                  <button
                    key={category.id}
                    onClick={() => handleCookbookClick(category.id)}
                    className="w-full p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-2xl">
                        {COOKBOOK_EMOJIS[category.id] || "📚"}
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {category.recipeCount} recipe{category.recipeCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Loading cookbooks...
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Show Recipes in Selected Cookbook */
            <div>
              {recipes === undefined ? (
                <div className="text-center py-8 text-gray-500">
                  Loading recipes...
                </div>
              ) : recipes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="text-6xl mb-4">
                    {COOKBOOK_EMOJIS[selectedCookbook] || "📚"}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    No recipes in this cookbook
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                    Add recipes to this cookbook first
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {recipes.map((recipe: any) => (
                    <CompactRecipeCard
                      key={recipe._id}
                      recipe={recipe}
                      onClick={() => handleRecipeClick(recipe._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
