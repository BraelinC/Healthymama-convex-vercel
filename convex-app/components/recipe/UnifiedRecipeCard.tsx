"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { Plus, Share2, Heart, Clock, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ShareRecipeSheet } from "@/components/shared/ShareRecipeSheet";
import { Id } from "@/convex/_generated/dataModel";
import MuxPlayer from "@mux/mux-player-react";

// Helper function to select priority tags (max 2: 1 meal type + 1 diet type)
function selectPriorityTags(
  recipe: {
    dietTags?: string[];
    enrichedMetadata?: {
      dietTags?: string[];
      mealTypes?: string[];
    };
  },
  activeFilter?: string
): { tag: string; type: "meal" | "diet" }[] {
  // Meal type keywords
  const mealKeywords = ["breakfast", "lunch", "dinner", "snack", "brunch"];

  // Collect all tags and categorize them
  const allDietTags = [
    ...(recipe.dietTags || []),
    ...(recipe.enrichedMetadata?.dietTags || []),
  ].filter((tag) => tag.toLowerCase() !== "gemini");

  const allMealTypes = (recipe.enrichedMetadata?.mealTypes || []).filter(
    (tag) => tag.toLowerCase() !== "gemini"
  );

  // Separate meal types from diet types in dietTags
  const mealTypesFromDietTags = allDietTags.filter((tag) =>
    mealKeywords.some((keyword) => tag.toLowerCase().includes(keyword))
  );

  const pureDietTags = allDietTags.filter(
    (tag) => !mealKeywords.some((keyword) => tag.toLowerCase().includes(keyword))
  );

  // Combine all meal types
  const allMealTypesSet = new Set([...allMealTypes, ...mealTypesFromDietTags]);
  const mealTypes = Array.from(allMealTypesSet);

  // Sort meal types: active filter first
  const sortedMealTypes = mealTypes.sort((a, b) => {
    if (!activeFilter) return 0;
    const aMatches = a.toLowerCase().includes(activeFilter.toLowerCase());
    const bMatches = b.toLowerCase().includes(activeFilter.toLowerCase());
    if (aMatches && !bMatches) return -1;
    if (!aMatches && bMatches) return 1;
    return 0;
  });

  // Sort diet types: active filter first
  const sortedDietTypes = pureDietTags.sort((a, b) => {
    if (!activeFilter) return 0;
    const aMatches = a.toLowerCase().includes(activeFilter.toLowerCase());
    const bMatches = b.toLowerCase().includes(activeFilter.toLowerCase());
    if (aMatches && !bMatches) return -1;
    if (!aMatches && bMatches) return 1;
    return 0;
  });

  // Select max 2 tags: 1 meal type + 1 diet type
  const selectedTags: { tag: string; type: "meal" | "diet" }[] = [];

  if (sortedMealTypes.length > 0) {
    selectedTags.push({ tag: sortedMealTypes[0], type: "meal" });
  }

  if (sortedDietTypes.length > 0) {
    selectedTags.push({ tag: sortedDietTypes[0], type: "diet" });
  }

  return selectedTags;
}

interface UnifiedRecipeCardProps {
  recipe: {
    id?: string;
    _id?: string;
    title?: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    ingredients: string[];
    instructions: string[];
    time_minutes?: number;
    prep_time?: string;
    cook_time?: string;
    servings?: string | number;
    category?: string;
    cuisine?: string;
    diet?: string;
    method?: string;
    dietTags?: string[];
    enrichedMetadata?: {
      dietTags?: string[];
      mealTypes?: string[];
      cuisine?: string;
    };
    nutrition_info?: {
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      fiber_g?: number;
      sugar_g?: number;
    };
    muxPlaybackId?: string;
  };
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onAddToCookbook?: () => void;
  onShare?: () => void;
  userId?: string; // For sharing functionality
  activeFilter?: string;
}

export function UnifiedRecipeCard({
  recipe,
  isFavorited = false,
  onToggleFavorite,
  onAddToCookbook,
  onShare,
  userId,
  activeFilter,
}: UnifiedRecipeCardProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [isShoppingLoading, setIsShoppingLoading] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const { toast } = useToast();

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const handleShopIngredients = async () => {
    setIsShoppingLoading(true);

    try {
      const response = await fetch("/api/instacart/create-recipe-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: recipe.name || recipe.title || "Recipe",
          ingredients: recipe.ingredients,
          imageUrl: recipe.imageUrl,
          servings: recipe.servings,
          instructions: recipe.instructions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create Instacart link");
      }

      const data = await response.json();

      if (data.instacartUrl) {
        console.log("[INSTACART] Received URL:", data.instacartUrl);

        // Open Instacart in new tab - use multiple approaches for reliability
        const newWindow = window.open(data.instacartUrl, "_blank", "noopener,noreferrer");

        if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
          // Popup was blocked - try alternative method
          console.warn("[INSTACART] Popup blocked, using anchor click method");
          const link = document.createElement("a");
          link.href = data.instacartUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        toast({
          title: "Opening Instacart",
          description: "Your shopping list is ready!",
        });
      } else {
        throw new Error("No Instacart URL returned");
      }
    } catch (error) {
      console.error("Error creating Instacart link:", error);
      toast({
        title: "Error",
        description: "Failed to create shopping link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsShoppingLoading(false);
    }
  };

  // Parse time to get total minutes
  const parseTime = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const hours = timeStr.match(/(\d+)\s*h/i);
    const mins = timeStr.match(/(\d+)\s*m/i);
    let total = 0;
    if (hours) total += parseInt(hours[1]) * 60;
    if (mins) total += parseInt(mins[1]);
    return total || null;
  };

  const prepMinutes = parseTime(recipe.prep_time);
  const cookMinutes = parseTime(recipe.cook_time);
  const totalMinutes = recipe.time_minutes || (prepMinutes || 0) + (cookMinutes || 0);

  // Get priority tags (max 2: 1 meal type + 1 diet type)
  const priorityTags = selectPriorityTags(recipe, activeFilter);

  return (
    <>
    <Card className="overflow-hidden shadow-lg max-w-2xl mx-auto bg-white">
      {/* Image/Video Section with Action Buttons Overlay */}
      <div className="relative">
        <div className="relative h-64 w-full bg-gray-200">
          {recipe.muxPlaybackId ? (
            <MuxPlayer
              playbackId={recipe.muxPlaybackId}
              className="w-full h-full object-cover"
              streamType="on-demand"
              muted={false}
              autoPlay={false}
            />
          ) : recipe.imageUrl ? (
            <ImageWithFallback
              src={recipe.imageUrl}
              alt={recipe.name || recipe.title || "Recipe"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-6xl">🍽️</span>
            </div>
          )}
        </div>

        {/* Time Badge Overlay */}
        {totalMinutes > 0 && (
          <Badge className="absolute bottom-4 right-4 bg-black/70 text-white border-none">
            <Clock className="w-3 h-3 mr-1" />
            {totalMinutes} min
          </Badge>
        )}

        {/* Action Buttons Overlay */}
        <div className="absolute top-4 right-4 flex gap-2">
          {/* Plus Button - Add to Cookbook */}
          {onAddToCookbook && (
            <Button
              size="icon"
              variant="secondary"
              className="w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md"
              onClick={onAddToCookbook}
            >
              <Plus className="w-5 h-5 text-orange-600" />
            </Button>
          )}

          {/* Share Button */}
          {(onShare || userId) && (
            <Button
              size="icon"
              variant="secondary"
              className="w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md"
              onClick={() => userId ? setIsShareSheetOpen(true) : onShare?.()}
            >
              <Share2 className="w-5 h-5 text-rose-600" />
            </Button>
          )}

          {/* Heart Button - Favorite */}
          {onToggleFavorite && (
            <Button
              size="icon"
              variant="secondary"
              className={`w-10 h-10 rounded-full shadow-md transition-all ${
                isFavorited
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-white/90 hover:bg-white"
              }`}
              onClick={onToggleFavorite}
            >
              <Heart
                className={`w-5 h-5 ${
                  isFavorited
                    ? "text-white fill-white"
                    : "text-gray-600"
                }`}
              />
            </Button>
          )}
        </div>
      </div>

      {/* Recipe Header */}
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{recipe.name || recipe.title}</h2>
        {recipe.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{recipe.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {recipe.method && recipe.method.toLowerCase() !== 'gemini' && (
            <Badge variant="secondary" className="bg-pink-100 text-pink-700">
              {recipe.method.replace('-', ' ')}
            </Badge>
          )}
          {recipe.category && recipe.category.toLowerCase() !== 'gemini' && (
            <Badge variant="secondary" className="bg-pink-100 text-pink-700">
              {recipe.category}
            </Badge>
          )}
          {recipe.cuisine && recipe.cuisine.toLowerCase() !== 'gemini' && (
            <Badge variant="secondary" className="bg-rose-100 text-rose-700">
              {recipe.cuisine}
            </Badge>
          )}
          {recipe.diet && recipe.diet.toLowerCase() !== 'gemini' && (
            <Badge variant="outline" className="border-gray-300 text-gray-600">
              {recipe.diet}
            </Badge>
          )}
          {recipe.prep_time && (
            <Badge variant="outline" className="border-gray-300 text-gray-600">
              Prep: {recipe.prep_time}
            </Badge>
          )}
          {recipe.cook_time && (
            <Badge variant="outline" className="border-gray-300 text-gray-600">
              Cook: {recipe.cook_time}
            </Badge>
          )}
          {recipe.servings && (
            <Badge variant="outline" className="border-gray-300 text-gray-600">
              Servings: {recipe.servings}
            </Badge>
          )}
          {/* Priority Tags (Max 2: 1 meal type + 1 diet type) */}
          {priorityTags.map((tagObj, idx) => (
            <Badge
              key={`priority-${idx}`}
              variant={tagObj.type === "meal" ? "outline" : "secondary"}
              className={
                tagObj.type === "meal"
                  ? "border-blue-300 text-blue-700"
                  : "bg-purple-100 text-purple-700"
              }
            >
              {tagObj.tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Tabs Section - Ingredients and Instructions */}
      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none bg-gray-50">
          <TabsTrigger
            value="ingredients"
            className="data-[state=active]:bg-white data-[state=active]:text-pink-600"
          >
            Ingredients
          </TabsTrigger>
          <TabsTrigger
            value="instructions"
            className="data-[state=active]:bg-white data-[state=active]:text-pink-600"
          >
            Instructions
          </TabsTrigger>
        </TabsList>

        {/* Ingredients Tab */}
        <TabsContent value="ingredients" className="p-6 space-y-4 max-h-[32rem] overflow-y-auto">
          <div className="space-y-3">
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              recipe.ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-start gap-3 group">
                  <Checkbox
                    id={`ingredient-${index}`}
                    checked={checkedIngredients.has(index)}
                    onCheckedChange={() => toggleIngredient(index)}
                    className="mt-1"
                  />
                  <label
                    htmlFor={`ingredient-${index}`}
                    className={`flex-1 cursor-pointer text-gray-700 ${
                      checkedIngredients.has(index) ? "line-through text-gray-400" : ""
                    }`}
                  >
                    {ingredient}
                  </label>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No ingredients available</p>
            )}
          </div>

          {/* Shop Ingredients Button */}
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleShopIngredients}
            disabled={isShoppingLoading}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isShoppingLoading ? "Creating Shopping List..." : "Shop Ingredients"}
          </Button>
        </TabsContent>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="p-6 space-y-4 max-h-[32rem] overflow-y-auto">
          {recipe.instructions && recipe.instructions.length > 0 ? (
            recipe.instructions.map((instruction, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <p className="flex-1 text-gray-700 pt-1">{instruction}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No instructions available</p>
          )}
        </TabsContent>

      </Tabs>
    </Card>

    {/* Share Recipe Sheet */}
    {userId && (recipe._id || recipe.id) && (
      <ShareRecipeSheet
        isOpen={isShareSheetOpen}
        onClose={() => setIsShareSheetOpen(false)}
        recipeId={(recipe._id || recipe.id) as Id<"userRecipes">}
        recipeTitle={recipe.title || recipe.name || "Recipe"}
        userId={userId}
      />
    )}
    </>
  );
}
