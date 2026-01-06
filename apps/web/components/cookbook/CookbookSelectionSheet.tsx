"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { Id } from "@healthymama/convex/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "../shared/ImageWithFallback";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ChevronRight, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CookbookSelectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: {
    id?: Id<"userRecipes">;
    title: string;
    imageUrl?: string;
  };
  onSelectCookbook: (cookbookId: string, cookbookName: string) => void;
  onSelectSharedCookbook?: (cookbookId: Id<"sharedCookbooks">, cookbookName: string) => void;
}

const COOKBOOKS = [
  { id: "favorites", name: "Favorites", emoji: "❤️" },
  { id: "breakfast", name: "Breakfast", emoji: "🍳" },
  { id: "lunch", name: "Lunch", emoji: "🥗" },
  { id: "dinner", name: "Dinner", emoji: "🍽️" },
  { id: "dessert", name: "Dessert", emoji: "🍰" },
  { id: "snacks", name: "Snacks", emoji: "🍿" },
];

export function CookbookSelectionSheet({
  isOpen,
  onClose,
  recipe,
  onSelectCookbook,
  onSelectSharedCookbook,
}: CookbookSelectionSheetProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  // Query shared cookbooks
  const sharedCookbooks = useQuery(
    api.sharedCookbooks.getSharedCookbooks,
    user?.id ? { userId: user.id } : "skip"
  );

  // Mutation to add recipe to shared cookbook
  const addToSharedCookbook = useMutation(api.sharedCookbooks.addRecipeToSharedCookbook);

  const handleSelectCookbook = (cookbookId: string, cookbookName: string) => {
    onSelectCookbook(cookbookId, cookbookName);
    onClose();
  };

  const handleSelectSharedCookbook = async (
    cookbookId: Id<"sharedCookbooks">,
    cookbookName: string
  ) => {
    // If recipe already has an ID, add directly to shared cookbook
    if (recipe.id && user?.id) {
      setIsAdding(cookbookId);
      try {
        await addToSharedCookbook({
          cookbookId,
          recipeId: recipe.id,
          userId: user.id,
        });

        toast({
          title: "Added to shared cookbook!",
          description: `Recipe added to "${cookbookName}"`,
        });

        if (onSelectSharedCookbook) {
          onSelectSharedCookbook(cookbookId, cookbookName);
        }
        onClose();
      } catch (error: any) {
        console.error("Failed to add to shared cookbook:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to add recipe to shared cookbook",
          variant: "destructive",
        });
      } finally {
        setIsAdding(null);
      }
    } else {
      // Recipe not saved yet - let parent handle saving first, then adding to shared cookbook
      if (onSelectSharedCookbook) {
        onSelectSharedCookbook(cookbookId, cookbookName);
      }
      onClose();
    }
  };

  const validSharedCookbooks = sharedCookbooks?.filter(Boolean) || [];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl overflow-y-auto z-[100]">
        <SheetHeader>
          <SheetTitle className="text-left">Add to Cookbook</SheetTitle>
        </SheetHeader>

        {/* Recipe Preview */}
        <div className="mt-6 mb-4 flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg relative">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
            {recipe.imageUrl ? (
              <ImageWithFallback
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">
                🍽️
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {recipe.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select a cookbook to save this recipe
            </p>
          </div>
          {!recipe.id && (
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50">
                Not Saved
              </Badge>
            </div>
          )}
        </div>

        {/* Cookbook List */}
        <div className="space-y-2 mb-4">
          {/* Personal Cookbooks */}
          {COOKBOOKS.map((cookbook) => (
            <button
              key={cookbook.id}
              onClick={() => handleSelectCookbook(cookbook.id, cookbook.name)}
              className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cookbook.emoji}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {cookbook.name}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </button>
          ))}

          {/* Shared Cookbooks - Integrated in main list */}
          {validSharedCookbooks.length > 0 && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-2 pt-2 pb-1">
                <Users className="w-4 h-4 text-healthymama-pink" />
                <span className="text-xs font-medium text-healthymama-pink uppercase tracking-wide">
                  Shared Cookbooks
                </span>
                <div className="flex-1 h-px bg-pink-200" />
              </div>

              {validSharedCookbooks.map((cookbook: any) => (
                <button
                  key={cookbook._id}
                  onClick={() => handleSelectSharedCookbook(cookbook._id, cookbook.name)}
                  disabled={isAdding === cookbook._id || !recipe.id}
                  className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors text-left group border border-pink-100 dark:border-pink-900/30 bg-pink-50/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    {/* Cookbook Image or Placeholder */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-pink-100 dark:bg-pink-900/30 flex-shrink-0">
                      {cookbook.imageUrl ? (
                        <img
                          src={cookbook.imageUrl}
                          alt={cookbook.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-healthymama-pink" />
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100 block">
                        {cookbook.name}
                      </span>
                      {/* Member Avatars */}
                      <div className="flex items-center gap-1 mt-1">
                        {cookbook.members?.slice(0, 3).map((member: any, idx: number) => (
                          <Avatar
                            key={member.userId}
                            className="w-5 h-5 border border-white"
                            style={{ marginLeft: idx > 0 ? "-4px" : "0" }}
                          >
                            <AvatarFallback className="text-[10px] bg-healthymama-pink text-white">
                              {member.name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        <span className="text-xs text-gray-500 ml-1">
                          {cookbook.recipeCount} recipes
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-pink-400 group-hover:text-pink-600" />
                </button>
              ))}
            </>
          )}

          {/* Create New Cookbook */}
          <button
            onClick={() => {
              // TODO: Open create cookbook dialog
              console.log("Create new cookbook");
              onClose();
            }}
            className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-medium text-purple-600 dark:text-purple-400">
              Create New Cookbook
            </span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
