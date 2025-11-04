"use client";

import { useEffect } from "react";
import { Heart, BookOpen, X } from "lucide-react";

interface PlusButtonMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecipe: () => void;
  onViewFavorites: () => void;
}

interface MenuItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

export function PlusButtonMenu({
  isOpen,
  onClose,
  onAddRecipe,
  onViewFavorites,
}: PlusButtonMenuProps) {
  const menuItems: MenuItem[] = [
    {
      icon: <Heart className="w-5 h-5" />,
      title: "Favorites",
      description: "View your saved recipes",
      onClick: () => {
        onViewFavorites();
        onClose();
      },
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: "DIY Recipe",
      description: "Build recipes from scratch",
      onClick: () => {
        onAddRecipe();
        onClose();
      },
    },
  ];

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Floating Menu Card - Positioned above FAB button */}
      <div className="fixed bottom-44 right-8 z-50 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Quick Actions
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full flex items-start gap-4 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <div className="flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
