"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X, ChevronLeft, ChevronRight, ChefHat, Eye } from "lucide-react";

// Text overlay interface
interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  font: string;
  color: string;
  size: number;
}

// Font class mapping
const FONTS: { [key: string]: string } = {
  sans: "font-sans",
  serif: "font-serif",
  handwritten: "font-dancing",
};

interface Story {
  _id: Id<"stories">;
  userId: string;
  mediaUrl: string | null;
  mediaType: "image" | "video";
  recipeId?: Id<"userRecipes">;
  recipeTitle?: string;
  recipeImageUrl?: string;
  caption?: string;
  createdAt: number;
  expiresAt: number;
  isViewed?: boolean;
  viewCount?: number;
  // New editor fields
  imageTransform?: {
    scale: number;
    x: number;
    y: number;
  };
  textOverlays?: TextOverlay[];
}

interface StoryUser {
  userId: string;
  userName: string;
  userEmail?: string;
  profileImageUrl?: string | null;
  stories: Story[];
  hasUnviewed: boolean;
}

interface StoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  storyUser: StoryUser;
}

const STORY_DURATION = 7500; // 7.5 seconds per story

export function StoryViewer({ isOpen, onClose, storyUser }: StoryViewerProps) {
  const router = useRouter();
  const { userId } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const markViewed = useMutation(api.stories.markStoryViewed);

  const currentStory = storyUser.stories[currentIndex];
  const isOwnStory = storyUser.userId === userId;

  // Prefetch recipe data when story has a recipe - this warms the cache
  const _prefetchedRecipe = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    currentStory?.recipeId ? { recipeId: currentStory.recipeId } : "skip"
  );

  // Navigate to recipe page
  const handleViewRecipe = useCallback(() => {
    if (currentStory?.recipeId) {
      onClose(); // Close the story viewer
      router.push(`/recipe/${currentStory.recipeId}`);
    }
  }, [currentStory?.recipeId, onClose, router]);

  // Mark story as viewed
  useEffect(() => {
    if (isOpen && currentStory && userId && !isOwnStory) {
      markViewed({
        storyId: currentStory._id,
        viewerId: userId,
      }).catch(console.error);
    }
  }, [isOpen, currentStory?._id, userId, isOwnStory, markViewed]);

  // Progress bar timer
  useEffect(() => {
    if (!isOpen || isPaused) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Move to next story
          if (currentIndex < storyUser.stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
            return 0;
          } else {
            // End of stories
            onClose();
            return 100;
          }
        }
        return prev + (100 / (STORY_DURATION / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, currentIndex, storyUser.stories.length, onClose]);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setProgress(0);
      setIsPaused(false);
    }
  }, [isOpen]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < storyUser.stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, storyUser.stories.length, onClose]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width / 3) {
      goToPrevious();
    } else if (x > (width * 2) / 3) {
      goToNext();
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!currentStory) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 bg-black border-none overflow-hidden h-[90vh] max-h-[800px]">
        <VisuallyHidden>
          <DialogTitle>{storyUser.userName}&apos;s Story</DialogTitle>
        </VisuallyHidden>
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
          {storyUser.stories.map((_, index) => (
            <div
              key={index}
              className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width:
                    index < currentIndex
                      ? "100%"
                      : index === currentIndex
                      ? `${progress}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-healthymama-red to-healthymama-pink p-[2px]">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                {storyUser.profileImageUrl ? (
                  <img
                    src={storyUser.profileImageUrl}
                    alt={storyUser.userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-healthymama-red">
                    {getInitials(storyUser.userName)}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-white font-medium text-sm">{storyUser.userName}</p>
              <p className="text-white/70 text-xs">{formatTimeAgo(currentStory.createdAt)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Story Content */}
        <div
          className="w-full h-full flex items-center justify-center cursor-pointer relative overflow-hidden"
          onClick={handleTap}
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Media with transforms */}
          {currentStory.mediaType === "image" && currentStory.mediaUrl && (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-cover"
              style={
                currentStory.imageTransform
                  ? {
                      transform: `scale(${currentStory.imageTransform.scale}) translate(${currentStory.imageTransform.x / currentStory.imageTransform.scale}px, ${currentStory.imageTransform.y / currentStory.imageTransform.scale}px)`,
                    }
                  : undefined
              }
            />
          )}
          {currentStory.mediaType === "video" && currentStory.mediaUrl && (
            <video
              src={currentStory.mediaUrl}
              className="w-full h-full object-cover"
              style={
                currentStory.imageTransform
                  ? {
                      transform: `scale(${currentStory.imageTransform.scale}) translate(${currentStory.imageTransform.x / currentStory.imageTransform.scale}px, ${currentStory.imageTransform.y / currentStory.imageTransform.scale}px)`,
                    }
                  : undefined
              }
              autoPlay
              playsInline
              muted={false}
              onEnded={goToNext}
            />
          )}

          {/* Text Overlays */}
          {currentStory.textOverlays?.map((overlay) => (
            <div
              key={overlay.id}
              className={`absolute pointer-events-none ${FONTS[overlay.font] || "font-sans"}`}
              style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                transform: "translate(-50%, -50%)",
                color: overlay.color,
                fontSize: `${overlay.size}px`,
                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
              }}
            >
              {overlay.text}
            </div>
          ))}
        </div>

        {/* Navigation arrows (desktop) */}
        <div className="hidden md:flex absolute inset-y-0 left-0 items-center">
          {currentIndex > 0 && (
            <button
              onClick={goToPrevious}
              className="w-10 h-10 ml-2 flex items-center justify-center text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
        </div>
        <div className="hidden md:flex absolute inset-y-0 right-0 items-center">
          {currentIndex < storyUser.stories.length - 1 && (
            <button
              onClick={goToNext}
              className="w-10 h-10 mr-2 flex items-center justify-center text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 to-transparent">
          {/* Caption */}
          {currentStory.caption && (
            <p className="text-white text-sm mb-3">{currentStory.caption}</p>
          )}

          {/* Recipe attachment - tap to view full recipe */}
          {currentStory.recipeId && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent story tap navigation
                handleViewRecipe();
              }}
              className="w-full bg-white/10 backdrop-blur-sm rounded-lg p-3 flex items-center gap-3 hover:bg-white/20 transition-colors active:scale-[0.98]"
            >
              {currentStory.recipeImageUrl ? (
                <img
                  src={currentStory.recipeImageUrl}
                  alt={currentStory.recipeTitle}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ChefHat className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1 text-left">
                <p className="text-white font-medium text-sm">
                  {currentStory.recipeTitle || "Recipe"}
                </p>
                <p className="text-white/70 text-xs">Tap to view recipe</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
            </button>
          )}

          {/* View count for own stories */}
          {isOwnStory && typeof currentStory.viewCount === "number" && (
            <div className="flex items-center gap-2 text-white/70 text-sm mt-2">
              <Eye className="w-4 h-4" />
              <span>{currentStory.viewCount} {currentStory.viewCount === 1 ? "view" : "views"}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
