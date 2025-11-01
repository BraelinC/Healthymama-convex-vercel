"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "../shared/ImageWithFallback";
import { Plus, ChevronRight } from "lucide-react";

interface CookbookSelectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: {
    title: string;
    imageUrl?: string;
  };
  onSelectCookbook: (cookbookId: string, cookbookName: string) => void;
}

const COOKBOOKS = [
  { id: "uncategorized", name: "Uncategorized", emoji: "📦" },
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
}: CookbookSelectionSheetProps) {
  const handleSelectCookbook = (cookbookId: string, cookbookName: string) => {
    onSelectCookbook(cookbookId, cookbookName);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">Add to Cookbook</SheetTitle>
        </SheetHeader>

        {/* Recipe Preview */}
        <div className="mt-6 mb-4 flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
        </div>

        {/* Cookbook List */}
        <div className="space-y-2 mb-4">
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
