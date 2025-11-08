"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageWithFallback } from "../shared/ImageWithFallback";
import { Plus, Share2, Heart, Clock, ShoppingCart } from "lucide-react";

interface UniversalRecipeCardProps {
  recipe: {
    id?: string;
    title: string;
    description?: string;
    imageUrl?: string;
    ingredients: string[];
    instructions: string[];
    time_minutes?: number;
    category?: string;
    cuisine?: string;
  };
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onAddToCookbook?: () => void;
  onShare?: () => void;
}

export function UniversalRecipeCard({
  recipe,
  isFavorited = false,
  onToggleFavorite,
  onAddToCookbook,
  onShare,
}: UniversalRecipeCardProps) {
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
        {recipe.time_minutes && (
          <Badge className="absolute top-4 left-4 bg-black/70 text-white border-none">
            <Clock className="w-3 h-3 mr-1" />
            {recipe.time_minutes} min
          </Badge>
        )}

        {/* Action Buttons Overlay */}
        <div className="absolute top-4 right-4 flex gap-2">
          {/* Plus Button - Add to Cookbook */}
          <Button
            size="icon"
            variant="secondary"
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md"
            onClick={onAddToCookbook}
          >
            <Plus className="w-5 h-5 text-orange-600" />
          </Button>

          {/* Share Button */}
          <Button
            size="icon"
            variant="secondary"
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md"
            onClick={onShare}
          >
            <Share2 className="w-5 h-5 text-rose-600" />
          </Button>

          {/* Heart Button - Favorite */}
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
        </div>
      </div>

      {/* Recipe Header */}
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{recipe.title}</h2>
        {recipe.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{recipe.description}</p>
        )}
        <div className="flex gap-2 mt-3">
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
        </div>
      </div>

      {/* Tabs Section - Ingredients and Instructions */}
      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none bg-gray-50">
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
        </TabsList>

        {/* Ingredients Tab */}
        <TabsContent value="ingredients" className="p-6 space-y-4">
          <div className="space-y-3">
            {recipe.ingredients.map((ingredient, index) => (
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
            ))}
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
          {recipe.instructions.map((instruction, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold">
                {index + 1}
              </div>
              <p className="flex-1 text-gray-700 pt-1">{instruction}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
