"use client";

import { BookOpen, Plus } from "lucide-react";

interface AddCookbookCardProps {
  onImportVideo: () => void;
}

export function AddCookbookCard({
  onImportVideo,
}: AddCookbookCardProps) {
  return (
    <div
      onClick={onImportVideo}
      className="bg-white rounded-lg shadow-sm hover:shadow-md hover:shadow-red-hover transition-all cursor-pointer overflow-hidden group"
    >
      {/* Icon Area */}
      <div className="relative aspect-square overflow-hidden flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50">
        {/* Cookbook Icon with Plus */}
        <div className="relative">
          <BookOpen
            className="w-24 h-24 text-healthymama-red group-hover:scale-110 transition-transform duration-300"
            strokeWidth={1.5}
          />
          {/* Plus badge */}
          <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-healthymama-red to-healthymama-pink rounded-full flex items-center justify-center shadow-lg">
            <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-lg">Add recipe</h3>
      </div>
    </div>
  );
}
