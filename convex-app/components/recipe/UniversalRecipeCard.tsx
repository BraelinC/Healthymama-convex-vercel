"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageWithFallback } from "../shared/ImageWithFallback";
import { Plus, Share2, Heart, Clock, ShoppingCart, ChefHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MuxPlayer from "@mux/mux-player-react";
import { StepByStepCookingView } from "./StepByStepCookingView";

interface VideoSegment {
  stepNumber: number;
  instruction: string;
  startTime: number;
  endTime: number;
}

interface UniversalRecipeCardProps {
  recipe: {
    id?: string;
    title: string;
    description?: string;
    imageUrl?: string;
    ingredients: string[];
    instructions: string[];
    time_minutes?: number;
    category?: string;
    cuisine?: string;
    muxPlaybackId?: string;
    instagramUsername?: string;
    videoSegments?: VideoSegment[];
  };
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  onAddToCookbook?: () => void;
  onShare?: () => void;
}

export function UniversalRecipeCard({
  recipe,
  isFavorited = false,
  onToggleFavorite,
  onAddToCookbook,
  onShare,
}: UniversalRecipeCardProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [isShoppingLoading, setIsShoppingLoading] = useState(false);
  const [isCookingMode, setIsCookingMode] = useState(false);
  const { toast } = useToast();

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const handleShopIngredients = async () => {
    setIsShoppingLoading(true);

    try {
      const response = await fetch("/api/instacart/create-recipe-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: recipe.title,
          ingredients: recipe.ingredients,
          imageUrl: recipe.imageUrl,
          instructions: recipe.instructions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create Instacart link");
      }

      const data = await response.json();

      if (data.instacartUrl) {
        console.log("[INSTACART] Received URL:", data.instacartUrl);

        // Open Instacart in new tab - use multiple approaches for reliability
        const newWindow = window.open(data.instacartUrl, "_blank", "noopener,noreferrer");

        if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
          // Popup was blocked - try alternative method
          console.warn("[INSTACART] Popup blocked, using anchor click method");
          const link = document.createElement("a");
          link.href = data.instacartUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        toast({
          title: "Opening Instacart",
          description: "Your shopping list is ready!",
        });
      } else {
        throw new Error("No Instacart URL returned");
      }
    } catch (error) {
      console.error("Error creating Instacart link:", error);
      toast({
        title: "Error",
        description: "Failed to create shopping link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsShoppingLoading(false);
    }
  };

  // Show cooking mode if enabled and video segments are available
  if (isCookingMode && recipe.muxPlaybackId && recipe.videoSegments) {
    return (
      <StepByStepCookingView
        muxPlaybackId={recipe.muxPlaybackId}
        instructions={recipe.instructions}
        videoSegments={recipe.videoSegments}
        onClose={() => setIsCookingMode(false)}
      />
    );
  }

  return (
    <Card className="overflow-hidden shadow-lg max-w-2xl mx-auto bg-white">
      {/* Image/Video Section with Action Buttons Overlay */}
      <div className="relative">
        <div className="relative h-64 w-full bg-gray-200">
          {recipe.muxPlaybackId ? (
            <MuxPlayer
              playbackId={recipe.muxPlaybackId}
              className="w-full h-full object-cover"
              streamType="on-demand"
              muted={false}
              autoPlay={false}
            />
          ) : recipe.imageUrl ? (
            <ImageWithFallback
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-6xl">🍽️</span>
            </div>
          )}
        </div>

        {/* Time Badge Overlay */}
        {recipe.time_minutes && (
          <Badge className="absolute top-4 left-4 bg-black/70 text-white border-none">
            <Clock className="w-3 h-3 mr-1" />
            {recipe.time_minutes} min
          </Badge>
        )}

        {/* Action Buttons Overlay */}
        <div className="absolute top-4 right-4 flex gap-2">
          {/* Plus Button - Add to Cookbook */}
          <Button
            size="icon"
            variant="secondary"
            className={`w-10 h-10 rounded-full shadow-md transition-all ${
              onAddToCookbook
                ? "bg-white/90 hover:bg-white"
                : "bg-white/50 cursor-not-allowed"
            }`}
            onClick={onAddToCookbook}
            disabled={!onAddToCookbook}
          >
            <Plus className={`w-5 h-5 ${onAddToCookbook ? "text-orange-600" : "text-gray-400"}`} />
          </Button>

          {/* Share Button */}
          <Button
            size="icon"
            variant="secondary"
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md"
            onClick={onShare}
          >
            <Share2 className="w-5 h-5 text-rose-600" />
          </Button>

          {/* Heart Button - Favorite */}
          <Button
            size="icon"
            variant="secondary"
            className={`w-10 h-10 rounded-full shadow-md transition-all ${
              isFavorited
                ? "bg-red-500 hover:bg-red-600"
                : "bg-white/90 hover:bg-white"
            }`}
            onClick={onToggleFavorite}
          >
            <Heart
              className={`w-5 h-5 ${
                isFavorited
                  ? "text-white fill-white"
                  : "text-gray-600"
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Recipe Header */}
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{recipe.title}</h2>
        {recipe.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{recipe.description}</p>
        )}
        <div className="flex gap-2 mt-3">
          {recipe.category && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              {recipe.category}
            </Badge>
          )}
          {recipe.cuisine && (
            <Badge variant="secondary" className="bg-rose-100 text-rose-700">
              {recipe.cuisine}
            </Badge>
          )}
          {recipe.instagramUsername && (
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              @{recipe.instagramUsername}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs Section - Ingredients and Instructions */}
      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none bg-gray-50">
          <TabsTrigger
            value="ingredients"
            className="data-[state=active]:bg-white data-[state=active]:text-purple-600"
          >
            Ingredients
          </TabsTrigger>
          <TabsTrigger
            value="instructions"
            className="data-[state=active]:bg-white data-[state=active]:text-purple-600"
          >
            Instructions
          </TabsTrigger>
        </TabsList>

        {/* Ingredients Tab */}
        <TabsContent value="ingredients" className="p-6 space-y-4">
          <div className="space-y-3">
            {recipe.ingredients.map((ingredient, index) => (
              <div key={index} className="flex items-start gap-3 group">
                <Checkbox
                  id={`ingredient-${index}`}
                  checked={checkedIngredients.has(index)}
                  onCheckedChange={() => toggleIngredient(index)}
                  className="mt-1"
                />
                <label
                  htmlFor={`ingredient-${index}`}
                  className={`flex-1 cursor-pointer text-gray-700 ${
                    checkedIngredients.has(index) ? "line-through text-gray-400" : ""
                  }`}
                >
                  {ingredient}
                </label>
              </div>
            ))}
          </div>

          {/* Shop Ingredients Button */}
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleShopIngredients}
            disabled={isShoppingLoading}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isShoppingLoading ? "Creating Shopping List..." : "Shop Ingredients"}
          </Button>
        </TabsContent>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="p-6 space-y-4">
          <div className="space-y-4 mb-6">
            {recipe.instructions.map((instruction, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <p className="flex-1 text-gray-700 pt-1">{instruction}</p>
              </div>
            ))}
          </div>

          {/* Start Cooking Button - Temporarily disabled
          {recipe.muxPlaybackId && recipe.videoSegments && recipe.videoSegments.length > 0 && (
            <Button
              className="w-full bg-gradient-to-br from-[#dc2626] to-[#ec4899] hover:shadow-red-glow text-white"
              onClick={() => setIsCookingMode(true)}
            >
              <ChefHat className="w-4 h-4 mr-2" />
              Start Step-by-Step Cooking
            </Button>
          )}
          */}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
