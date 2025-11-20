"use client";

import { ImageWithFallback } from "../shared/ImageWithFallback";
import { getPlaceholderImage } from "@/lib/placeholder-images";
import * as Icons from "lucide-react";

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
  // Get smart placeholder based on category name
  const placeholder = getPlaceholderImage(name);

  // Get the icon component dynamically
  const IconComponent = (Icons as any)[placeholder.icon] || Icons.ChefHat;

  // If empty (0 recipes), show single large icon
  if (recipeCount === 0) {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-lg shadow-sm hover:shadow-md hover:shadow-red-hover transition-all cursor-pointer overflow-hidden group"
      >
        {/* Single Large Icon Display */}
        <div className={`relative aspect-square overflow-hidden flex items-center justify-center ${placeholder.bgColor}`}>
          <IconComponent
            className={`w-32 h-32 ${placeholder.iconColor} group-hover:scale-110 transition-transform duration-300`}
            strokeWidth={1.5}
          />
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

  // Ensure we have exactly 4 slots (fill with placeholders if needed)
  const gridImages = [...recipeImages.slice(0, 4)];
  while (gridImages.length < 4) {
    gridImages.push(""); // Empty placeholder
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm hover:shadow-md hover:shadow-red-hover transition-all cursor-pointer overflow-hidden group"
    >
      {/* 2x2 Image Grid Preview */}
      <div className="grid grid-cols-2 gap-0 aspect-square">
        {gridImages.map((image, index) => (
          <div key={index} className="relative bg-gray-100 aspect-square overflow-hidden">
            {image ? (
              <ImageWithFallback
                src={image}
                alt={`${name} recipe ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className={`w-full h-full ${placeholder.bgColor}`}>
              </div>
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
      className="bg-white rounded-lg shadow-sm hover:shadow-md hover:shadow-red-hover transition-all cursor-pointer overflow-hidden border-2 border-dashed border-healthymama-red flex flex-col items-center justify-center aspect-square p-6 group"
    >
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <span className="text-4xl bg-gradient-to-br from-healthymama-red to-healthymama-pink bg-clip-text text-transparent font-bold">+</span>
      </div>
      <h3 className="font-semibold text-gray-900 text-lg">New cookbook</h3>
    </div>
  );
}
