"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";

interface Contributor {
  userId: string;
  name: string;
  email?: string;
}

interface SharedRecipeCardProps {
  recipe: {
    _id: string;
    title: string;
    imageUrl?: string;
  };
  contributor?: Contributor;
  currentUserId?: string;
  onClick: () => void;
}

export function SharedRecipeCard({
  recipe,
  contributor,
  currentUserId,
  onClick,
}: SharedRecipeCardProps) {
  // Only show contributor avatar if it's not the current user
  const showContributorAvatar = contributor && contributor.userId !== currentUserId;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
      onClick={onClick}
    >
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

        {/* Contributor Avatar - Bottom Left */}
        {showContributorAvatar && (
          <div className="absolute bottom-12 left-2">
            <div className="relative group/avatar">
              <Avatar className="w-8 h-8 border-2 border-white shadow-lg">
                <AvatarFallback className="bg-healthymama-pink text-white text-xs font-semibold">
                  {contributor.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              {/* Tooltip on hover */}
              <div className="absolute left-0 bottom-full mb-1 opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  Added by {contributor.name}
                </div>
              </div>
            </div>
          </div>
        )}

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
