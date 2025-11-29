"use client";

import { Card } from "@/components/ui/card";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { X } from "lucide-react";
import { useRef, useCallback } from "react";

interface CompactRecipeCardProps {
  recipe: {
    _id: string;
    title: string;
    imageUrl?: string;
  };
  onClick: () => void;
  isDeleteMode?: boolean;
  onDelete?: (recipeId: string) => void;
  onLongPress?: () => void;
}

export function CompactRecipeCard({
  recipe,
  onClick,
  isDeleteMode = false,
  onDelete,
  onLongPress,
}: CompactRecipeCardProps) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handleTouchStart = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress?.();
    }, 500); // 500ms for long press
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If we're in delete mode and clicking the X, delete the recipe
      if (isDeleteMode) {
        // Don't navigate in delete mode - just exit delete mode on card click
        return;
      }
      // Prevent navigation if this was a long press
      if (isLongPress.current) {
        e.preventDefault();
        return;
      }
      onClick();
    },
    [isDeleteMode, onClick]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(recipe._id);
    },
    [onDelete, recipe._id]
  );

  return (
    <Card
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group relative ${
        isDeleteMode ? "shake-animation" : ""
      }`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      {/* Delete button - Red X in top right corner */}
      {isDeleteMode && (
        <button
          onClick={handleDelete}
          className="absolute top-1 right-1 z-20 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      )}

      {/* Recipe Image */}
      <div className="relative h-40 w-full bg-gray-200 dark:bg-gray-800">
        {recipe.imageUrl ? (
          <ImageWithFallback
            src={recipe.imageUrl}
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
