"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@healthymama/convex";
import { Id } from "@healthymama/convex/dataModel";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SharedRecipeCard } from "./SharedRecipeCard";
import { ArrowLeft, Users, BookOpen } from "lucide-react";

interface SharedCookbookDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cookbookId: Id<"sharedCookbooks"> | null;
}

export function SharedCookbookDetailSheet({
  isOpen,
  onClose,
  cookbookId,
}: SharedCookbookDetailSheetProps) {
  const router = useRouter();
  const { user } = useUser();

  // Get cookbook details
  const cookbook = useQuery(
    api.sharedCookbooks.getSharedCookbook,
    cookbookId && user?.id ? { cookbookId, userId: user.id } : "skip"
  );

  // Get recipes in the cookbook
  const recipes = useQuery(
    api.sharedCookbooks.getSharedCookbookRecipes,
    cookbookId && user?.id ? { cookbookId, userId: user.id } : "skip"
  );

  const handleRecipeClick = (recipeId: Id<"userRecipes">) => {
    router.push(`/recipe/${recipeId}`);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        {/* Header with cookbook info */}
        <div className="relative">
          {/* Cover Image or Gradient */}
          <div className="h-32 bg-gradient-to-br from-healthymama-pink to-pink-400">
            {cookbook?.imageUrl && (
              <img
                src={cookbook.imageUrl}
                alt={cookbook.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 left-4 bg-white/90 hover:bg-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Cookbook Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-white" />
              <h2 className="text-xl font-bold text-white">
                {cookbook?.name || "Shared Cookbook"}
              </h2>
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Shared with:</span>
              <div className="flex -space-x-2">
                {cookbook?.members?.map((member) => (
                  <Avatar
                    key={member.userId}
                    className="w-8 h-8 border-2 border-white"
                  >
                    <AvatarFallback className="bg-healthymama-pink text-white text-xs">
                      {member.name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <BookOpen className="w-4 h-4" />
              <span>{recipes?.length || 0} recipes</span>
            </div>
          </div>
        </div>

        {/* Recipe Grid */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {recipes && recipes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {recipes.map((item) => (
                <SharedRecipeCard
                  key={item._id}
                  recipe={{
                    _id: item.recipeId,
                    title: item.recipeTitle,
                    imageUrl: item.recipeImageUrl,
                  }}
                  contributor={item.contributor}
                  currentUserId={user?.id}
                  onClick={() => handleRecipeClick(item.recipeId)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No recipes yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Add recipes from your cookbooks to share them here
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
