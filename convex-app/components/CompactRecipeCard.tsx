"use client";

import { Card } from "./ui/card";
import { ImageWithFallback } from "./ImageWithFallback";

interface CompactRecipeCardProps {
  recipe: {
    _id: string;
    title: string;
    image_url?: string;
  };
  onClick: () => void;
}

export function CompactRecipeCard({ recipe, onClick }: CompactRecipeCardProps) {
  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
      onClick={onClick}
    >
      {/* Recipe Image */}
      <div className="relative h-40 w-full bg-gray-200 dark:bg-gray-800">
        {recipe.image_url ? (
          <ImageWithFallback
            src={recipe.image_url}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-5xl">🍽️</span>
          </div>
        )}

        {/* Overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Recipe Title */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-semibold text-sm line-clamp-2 drop-shadow-lg">
            {recipe.title}
          </h3>
        </div>
      </div>
    </Card>
  );
}
