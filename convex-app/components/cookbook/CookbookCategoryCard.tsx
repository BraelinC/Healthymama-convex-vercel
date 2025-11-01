"use client";

import { ImageWithFallback } from "../shared/ImageWithFallback";

interface CookbookCategoryCardProps {
  name: string;
  recipeCount: number;
  recipeImages: string[]; // Array of up to 4 recipe images for the preview grid
  onClick?: () => void;
}

export function CookbookCategoryCard({
  name,
  recipeCount,
  recipeImages,
  onClick,
}: CookbookCategoryCardProps) {
  // Ensure we have exactly 4 slots (fill with placeholders if needed)
  const gridImages = [...recipeImages.slice(0, 4)];
  while (gridImages.length < 4) {
    gridImages.push(""); // Empty placeholder
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
    >
      {/* 2x2 Image Grid Preview */}
      <div className="grid grid-cols-2 gap-0 aspect-square">
        {gridImages.map((image, index) => (
          <div key={index} className="relative bg-gray-100 aspect-square">
            {image ? (
              <ImageWithFallback
                src={image}
                alt={`${name} recipe ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200" />
            )}
          </div>
        ))}
      </div>

      {/* Category Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-lg mb-1">{name}</h3>
        <p className="text-sm text-gray-500">
          {recipeCount} {recipeCount === 1 ? "recipe" : "recipes"}
        </p>
      </div>
    </div>
  );
}

// New Cookbook Card Component
interface NewCookbookCardProps {
  onClick?: () => void;
}

export function NewCookbookCard({ onClick }: NewCookbookCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border-2 border-dashed border-orange-400 flex flex-col items-center justify-center aspect-square p-6"
    >
      <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center mb-4">
        <span className="text-4xl text-orange-500">+</span>
      </div>
      <h3 className="font-semibold text-gray-900 text-lg">New cookbook</h3>
    </div>
  );
}
