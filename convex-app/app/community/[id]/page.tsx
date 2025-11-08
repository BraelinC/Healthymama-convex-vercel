"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConvexCommunityChat from "@/components/chat/ConvexCommunityChat";
import ConvexExtractor from "@/components/shared/ConvexExtractor";
import ConvexDebugger from "@/components/shared/ConvexDebugger";
import { CommunitySwitcher } from "@/components/community/CommunitySwitcher";
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
  const [activeTab, setActiveTab] = useState("meals");
  const [postContent, setPostContent] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // Fetch community data from Convex
  const community = useQuery(
    api.communities.getCommunityById,
    communityId ? { communityId: communityId as Id<"communities"> } : "skip"
  );

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
    <div className="h-screen flex flex-col bg-[#FAFAFA] overflow-hidden">
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
            Meal Plans
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

        {/* Meal Plans Tab Content */}
        <TabsContent value="meals" className="flex-1 overflow-y-auto p-4 bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto">
            {/* Filter Pills */}
            <div className="flex gap-2 flex-wrap mb-6">
              {["recent", "breakfast", "lunch", "dinner", "baking", "sweets"].map((filter) => (
                <Button
                  key={filter}
                  variant={filter === "recent" ? "default" : "outline"}
                  size="sm"
                  className={
                    filter === "recent"
                      ? "bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-pink-50 hover:text-healthymama-logo-pink"
                  }
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ChefHat className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Recipes Yet</h3>
              <p className="text-gray-600 mb-6">Create your first recipe to get started!</p>
              <Button className="bg-healthymama-logo-pink text-white hover:bg-[#D81B60]">
                <Plus className="w-4 h-4 mr-2" />
                Create Recipe
              </Button>
            </div>

            {/* Course Cards Grid (when not empty) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 hidden">
              {/* These will be populated dynamically */}
            </div>
          </div>
        </TabsContent>

        {/* AI Chat Tab Content */}
        <TabsContent value="ai-chat" className="flex-1 overflow-hidden bg-[#FAFAFA]">
          <ConvexCommunityChat
            userId={user.id}
            communityId={communityId}
          />
        </TabsContent>

        {/* Extractor Tab Content - Only visible to creators */}
        {isCreator && (
          <TabsContent value="extractor" className="flex-1 overflow-y-auto p-4 bg-[#FAFAFA]">
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
