"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface ExtractedRecipe {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ingredients: string[];
  instructions: string[];
  prep_time?: string;
  cook_time?: string;
  servings?: string;
  category?: string;
  method: string;
  url: string;
}

interface ExtractedRecipeDisplayProps {
  recipe: ExtractedRecipe;
}

const ExtractedRecipeDisplay = ({ recipe }: ExtractedRecipeDisplayProps) => {
  const [imgError, setImgError] = useState(false);

  // Generate a fallback image based on recipe title
  const getFallbackImage = () => {
    const foodImages = [
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
    ];
    const hash = (recipe.title || '').split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    return foodImages[Math.abs(hash) % foodImages.length];
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
  const totalMinutes = (prepMinutes || 0) + (cookMinutes || 0);

  return (
    <div className="w-full bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      {/* Recipe Image Section */}
      <div className="relative w-full">
        <img
          src={imgError ? getFallbackImage() : (recipe.imageUrl || getFallbackImage())}
          alt={recipe.title}
          className="w-full h-64 object-cover"
          onError={() => setImgError(true)}
        />

        {/* Total time badge */}
        {totalMinutes > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {totalMinutes} min
          </div>
        )}
      </div>

      {/* Recipe Header */}
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-lg font-bold text-white mb-2">{recipe.title}</h2>

        {/* Recipe tags */}
        <div className="flex flex-wrap gap-2 mb-2">
          {/* Method badge */}
          <Badge className="bg-purple-600 text-xs">
            {recipe.method.replace('-', ' ')}
          </Badge>

          {/* Category badge */}
          {recipe.category && (
            <Badge variant="outline" className="text-gray-300 border-gray-600 text-xs">
              {recipe.category}
            </Badge>
          )}

          {/* Prep time */}
          {recipe.prep_time && (
            <Badge variant="outline" className="text-gray-300 border-gray-600 text-xs">
              Prep: {recipe.prep_time}
            </Badge>
          )}

          {/* Cook time */}
          {recipe.cook_time && (
            <Badge variant="outline" className="text-gray-300 border-gray-600 text-xs">
              Cook: {recipe.cook_time}
            </Badge>
          )}

          {/* Servings */}
          {recipe.servings && (
            <Badge variant="outline" className="text-gray-300 border-gray-600 text-xs">
              Servings: {recipe.servings}
            </Badge>
          )}
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-gray-300 text-sm mt-2 line-clamp-2">{recipe.description}</p>
        )}
      </div>

      {/* Tabs for Ingredients, Instructions, and Nutrition */}
      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-9 bg-gray-700 rounded-none">
          <TabsTrigger value="ingredients" className="text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white">
            Ingredients
          </TabsTrigger>
          <TabsTrigger value="instructions" className="text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white">
            Instructions
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white">
            Nutrition
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients" className="p-4 pt-3">
          <ul className="space-y-2">
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              recipe.ingredients.map((ingredient, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-200">
                  <span className="text-purple-400 mt-1">•</span>
                  <span>{ingredient}</span>
                </li>
              ))
            ) : (
              <li className="text-gray-500 text-sm">No ingredients available</li>
            )}
          </ul>
        </TabsContent>

        <TabsContent value="instructions" className="p-4 pt-3">
          <ol className="space-y-3">
            {recipe.instructions && recipe.instructions.length > 0 ? (
              recipe.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-2 text-sm text-gray-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  <span className="text-gray-200">{instruction}</span>
                </li>
              ))
            ) : (
              <li className="text-gray-400 text-sm">No instructions available</li>
            )}
          </ol>
        </TabsContent>

        <TabsContent value="nutrition" className="p-4 pt-3">
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Nutrition information not available</p>
            <p className="text-xs mt-2 text-gray-500">
              Future versions will calculate nutrition from ingredients
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Source URL */}
      <div className="px-4 pb-4">
        <a
          href={recipe.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 underline break-all"
        >
          View original recipe
        </a>
      </div>
    </div>
  );
};

export default ExtractedRecipeDisplay;
