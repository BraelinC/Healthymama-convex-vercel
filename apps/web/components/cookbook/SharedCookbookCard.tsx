"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, BookOpen } from "lucide-react";
import { Id } from "@healthymama/convex/dataModel";

interface Member {
  userId: string;
  role: string;
  name: string;
  email?: string;
}

interface SharedCookbook {
  _id: Id<"sharedCookbooks">;
  name: string;
  imageUrl?: string;
  recipeCount: number;
  memberCount: number;
  members?: Member[];
}

interface SharedCookbookCardProps {
  cookbook: SharedCookbook;
  onClick: () => void;
}

export function SharedCookbookCard({ cookbook, onClick }: SharedCookbookCardProps) {
  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group border-2 border-pink-100"
      onClick={onClick}
    >
      {/* Cover Image */}
      <div className="relative h-32 bg-gradient-to-br from-healthymama-pink to-pink-400">
        {cookbook.imageUrl ? (
          <img
            src={cookbook.imageUrl}
            alt={cookbook.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users className="w-12 h-12 text-white/60" />
          </div>
        )}

        {/* Shared badge */}
        <div className="absolute top-2 right-2 bg-white/90 text-healthymama-pink px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <Users className="w-3 h-3" />
          Shared
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{cookbook.name}</h3>

        {/* Members and Recipe Count */}
        <div className="flex items-center justify-between mt-2">
          {/* Member Avatars */}
          <div className="flex -space-x-2">
            {cookbook.members?.slice(0, 3).map((member) => (
              <Avatar
                key={member.userId}
                className="w-6 h-6 border-2 border-white"
              >
                <AvatarFallback className="bg-healthymama-pink text-white text-[10px]">
                  {member.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            ))}
            {cookbook.memberCount > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-600">
                +{cookbook.memberCount - 3}
              </div>
            )}
          </div>

          {/* Recipe Count */}
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <BookOpen className="w-4 h-4" />
            <span>{cookbook.recipeCount}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
