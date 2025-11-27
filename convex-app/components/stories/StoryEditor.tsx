"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  X,
  Type,
  ChefHat,
  Send,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Text overlay interface
interface TextOverlay {
  id: string;
  text: string;
  x: number; // Position as percentage (0-100)
  y: number;
  font: "sans" | "serif" | "handwritten";
  color: string;
  size: number;
}

// Font options
const FONTS = {
  sans: { label: "Sans", className: "font-sans" },
  serif: { label: "Serif", className: "font-serif" },
  handwritten: { label: "Script", className: "font-dancing" },
};

// Color options
const COLORS = [
  "#FFFFFF", // White
  "#000000", // Black
  "#dc2626", // Red (healthymama-red)
  "#ec4899", // Pink (healthymama-pink)
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#f59e0b", // Amber
];

interface StoryEditorProps {
  file: File;
  previewUrl: string;
  mediaType: "image" | "video";
  onClose: () => void;
  onSuccess: () => void;
}

export function StoryEditor({
  file,
  previewUrl,
  mediaType,
  onClose,
  onSuccess,
}: StoryEditorProps) {
  const { userId } = useAuth();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Image transform state
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  // Text overlay state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isAddingText, setIsAddingText] = useState(false);
  const [currentFont, setCurrentFont] = useState<"sans" | "serif" | "handwritten">("sans");
  const [currentColor, setCurrentColor] = useState("#FFFFFF");

  // Recipe attachment
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState("");

  // Caption
  const [caption, setCaption] = useState("");

  // Upload state
  const [isUploading, setIsUploading] = useState(false);

  // Touch/drag state for image
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Touch/drag state for text
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);

  // Fetch user's recipes (all for initial display)
  const userRecipes = useQuery(
    api.recipes.userRecipes.getAllUserRecipes,
    userId ? { userId } : "skip"
  );

  // Search user's recipes when searching
  const searchedRecipes = useQuery(
    api.recipes.userRecipes.searchUserRecipes,
    userId && recipeSearchTerm.trim()
      ? { userId, searchTerm: recipeSearchTerm.trim() }
      : "skip"
  );

  // Get recipes to display: searched results or 10 most recent
  const displayRecipes = recipeSearchTerm.trim()
    ? searchedRecipes
    : userRecipes?.slice(0, 10);

  const generateUploadUrl = useMutation(api.stories.generateUploadUrl);
  const createStory = useMutation(api.stories.createStory);

  // Handle zoom controls
  const handleZoomIn = () => {
    setImageScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setImageScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetTransform = () => {
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Handle image drag (mouse)
  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (selectedTextId || isAddingText) return;
    setIsDraggingImage(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  };

  const handleImageMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingImage) return;
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDraggingImage, dragStart]
  );

  const handleImageMouseUp = () => {
    setIsDraggingImage(false);
  };

  useEffect(() => {
    if (isDraggingImage) {
      window.addEventListener("mousemove", handleImageMouseMove);
      window.addEventListener("mouseup", handleImageMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleImageMouseMove);
        window.removeEventListener("mouseup", handleImageMouseUp);
      };
    }
  }, [isDraggingImage, handleImageMouseMove]);

  // Handle touch gestures for pinch-zoom
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(distance);
      setInitialScale(imageScale);
    } else if (e.touches.length === 1 && !selectedTextId && !isAddingText) {
      // Single touch drag
      setIsDraggingImage(true);
      setDragStart({
        x: e.touches[0].clientX - imagePosition.x,
        y: e.touches[0].clientY - imagePosition.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      // Pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = (distance / initialPinchDistance) * initialScale;
      setImageScale(Math.min(Math.max(scale, 0.5), 3));
    } else if (e.touches.length === 1 && isDraggingImage) {
      // Single touch drag
      setImagePosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setInitialPinchDistance(null);
    setIsDraggingImage(false);
  };

  // Add new text overlay
  const handleAddText = () => {
    const newText: TextOverlay = {
      id: `text-${Date.now()}`,
      text: "Tap to edit",
      x: 50, // Center
      y: 50,
      font: currentFont,
      color: currentColor,
      size: 24,
    };
    setTextOverlays((prev) => [...prev, newText]);
    setSelectedTextId(newText.id);
    setIsAddingText(false);
  };

  // Update text content
  const handleTextChange = (id: string, newText: string) => {
    setTextOverlays((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: newText } : t))
    );
  };

  // Update text style
  const handleTextStyleChange = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  // Delete text
  const handleDeleteText = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    setSelectedTextId(null);
  };

  // Handle text drag
  const handleTextDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    setDraggingTextId(id);
    setIsDraggingText(true);
    setSelectedTextId(id);

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const overlay = textOverlays.find((t) => t.id === id);
    if (overlay && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragStart({
        x: clientX - (overlay.x / 100) * rect.width,
        y: clientY - (overlay.y / 100) * rect.height,
      });
    }
  };

  const handleTextDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDraggingText || !draggingTextId || !containerRef.current) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const rect = containerRef.current.getBoundingClientRect();
      const newX = ((clientX - dragStart.x) / rect.width) * 100;
      const newY = ((clientY - dragStart.y) / rect.height) * 100;

      setTextOverlays((prev) =>
        prev.map((t) =>
          t.id === draggingTextId
            ? { ...t, x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) }
            : t
        )
      );
    },
    [isDraggingText, draggingTextId, dragStart]
  );

  const handleTextDragEnd = () => {
    setIsDraggingText(false);
    setDraggingTextId(null);
  };

  useEffect(() => {
    if (isDraggingText) {
      window.addEventListener("mousemove", handleTextDrag);
      window.addEventListener("mouseup", handleTextDragEnd);
      window.addEventListener("touchmove", handleTextDrag);
      window.addEventListener("touchend", handleTextDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleTextDrag);
        window.removeEventListener("mouseup", handleTextDragEnd);
        window.removeEventListener("touchmove", handleTextDrag);
        window.removeEventListener("touchend", handleTextDragEnd);
      };
    }
  }, [isDraggingText, handleTextDrag]);

  // Handle post
  const handlePost = async () => {
    if (!userId) return;

    setIsUploading(true);
    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl({});

      // Upload file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await response.json();

      // Create story with transforms
      await createStory({
        userId,
        mediaStorageId: storageId as Id<"_storage">,
        mediaType,
        recipeId: selectedRecipeId ? (selectedRecipeId as Id<"userRecipes">) : undefined,
        caption: caption.trim() || undefined,
        imageTransform: {
          scale: imageScale,
          x: imagePosition.x,
          y: imagePosition.y,
        },
        textOverlays: textOverlays.map((t) => ({
          id: t.id,
          text: t.text,
          x: t.x,
          y: t.y,
          font: t.font,
          color: t.color,
          size: t.size,
        })),
      });

      toast({
        title: "Story posted!",
        description: "Your story is now visible to your friends.",
      });

      onSuccess();
    } catch (error) {
      console.error("Error posting story:", error);
      toast({
        title: "Error",
        description: "Failed to post story. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const selectedText = textOverlays.find((t) => t.id === selectedTextId);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Full-screen blurred background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${previewUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(40px) brightness(0.5)",
          transform: "scale(1.2)",
        }}
      />

      {/* Centered mobile-style container */}
      <div className="relative z-10 h-full flex items-center justify-center p-4">
        <div
          className="flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            height: "min(90vh, 800px)",
            width: "min(calc(90vh * 9 / 16), 450px)",
          }}
        >
          {/* Header inside phone frame */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50">
            <button onClick={onClose} className="text-white p-2 hover:bg-white/20 rounded-full">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={handleZoomOut}
                className="text-white p-2 hover:bg-white/20 rounded-full"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white text-xs min-w-10 text-center">
                {Math.round(imageScale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="text-white p-2 hover:bg-white/20 rounded-full"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetTransform}
                className="text-white p-2 hover:bg-white/20 rounded-full"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden touch-none"
          onMouseDown={handleImageMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (!isDraggingText && !isDraggingImage) {
              setSelectedTextId(null);
            }
          }}
        >
          {/* Background Image */}
          {mediaType === "image" && (
            <img
              ref={imageRef}
              src={previewUrl}
              alt="Story"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
              }}
              draggable={false}
            />
          )}

          {/* Video */}
          {mediaType === "video" && (
            <video
              src={previewUrl}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
              }}
              autoPlay
              loop
              muted
              playsInline
            />
          )}

          {/* Text Overlays */}
          {textOverlays.map((overlay) => (
            <div
              key={overlay.id}
              className="absolute cursor-move select-none"
              style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={(e) => handleTextDragStart(e, overlay.id)}
              onTouchStart={(e) => handleTextDragStart(e, overlay.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTextId(overlay.id);
              }}
            >
              {selectedTextId === overlay.id ? (
                <input
                  type="text"
                  value={overlay.text === "Tap to edit" ? "" : overlay.text}
                  placeholder="Type here..."
                  onChange={(e) => handleTextChange(overlay.id, e.target.value || "Tap to edit")}
                  className={`bg-transparent border-none outline-none text-center ${FONTS[overlay.font].className}`}
                  style={{
                    color: overlay.color,
                    fontSize: `${overlay.size}px`,
                    textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                    minWidth: "50px",
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className={FONTS[overlay.font].className}
                  style={{
                    color: overlay.color,
                    fontSize: `${overlay.size}px`,
                    textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                  }}
                >
                  {overlay.text}
                </span>
              )}
            </div>
          ))}
          </div>

          {/* Text Style Bar (when text selected) */}
          {selectedText && (
            <div className="bg-gray-800/90 p-2">
              <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {/* Font selector */}
            <div className="flex gap-2">
              {(Object.keys(FONTS) as Array<keyof typeof FONTS>).map((font) => (
                <button
                  key={font}
                  onClick={() => handleTextStyleChange(selectedText.id, { font })}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedText.font === font
                      ? "bg-white text-black"
                      : "bg-gray-700 text-white"
                  } ${FONTS[font].className}`}
                >
                  {FONTS[font].label}
                </button>
              ))}
            </div>

            {/* Color selector */}
            <div className="flex gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleTextStyleChange(selectedText.id, { color })}
                  className={`w-7 h-7 rounded-full border-2 ${
                    selectedText.color === color ? "border-white" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Size controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleTextStyleChange(selectedText.id, {
                    size: Math.max(12, selectedText.size - 4),
                  })
                }
                className="text-white text-xs px-2 py-1 bg-gray-700 rounded"
              >
                A-
              </button>
              <button
                onClick={() =>
                  handleTextStyleChange(selectedText.id, {
                    size: Math.min(72, selectedText.size + 4),
                  })
                }
                className="text-white text-lg px-2 py-1 bg-gray-700 rounded"
              >
                A+
              </button>
            </div>

            {/* Delete */}
            <button
              onClick={() => handleDeleteText(selectedText.id)}
              className="text-red-500 p-2"
            >
              <Trash2 className="w-5 h-5" />
            </button>
              </div>
            </div>
          )}

          {/* Caption Input */}
          <div className="px-3 py-2 border-t border-gray-700/50">
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={150}
              className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-gray-500"
            />
          </div>

          {/* Bottom Toolbar */}
          <div className="bg-gray-800/50 p-3">
            <div className="flex items-center justify-between">
              {/* Left tools */}
              <div className="flex gap-2">
                <button
                  onClick={handleAddText}
                  className="flex flex-col items-center text-white"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <Type className="w-5 h-5" />
                  </div>
                  <span className="text-xs mt-1">Text</span>
                </button>

                <button
                  onClick={() => setShowRecipeSelector(true)}
                  className={`flex flex-col items-center ${
                    selectedRecipeId ? "text-healthymama-pink" : "text-white"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedRecipeId ? "bg-healthymama-pink/20" : "bg-gray-700"
                    }`}
                  >
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <span className="text-xs mt-1">Recipe</span>
                </button>
              </div>

              {/* Post button */}
              <Button
                onClick={handlePost}
                disabled={isUploading}
                className="bg-gradient-to-r from-healthymama-red to-healthymama-pink text-white px-6"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Post
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe Selector Modal - Centered overlay */}
      {showRecipeSelector && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-h-[80vh] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Attach Recipe</h3>
              <button
                onClick={() => {
                  setShowRecipeSelector(false);
                  setRecipeSearchTerm("");
                }}
                className="text-white hover:bg-white/20 p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search bar */}
            <div className="p-4 border-b border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search recipes..."
                  value={recipeSearchTerm}
                  onChange={(e) => setRecipeSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-healthymama-pink placeholder-gray-500"
                  autoFocus
                />
              </div>
              {!recipeSearchTerm && (
                <p className="text-gray-500 text-xs mt-2">Showing 10 most recent recipes</p>
              )}
            </div>

            <div className="overflow-y-auto max-h-[50vh] p-4">
              <button
                onClick={() => {
                  setSelectedRecipeId("");
                  setShowRecipeSelector(false);
                  setRecipeSearchTerm("");
                }}
                className={`w-full p-3 rounded-lg mb-2 text-left ${
                  !selectedRecipeId ? "bg-gray-700" : "bg-gray-800"
                } hover:bg-gray-600 transition-colors`}
              >
                <span className="text-white">No recipe</span>
              </button>
              {displayRecipes?.map((recipe: any) => (
                <button
                  key={recipe._id}
                  onClick={() => {
                    setSelectedRecipeId(recipe._id);
                    setShowRecipeSelector(false);
                    setRecipeSearchTerm("");
                  }}
                  className={`w-full p-3 rounded-lg mb-2 text-left flex items-center gap-3 ${
                    selectedRecipeId === recipe._id ? "bg-gray-700" : "bg-gray-800"
                  } hover:bg-gray-600 transition-colors`}
                >
                  {recipe.imageUrl ? (
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <ChefHat className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <span className="text-white truncate">
                    {recipe.title || recipe.customRecipeData?.title || "Untitled"}
                  </span>
                </button>
              ))}
              {displayRecipes?.length === 0 && recipeSearchTerm && (
                <p className="text-gray-500 text-center py-4">No recipes found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
