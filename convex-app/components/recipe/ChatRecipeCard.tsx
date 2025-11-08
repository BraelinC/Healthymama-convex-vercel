"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface ChatRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  dietTags: string[];
  imageUrl?: string;
  sourceUrl?: string;
  similarity?: number;
}

interface ChatRecipeCardProps {
  recipe: ChatRecipe;
  onClick?: (recipe: ChatRecipe) => void;
  isSelected?: boolean;
}

const ChatRecipeCard = ({ recipe, onClick, isSelected }: ChatRecipeCardProps) => {
  const handleClick = () => {
    if (onClick) {
      onClick(recipe);
    }
  };

  return (
    <div
      className={`w-full bg-gray-800 rounded-lg overflow-hidden transition-all cursor-pointer hover:shadow-lg ${
        isSelected
          ? 'border-2 border-purple-500 shadow-purple-500/50 shadow-lg'
          : 'border border-gray-700 hover:border-purple-400'
      }`}
      onClick={handleClick}
    >
      {/* Recipe Image Section - Only show if image URL exists */}
      {recipe.imageUrl && (
        <div className="relative w-full">
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {/* Recipe Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="text-base font-bold text-white flex-1">{recipe.name}</h2>
          {isSelected && (
            <Badge className="bg-purple-600 text-xs flex-shrink-0">
              ✓ Selected
            </Badge>
          )}
        </div>

        {/* Recipe tags */}
        <div className="flex flex-wrap gap-2 mb-2">
          {/* Diet tags */}
          {recipe.dietTags && recipe.dietTags.length > 0 && recipe.dietTags.map((tag, idx) => (
            <Badge key={idx} className="bg-purple-600 text-xs">
              {tag}
            </Badge>
          ))}

          {/* Similarity score if available */}
          {recipe.similarity !== undefined && (
            <Badge variant="outline" className="text-gray-300 border-gray-600 text-xs">
              {Math.round(recipe.similarity * 100)}% match
            </Badge>
          )}
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-gray-300 text-sm mt-2 line-clamp-2">{recipe.description}</p>
        )}
      </div>

      {/* Tabs for Ingredients and Instructions */}
      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-9 bg-gray-700 rounded-none">
          <TabsTrigger value="ingredients" className="text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white">
            Ingredients
          </TabsTrigger>
          <TabsTrigger value="instructions" className="text-xs text-gray-300 data-[state=active]:bg-gray-600 data-[state=active]:text-white">
            Instructions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients" className="p-4 pt-3 max-h-48 overflow-y-auto">
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

        <TabsContent value="instructions" className="p-4 pt-3 max-h-48 overflow-y-auto">
          <ol className="space-y-3">
            {recipe.steps && recipe.steps.length > 0 ? (
              recipe.steps.map((instruction, index) => (
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
      </Tabs>

      {/* Source URL */}
      {recipe.sourceUrl && (
        <div className="px-4 pb-4">
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-rose-400 hover:text-rose-300 underline break-all"
          >
            View original recipe
          </a>
        </div>
      )}
    </div>
  );
};

export default ChatRecipeCard;
