"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { UnifiedRecipeCard } from "@/components/recipe/UnifiedRecipeCard";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface RecipePageProps {
  params: Promise<{
    id: string;
  }>;
}

// SEO Metadata - Update document head when recipe loads
function useRecipeMetadata(recipe: any) {
  useEffect(() => {
    if (recipe) {
      // Update page title
      document.title = `${recipe.title} | HealthyMama Recipe`;

      // Update meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute(
        'content',
        recipe.description || `${recipe.title} - A delicious recipe from HealthyMama`
      );

      // Update Open Graph tags for social sharing
      const ogTags = [
        { property: 'og:title', content: recipe.title },
        { property: 'og:description', content: recipe.description || `${recipe.title} - A delicious recipe from HealthyMama` },
        { property: 'og:type', content: 'article' },
        { property: 'og:image', content: recipe.imageUrl || '/default-recipe-image.jpg' },
      ];

      ogTags.forEach(({ property, content }) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      });
    }
  }, [recipe]);
}

export default function RecipePage({ params }: RecipePageProps) {
  // Unwrap async params (Next.js 15 requirement)
  const unwrappedParams = use(params);
  const recipeId = unwrappedParams.id;

  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);

  // Fetch recipe data
  const recipe = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    recipeId ? { recipeId: recipeId as Id<"userRecipes"> } : "skip"
  );

  // Update SEO metadata when recipe loads
  useRecipeMetadata(recipe);

  // Mutations
  const toggleFavorite = useMutation(api.recipes.userRecipes.toggleRecipeFavorite);
  const updateCookbook = useMutation(api.recipes.userRecipes.updateRecipeCookbook);

  // Handle toggle favorite
  const handleToggleFavorite = async () => {
    if (!user?.id || !recipe?._id) return;

    try {
      await toggleFavorite({ userId: user.id, userRecipeId: recipe._id });
      toast({
        title: "Success",
        description: recipe.isFavorited ? "Removed from favorites" : "Added to favorites",
      });
    } catch (error) {
      console.error("Toggle favorite error:", error);
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      });
    }
  };

  // Handle share (clipboard fallback)
  const handleShare = async () => {
    if (!recipe) return;

    try {
      await navigator.clipboard.writeText(recipe.title);
      toast({
        title: "Copied!",
        description: "Recipe name copied to clipboard",
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  // Handle add to cookbook
  const handleAddToCookbook = () => {
    if (!recipe?._id) {
      toast({
        title: "Recipe Not Ready",
        description: "This recipe hasn't been saved yet.",
        variant: "destructive",
      });
      return;
    }
    setIsCookbookSelectionOpen(true);
  };

  // Handle cookbook selection
  const handleSelectCookbook = async (cookbookCategory: string) => {
    if (!user?.id || !recipe?._id) return;

    try {
      await updateCookbook({
        userId: user.id,
        userRecipeId: recipe._id,
        newCookbookCategory: cookbookCategory,
      });

      toast({
        title: "Recipe moved!",
        description: `Moved to ${cookbookCategory}`,
      });
      setIsCookbookSelectionOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update cookbook",
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (!isLoaded || recipe === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-healthymama-pink" />
      </div>
    );
  }

  // Recipe not found
  if (recipe === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Recipe Not Found</h1>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-600 mb-6">
            This recipe could not be found or may have been deleted.
          </p>
          <Button onClick={() => router.push("/")} className="bg-healthymama-pink hover:bg-healthymama-pink/90">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Recipe Details</h1>
        </div>
      </header>

      {/* Recipe Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {recipe && (
          <UnifiedRecipeCard
            recipe={{
              ...recipe,
              name: recipe.title, // Map title to name for UnifiedRecipeCard
              steps: recipe.instructions, // Map instructions to steps
            }}
            userId={user?.id}
            isFavorited={recipe.isFavorited}
            onToggleFavorite={handleToggleFavorite}
            onAddToCookbook={recipe._id ? handleAddToCookbook : undefined}
            onShare={handleShare}
          />
        )}
        {!recipe && (
          <div className="text-center py-12">
            <p className="text-gray-600">Unable to load recipe data</p>
            <Button
              onClick={() => router.back()}
              className="mt-4 bg-healthymama-pink hover:bg-healthymama-pink/90"
            >
              Go Back
            </Button>
          </div>
        )}
      </div>

      {/* Cookbook Selection Sheet */}
      <CookbookSelectionSheet
        isOpen={isCookbookSelectionOpen}
        onClose={() => setIsCookbookSelectionOpen(false)}
        recipe={recipe}
        onSelectCookbook={handleSelectCookbook}
      />
    </div>
  );
}
