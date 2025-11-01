"use client";

import { Star, Users, ChefHat, DollarSign, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "./ImageWithFallback";

interface CommunityCardProps {
  name: string;
  image: string;
  rating: number;
  recipeCount: number;
  memberCount: number;
  nationalities: string[];
  creator: {
    name: string;
    avatar: string;
  };
  price: number;
  priceType: "month" | "year" | "free";
}

export function CommunityCard({
  name,
  image,
  rating,
  recipeCount,
  memberCount,
  nationalities,
  creator,
  price,
  priceType,
}: CommunityCardProps) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
      {/* Image Section */}
      <div className="relative h-48 w-full overflow-hidden">
        <ImageWithFallback
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* White Footer Section */}
      <div className="bg-white p-4 space-y-3">
        {/* Community Name */}
        <h3 className="text-gray-900 font-medium text-lg line-clamp-1">{name}</h3>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-gray-900">{rating.toFixed(1)}</span>
          </div>

          <div className="flex items-center gap-1">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <span className="text-gray-900">{recipeCount}</span>
          </div>

          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-gray-900">{memberCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Nationality Badges */}
        <div className="flex flex-wrap gap-1">
          {nationalities.map((nationality, index) => (
            <Badge
              key={index}
              className="text-xs bg-blue-600 text-white hover:bg-blue-700 border-none"
            >
              {nationality}
            </Badge>
          ))}
        </div>

        {/* Creator and Price Row */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center">
              <ChefHat className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm text-gray-700">{creator.name}</span>
          </div>

          <div className="flex items-center gap-1 text-red-500 font-medium">
            {price === 0 ? (
              <span className="text-sm">Free</span>
            ) : (
              <>
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">
                  {price}/{priceType === "month" ? "mo" : "yr"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
