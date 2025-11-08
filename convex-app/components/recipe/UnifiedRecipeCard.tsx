"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { Plus, Share2, Heart, Clock, ShoppingCart } from "lucide-react";

interface UnifiedRecipeCardProps {
  recipe: {
    id?: string;
    _id?: string;
    title: string;
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
    nutrition_info?: {
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      fiber_g?: number;
      sugar_g?: number;
    };
  };
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onAddToCookbook?: () => void;
  onShare?: () => void;
}

export function UnifiedRecipeCard({
  recipe,
  isFavorited = false,
  onToggleFavorite,
  onAddToCookbook,
  onShare,
}: UnifiedRecipeCardProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const handleShopIngredients = () => {
    // TODO: Implement Instacart integration
    console.log("Shop ingredients");
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

  return (
    <Card className="overflow-hidden shadow-lg max-w-2xl mx-auto bg-white">
      {/* Image Section with Action Buttons Overlay */}
      <div className="relative">
        <div className="relative h-64 w-full bg-gray-200">
          {recipe.imageUrl ? (
            <ImageWithFallback
              src={recipe.imageUrl}
              alt={recipe.title}
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
          {onShare && (
            <Button
              size="icon"
              variant="secondary"
              className="w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md"
              onClick={onShare}
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{recipe.title}</h2>
        {recipe.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{recipe.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {recipe.method && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              {recipe.method.replace('-', ' ')}
            </Badge>
          )}
          {recipe.category && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              {recipe.category}
            </Badge>
          )}
          {recipe.cuisine && (
            <Badge variant="secondary" className="bg-rose-100 text-rose-700">
              {recipe.cuisine}
            </Badge>
          )}
          {recipe.diet && (
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
        </div>
      </div>

      {/* Tabs Section - Ingredients, Instructions, and Nutrition */}
      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="w-full grid grid-cols-3 rounded-none bg-gray-50">
          <TabsTrigger
            value="ingredients"
            className="data-[state=active]:bg-white data-[state=active]:text-purple-600"
          >
            Ingredients
          </TabsTrigger>
          <TabsTrigger
            value="instructions"
            className="data-[state=active]:bg-white data-[state=active]:text-purple-600"
          >
            Instructions
          </TabsTrigger>
          <TabsTrigger
            value="nutrition"
            className="data-[state=active]:bg-white data-[state=active]:text-purple-600"
          >
            Nutrition
          </TabsTrigger>
        </TabsList>

        {/* Ingredients Tab */}
        <TabsContent value="ingredients" className="p-6 space-y-4">
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
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Shop Ingredients
          </Button>
        </TabsContent>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="p-6 space-y-4">
          {recipe.instructions && recipe.instructions.length > 0 ? (
            recipe.instructions.map((instruction, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <p className="flex-1 text-gray-700 pt-1">{instruction}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No instructions available</p>
          )}
        </TabsContent>

        {/* Nutrition Tab */}
        <TabsContent value="nutrition" className="p-6">
          {recipe.nutrition_info && (
            recipe.nutrition_info.calories ||
            recipe.nutrition_info.protein_g ||
            recipe.nutrition_info.carbs_g ||
            recipe.nutrition_info.fat_g
          ) ? (
            <div className="grid grid-cols-2 gap-4">
              {recipe.nutrition_info.calories !== undefined && (
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {recipe.nutrition_info.calories}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Calories</p>
                </div>
              )}
              {recipe.nutrition_info.protein_g !== undefined && (
                <div className="bg-rose-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-rose-600">
                    {recipe.nutrition_info.protein_g}g
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Protein</p>
                </div>
              )}
              {recipe.nutrition_info.carbs_g !== undefined && (
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {recipe.nutrition_info.carbs_g}g
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Carbs</p>
                </div>
              )}
              {recipe.nutrition_info.fat_g !== undefined && (
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {recipe.nutrition_info.fat_g}g
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Fat</p>
                </div>
              )}
              {recipe.nutrition_info.fiber_g !== undefined && (
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {recipe.nutrition_info.fiber_g}g
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Fiber</p>
                </div>
              )}
              {recipe.nutrition_info.sugar_g !== undefined && (
                <div className="bg-pink-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-pink-600">
                    {recipe.nutrition_info.sugar_g}g
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Sugar</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Nutrition information not available</p>
              <p className="text-xs mt-2 text-gray-500">
                Nutrition data will be calculated from ingredients
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
