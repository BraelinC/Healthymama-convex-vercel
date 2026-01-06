"use client";

import { use, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { Id } from "@healthymama/convex/dataModel";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { Loader2, ChefHat, Clock, Users, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface SharedRecipePageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Public Shared Recipe Page
 * Allows anyone to view recipes sent via Instagram DM
 * Prompts non-logged-in users to sign up
 */
export default function SharedRecipePage({ params }: SharedRecipePageProps) {
  const unwrappedParams = use(params);
  const recipeId = unwrappedParams.id as Id<"userRecipes">;
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // Fetch recipe (no auth required - fully public)
  const recipe = useQuery(api.mikey.queries.getAnonymousRecipe, { recipeId });

  // Debug: Log recipe data to see what imageUrl we're getting
  useEffect(() => {
    if (recipe) {
      console.log("[SharedRecipe] Recipe data:", {
        _id: recipe._id,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
        hasImage: !!recipe.imageUrl,
      });
    }
  }, [recipe]);

  // Mutation to save recipe to user's cookbook
  const saveRecipe = useMutation(api.recipes.userRecipes.saveRecipeToUserCookbook);

  // Handle save to cookbook
  const handleSaveRecipe = async () => {
    if (!user?.id) {
      // Redirect to sign up
      window.location.href = "/sign-up?redirect=" + encodeURIComponent(window.location.pathname);
      return;
    }

    try {
      await saveRecipe({
        userId: user.id,
        recipeType: "custom",
        cookbookCategory: "favorites",
        title: recipe?.title || "Recipe",
        description: recipe?.description,
        ingredients: recipe?.ingredients || [],
        instructions: recipe?.instructions || [],
        imageUrl: recipe?.imageUrl,
        servings: recipe?.servings,
        prep_time: recipe?.prep_time,
        cook_time: recipe?.cook_time,
        cuisine: recipe?.cuisine,
        isFavorited: false, // IMPORTANT: Don't copy favorite status from original user
      });

      toast({
        title: "Recipe Saved!",
        description: "Added to your Favorites",
      });

      // Redirect to user's recipes
      router.push("/recipes");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save recipe",
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Recipe Not Found</h1>
          <p className="text-gray-600 mb-4">This recipe may have been removed or doesn't exist.</p>
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-healthymama-pink" />
            <span className="font-semibold text-gray-900">HealthyMama</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Recipe Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Image - Always show, even if URL is missing */}
          <div className="w-full h-80 bg-gray-200">
            {recipe.imageUrl ? (
              <ImageWithFallback
                src={recipe.imageUrl}
                alt={recipe.title}
                width={800}
                height={400}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-healthymama-pink/10 to-healthymama-pink/5">
                <div className="text-center text-gray-400">
                  <ChefHat className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No image available</p>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{recipe.title}</h1>

            {/* Description */}
            {recipe.description && (
              <p className="text-gray-600 mb-6">{recipe.description}</p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600">
              {recipe.prep_time && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Prep: {recipe.prep_time}</span>
                </div>
              )}
              {recipe.cook_time && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Cook: {recipe.cook_time}</span>
                </div>
              )}
              {recipe.servings && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Servings: {recipe.servings}</span>
                </div>
              )}
              {recipe.cuisine && (
                <div className="flex items-center gap-2">
                  <ChefHat className="w-4 h-4" />
                  <span>{recipe.cuisine}</span>
                </div>
              )}
            </div>

            {/* CTA */}
            {!user ? (
              <div className="bg-healthymama-pink/10 rounded-lg p-6 mb-6 text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Sign up to save this recipe!
                </h3>
                <p className="text-gray-600 mb-4">
                  Create a free account to save recipes to your personal cookbook
                </p>
                <Button
                  onClick={() =>
                    (window.location.href =
                      "/sign-up?redirect=" + encodeURIComponent(window.location.pathname))
                  }
                  className="bg-healthymama-pink hover:bg-healthymama-pink/90"
                >
                  Create Free Account
                </Button>
              </div>
            ) : (
              <div className="bg-green-50 rounded-lg p-6 mb-6 text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Save to your cookbook</h3>
                <p className="text-gray-600 mb-4">Add this recipe to your favorites</p>
                <Button onClick={handleSaveRecipe} className="bg-healthymama-pink hover:bg-healthymama-pink/90">
                  Save to My Recipes
                </Button>
              </div>
            )}

            {/* Ingredients */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Ingredients</h2>
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="w-2 h-2 bg-healthymama-pink rounded-full mt-2 flex-shrink-0" />
                    <span className="text-gray-700">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Instructions</h2>
              <ol className="space-y-4">
                {recipe.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-healthymama-pink text-white rounded-full flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </span>
                    <span className="text-gray-700 pt-1">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Recipe shared via HealthyMama Instagram DM Bot</p>
          <p className="mt-1">
            Want your own recipes extracted?{" "}
            <a href="https://instagram.com/healthymama" className="text-healthymama-pink hover:underline">
              DM us on Instagram
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
