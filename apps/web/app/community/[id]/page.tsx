"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { Id } from "@healthymama/convex/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConvexCommunityChat from "@/components/chat/ConvexCommunityChat";
import ConvexExtractor from "@/components/shared/ConvexExtractor";
import ConvexDebugger from "@/components/shared/ConvexDebugger";
import { CommunitySwitcher } from "@/components/community/CommunitySwitcher";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";
import { useToast } from "@/hooks/use-toast";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { UnifiedRecipeCard } from "@/components/recipe/UnifiedRecipeCard";
import {
  Users,
  ChefHat,
  ArrowLeft,
  Plus,
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  LogIn,
  BookMarked
} from "lucide-react";

interface CommunityPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function CommunityPage({ params }: CommunityPageProps) {
  // Unwrap async params (Next.js 15 requirement)
  const unwrappedParams = use(params);
  const communityId = unwrappedParams.id;

  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("meals");
  const [postContent, setPostContent] = useState("");
  const [activeFilter, setActiveFilter] = useState("recent");
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);
  const [selectedRecipeForCookbook, setSelectedRecipeForCookbook] = useState<any>(null);

  // Mutations
  const saveRecipe = useMutation(api.recipes.userRecipes.saveRecipeToUserCookbook);
  const toggleFavorite = useMutation(api.recipes.userRecipes.toggleRecipeFavorite);
  const addToSharedCookbook = useMutation(api.sharedCookbooks.addRecipeToSharedCookbook);

  // Fetch community data from Convex
  const community = useQuery(
    api.communities.getCommunityById,
    communityId ? { communityId: communityId as Id<"communities"> } : "skip"
  );

  // Fetch community recipes (reduced limit to save bandwidth - was 200)
  const communityRecipes = useQuery(
    api.recipes.recipeQueries.listCommunityRecipes,
    communityId ? { communityId: communityId, limit: 20 } : "skip"
  );

  // Filter recipes based on activeFilter
  const filteredRecipes = useMemo(() => {
    if (!communityRecipes) return [];

    if (activeFilter === "all" || activeFilter === "recent") {
      return communityRecipes;  // Show all (sorted by recent)
    }

    // Map filter names to dietTags
    const filterTagMap: Record<string, string[]> = {
      breakfast: ["breakfast"],
      lunch: ["lunch"],
      dinner: ["dinner"],
      baking: ["baking", "baked goods", "baked"],
      sweets: ["dessert", "candy", "sweet", "sweets"],
    };

    const targetTags = filterTagMap[activeFilter] || [];

    return communityRecipes.filter(recipe =>
      recipe.dietTags?.some(tag => tag &&
        targetTags.some(filterTag =>
          tag.toLowerCase().includes(filterTag.toLowerCase())
        )
      )
    );
  }, [communityRecipes, activeFilter]);

  // Check if user has access to this community
  const isFree = community
    ? !community.monthlyPrice && !community.yearlyPrice && !community.lifetimePrice
    : false;
  const isCreator = community && user ? user.id === community.creatorId : false;

  const accessCheck = useQuery(
    api.stripe.queries.hasAccessToCommunity,
    user?.id && communityId && !isFree && !isCreator
      ? { userId: user.id, communityId: communityId as Id<"communities"> }
      : "skip"
  );

  // Redirect to discover page if user doesn't have access
  useEffect(() => {
    if (
      isLoaded &&
      isSignedIn &&
      user?.id &&
      community &&
      !isFree &&
      !isCreator &&
      accessCheck !== undefined &&
      !accessCheck.hasAccess
    ) {
      console.warn("⚠️ [ACCESS DENIED] Redirecting to discover page - user doesn't have access");
      router.push("/?tab=community&discover=true");
    }
  }, [isLoaded, isSignedIn, user?.id, community, isFree, isCreator, accessCheck, router]);

  // Mutation to update last visited community
  const updateLastVisited = useMutation(api.communities.updateLastVisitedCommunity);

  // Update last visited community when page loads (only if user has access)
  useEffect(() => {
    if (user?.id && communityId && community && (isFree || isCreator || accessCheck?.hasAccess)) {
      updateLastVisited({
        userId: user.id,
        communityId: communityId as Id<"communities">,
      }).catch((error) => {
        console.error("Failed to update last visited community:", error);
      });
    }
  }, [user?.id, communityId, community, isFree, isCreator, accessCheck, updateLastVisited]);

  // Recipe action handlers
  const handleAddToCookbook = (recipe: any) => {
    setSelectedRecipeForCookbook(recipe);
    setIsCookbookSelectionOpen(true);
  };

  const handleSelectCookbook = async (cookbookId: string, cookbookName: string) => {
    if (!user?.id || !selectedRecipeForCookbook) return;

    try {
      await saveRecipe({
        userId: user.id,
        recipeType: "community",
        cookbookCategory: cookbookId,
        title: selectedRecipeForCookbook.name,
        description: selectedRecipeForCookbook.description,
        imageUrl: selectedRecipeForCookbook.imageUrl,
        ingredients: selectedRecipeForCookbook.ingredients || [],
        instructions: selectedRecipeForCookbook.steps || [],
        servings: selectedRecipeForCookbook.servings,
        prep_time: selectedRecipeForCookbook.prep_time,
        cook_time: selectedRecipeForCookbook.cook_time,
        time_minutes: selectedRecipeForCookbook.time_minutes,
        cuisine: selectedRecipeForCookbook.cuisine,
        diet: selectedRecipeForCookbook.diet,
        category: selectedRecipeForCookbook.category,
        communityRecipeId: selectedRecipeForCookbook._id,
        isFavorited: false,
      });

      toast({
        title: "Saved!",
        description: `Recipe added to ${cookbookName}`,
      });

      setIsCookbookSelectionOpen(false);
      setSelectedRecipeForCookbook(null);
    } catch (error) {
      console.error("Save recipe error:", error);
      toast({
        title: "Error",
        description: "Failed to save recipe",
        variant: "destructive",
      });
    }
  };

  const handleSelectSharedCookbook = async (cookbookId: Id<"sharedCookbooks">, cookbookName: string) => {
    if (!user?.id || !selectedRecipeForCookbook) return;

    try {
      // First save the recipe to get a recipe ID
      const recipeId = await saveRecipe({
        userId: user.id,
        recipeType: "community",
        cookbookCategory: "favorites", // Default category, it will be in shared cookbook
        title: selectedRecipeForCookbook.name,
        description: selectedRecipeForCookbook.description,
        imageUrl: selectedRecipeForCookbook.imageUrl,
        ingredients: selectedRecipeForCookbook.ingredients || [],
        instructions: selectedRecipeForCookbook.steps || [],
        servings: selectedRecipeForCookbook.servings,
        prep_time: selectedRecipeForCookbook.prep_time,
        cook_time: selectedRecipeForCookbook.cook_time,
        time_minutes: selectedRecipeForCookbook.time_minutes,
        cuisine: selectedRecipeForCookbook.cuisine,
        diet: selectedRecipeForCookbook.diet,
        category: selectedRecipeForCookbook.category,
        communityRecipeId: selectedRecipeForCookbook._id,
        isFavorited: false,
      });

      // Then add it to the shared cookbook
      await addToSharedCookbook({
        cookbookId,
        recipeId: recipeId as Id<"userRecipes">,
        userId: user.id,
      });

      toast({
        title: "Added to shared cookbook!",
        description: `Recipe added to "${cookbookName}"`,
      });

      setIsCookbookSelectionOpen(false);
      setSelectedRecipeForCookbook(null);
    } catch (error) {
      console.error("Save to shared cookbook error:", error);
      toast({
        title: "Error",
        description: "Failed to save recipe to shared cookbook",
        variant: "destructive",
      });
    }
  };

  const handleShare = (recipe: any) => {
    navigator.clipboard.writeText(recipe.name || recipe.title);
    toast({
      title: "Copied!",
      description: "Recipe name copied to clipboard",
    });
  };

  const handleToggleFavorite = async (recipe: any) => {
    if (!user?.id) return;

    try {
      // Save the recipe to "Favorites" cookbook and mark as favorited
      const userRecipeId = await saveRecipe({
        userId: user.id,
        recipeType: "community",
        cookbookCategory: "favorites",
        title: recipe.name,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        ingredients: recipe.ingredients || [],
        instructions: recipe.steps || [],
        servings: recipe.servings,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        time_minutes: recipe.time_minutes,
        cuisine: recipe.cuisine,
        diet: recipe.diet,
        category: recipe.category,
        communityRecipeId: recipe._id,
        isFavorited: true, // Mark as favorited
      });

      toast({
        title: "Favorited!",
        description: "Recipe added to your Favorites",
      });
    } catch (error) {
      console.error("Toggle favorite error:", error);
      toast({
        title: "Error",
        description: "Failed to favorite recipe",
        variant: "destructive",
      });
    }
  };

  // ============ DEBUGGING: User State ============
  console.log("=== [COMMUNITY PAGE] Render ===");
  console.log("[USER] isLoaded:", isLoaded);
  console.log("[USER] isSignedIn:", isSignedIn);
  console.log("[USER] user.id:", user?.id || "❌ No user ID");
  console.log("[USER] user.firstName:", user?.firstName || "N/A");
  console.log("[USER] user.email:", user?.emailAddresses?.[0]?.emailAddress || "N/A");
  console.log("[COMMUNITY] ID:", communityId);
  console.log("[COMMUNITY] Data:", community);

  // Show sign-in prompt if user is not authenticated
  if (isLoaded && !isSignedIn) {
    console.warn("⚠️ [USER] User is NOT signed in - showing sign-in prompt");
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <LogIn className="w-16 h-16 text-healthymama-logo-pink mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">
            Please sign in to access the community and use features like AI Chat and Recipe Extractor.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => router.push('/sign-in')}
              className="bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Button
              onClick={() => router.push('/sign-up')}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Create Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Guard: user must exist (safety check without spinner)
  if (!user) {
    return <div className="min-h-screen bg-[#FAFAFA]" />;
  }

  // Guard: community still loading (safety check without spinner)
  if (community === undefined) {
    return <div className="min-h-screen bg-[#FAFAFA]" />;
  }

  // Show error if community not found
  if (community === null) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Community Not Found</h2>
          <p className="text-gray-600 mb-6">
            The community you're looking for doesn't exist or has been removed.
          </p>
          <Button
            onClick={() => router.push('/')}
            className="bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Browse Communities
          </Button>
        </div>
      </div>
    );
  }

  // User is authenticated - log it
  console.log("✅ [USER] User authenticated successfully");
  console.log("📌 [USER] Passing user.id to components:", user.id);
  console.log("📌 [COMMUNITY] Loading community:", community.name);

  return (
    <div className="h-screen flex flex-col bg-pink-50/30 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-700 hover:text-healthymama-logo-pink hover:bg-pink-50"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <CommunitySwitcher
            userId={user.id}
            currentCommunityId={communityId as Id<"communities">}
            currentCommunityName={community.name}
            memberCount={community.memberCount}
            isPublic={community.isPublic}
          />
        </div>
      </header>

      {/* Tab Navigation - Access controlled via redirect above */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className={`flex-shrink-0 w-full bg-white border-b border-gray-200 rounded-none h-12 grid ${isCreator ? 'grid-cols-3' : 'grid-cols-2'} p-0`}>
          <TabsTrigger
            value="meals"
            className="rounded-none bg-white text-gray-600 hover:bg-pink-50 hover:text-healthymama-logo-pink transition-colors data-[state=active]:bg-white data-[state=active]:text-healthymama-logo-pink data-[state=active]:border-b-2 data-[state=active]:border-healthymama-logo-pink"
          >
            Recipes
          </TabsTrigger>
          <TabsTrigger
            value="ai-chat"
            className="rounded-none bg-white text-gray-600 hover:bg-pink-50 hover:text-healthymama-logo-pink transition-colors data-[state=active]:bg-white data-[state=active]:text-healthymama-logo-pink data-[state=active]:border-b-2 data-[state=active]:border-healthymama-logo-pink"
          >
            AI Chat
          </TabsTrigger>
          {isCreator && (
            <TabsTrigger
              value="extractor"
              className="rounded-none bg-white text-gray-600 hover:bg-pink-50 hover:text-healthymama-logo-pink transition-colors data-[state=active]:bg-white data-[state=active]:text-healthymama-logo-pink data-[state=active]:border-b-2 data-[state=active]:border-healthymama-logo-pink"
            >
              Extractor
            </TabsTrigger>
          )}
        </TabsList>

        {/* Cookbook Selection Sheet */}
        {selectedRecipeForCookbook && user?.id && (
          <CookbookSelectionSheet
            isOpen={isCookbookSelectionOpen}
            onClose={() => {
              setIsCookbookSelectionOpen(false);
              setSelectedRecipeForCookbook(null);
            }}
            recipe={selectedRecipeForCookbook}
            onSelectCookbook={handleSelectCookbook}
            onSelectSharedCookbook={handleSelectSharedCookbook}
          />
        )}

        {/* Recipes Tab Content */}
        <TabsContent value="meals" className="flex-1 overflow-y-auto p-4 bg-pink-50/30 self-start w-full">
          <div className="max-w-7xl mx-auto">
            {/* Filter Pills */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {["recent", "breakfast", "lunch", "dinner", "baking", "sweets"].map((filter) => (
                <Button
                  key={filter}
                  variant={activeFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-shrink-0 ${
                    activeFilter === filter
                      ? "bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-pink-50 hover:text-healthymama-logo-pink"
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>

            {/* Recipes Display */}
            {filteredRecipes && filteredRecipes.length > 0 ? (
              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg flex items-center justify-between">
                    <span>Community Recipes ({filteredRecipes.length})</span>
                    <Badge className="bg-healthymama-logo-pink">Available Now</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-12 space-y-6">
                  <Carousel
                    opts={{
                      align: "start",
                      loop: false,
                    }}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-4">
                      {filteredRecipes.map((recipe: any) => (
                        <CarouselItem key={recipe._id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                          <UnifiedRecipeCard
                            recipe={{
                              ...recipe,
                              id: recipe._id,
                              title: recipe.name,
                              instructions: recipe.steps,
                              dietTags: recipe.dietTags,
                            }}
                            onAddToCookbook={() => handleAddToCookbook(recipe)}
                            onShare={() => handleShare(recipe)}
                            onToggleFavorite={() => handleToggleFavorite(recipe)}
                            activeFilter={activeFilter}
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="text-gray-900 border-gray-300 hover:bg-gray-100" />
                    <CarouselNext className="text-gray-900 border-gray-300 hover:bg-gray-100" />
                  </Carousel>
                </CardContent>
              </Card>
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ChefHat className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Recipes Yet</h3>
                <p className="text-gray-600 mb-6">
                  {isCreator
                    ? "Extract recipes from Instagram using the Extractor tab, then import them here!"
                    : "The community creator hasn't added any recipes yet. Check back soon!"}
                </p>
                {isCreator && (
                  <Button
                    className="bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
                    onClick={() => setActiveTab("extractor")}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Go to Extractor
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* AI Chat Tab Content */}
        <TabsContent value="ai-chat" className="flex-1 overflow-hidden bg-pink-50/30">
          <ConvexCommunityChat
            userId={user.id}
            communityId={communityId}
          />
        </TabsContent>

        {/* Extractor Tab Content - Only visible to creators */}
        {isCreator && (
          <TabsContent value="extractor" className="flex-1 overflow-y-auto p-4 bg-pink-50/30 self-start w-full">
            <ConvexExtractor
              userId={user.id}
              communityId={communityId}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
