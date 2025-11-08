"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CookbooksView } from "@/components/cookbook/CookbooksView";
import { CommunityCard } from "@/components/community/CommunityCard";
import { CreateCommunityModal } from "@/components/community/CreateCommunityModal";
import { CheckoutModal } from "@/components/community/CheckoutModal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookMarked, Users, Plus, UserCircle, Settings, LogOut, HandPlatter } from "lucide-react";
import { AuthBlockerModal } from "@/components/auth/AuthBlockerModal";

// Mock data for communities
const communities = [
  {
    id: "1",
    name: "Italian Pasta Masters",
    image: "https://images.unsplash.com/photo-1612078960243-177e68303e7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpdGFsaWFuJTIwcGFzdGElMjBjb29raW5nfGVufDF8fHx8MTc2MDU2OTA4Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.8,
    recipeCount: 156,
    memberCount: 2340,
    nationalities: ["🇮🇹 Italian"],
    creator: {
      name: "Chef Giovanni",
      avatar: "https://images.unsplash.com/photo-1759209402969-be3ea5027356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVmJTIwY29va2luZyUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjA0ODgzMDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    },
    price: 12.99,
    priceType: "month" as const,
  },
  {
    id: "2",
    name: "Asian Fusion Kitchen",
    image: "https://images.unsplash.com/photo-1687684987020-5373255b5dc3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMGZvb2QlMjBkaXNoZXN8ZW58MXx8fHwxNzYwNTY5MDg2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.9,
    recipeCount: 203,
    memberCount: 3500,
    nationalities: ["🇯🇵 Japanese", "🇹🇭 Thai", "🇰🇷 Korean"],
    creator: {
      name: "Chef Yuki",
      avatar: "https://images.unsplash.com/photo-1759209402969-be3ea5027356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVmJTIwY29va2luZyUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjA0ODgzMDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    },
    price: 15.99,
    priceType: "month" as const,
  },
  {
    id: "3",
    name: "Mexican Street Food",
    image: "https://images.unsplash.com/photo-1615818449536-f26c1e1fe0f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZXhpY2FuJTIwdGFjb3MlMjBmb29kfGVufDF8fHx8MTc2MDUzNzM5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.7,
    recipeCount: 98,
    memberCount: 1890,
    nationalities: ["🇲🇽 Mexican"],
    creator: {
      name: "Chef Maria",
      avatar: "https://images.unsplash.com/photo-1759209402969-be3ea5027356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVmJTIwY29va2luZyUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjA0ODgzMDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    },
    price: 9.99,
    priceType: "month" as const,
  },
  {
    id: "4",
    name: "French Pastry Academy",
    image: "https://images.unsplash.com/photo-1496890607984-d27fca8a68ad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVuY2glMjBwYXN0cnklMjBkZXNzZXJ0fGVufDF8fHx8MTc2MDU2OTA4N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 5.0,
    recipeCount: 127,
    memberCount: 2670,
    nationalities: ["🇫🇷 French"],
    creator: {
      name: "Chef Pierre",
      avatar: "https://images.unsplash.com/photo-1759209402969-be3ea5027356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVmJTIwY29va2luZyUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjA0ODgzMDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    },
    price: 19.99,
    priceType: "month" as const,
  },
  {
    id: "5",
    name: "Healthy Meal Prep",
    image: "https://images.unsplash.com/photo-1643750182373-b4a55a8c2801?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwc2FsYWQlMjBib3dsfGVufDF8fHx8MTc2MDUyMDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.6,
    recipeCount: 189,
    memberCount: 5200,
    nationalities: ["🌍 International"],
    creator: {
      name: "Chef Sarah",
      avatar: "https://images.unsplash.com/photo-1759209402969-be3ea5027356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVmJTIwY29va2luZyUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjA0ODgzMDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    },
    price: 0,
    priceType: "free" as const,
  },
  {
    id: "6",
    name: "Vegan Delights",
    image: "https://images.unsplash.com/photo-1643750182373-b4a55a8c2801?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwc2FsYWQlMjBib3dsfGVufDF8fHx8MTc2MDUyMDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.8,
    recipeCount: 234,
    memberCount: 4120,
    nationalities: ["🌱 Plant-Based"],
    creator: {
      name: "Chef Alex",
      avatar: "https://images.unsplash.com/photo-1759209402969-be3ea5027356?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVmJTIwY29va2luZyUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjA0ODgzMDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    },
    price: 11.99,
    priceType: "month" as const,
  },
];

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded, isSignedIn } = useUser();

  // Check URL parameters
  const discoverMode = searchParams.get("discover") === "true";
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState(tabParam || "cookbooks");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCommunityForCheckout, setSelectedCommunityForCheckout] = useState<Id<"communities"> | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // Fetch user's last visited community
  const lastVisitedCommunity = useQuery(
    api.communities.getUserLastVisitedCommunity,
    user?.id ? { userId: user.id } : "skip"
  );

  // Fetch all communities from Convex
  const convexCommunities = useQuery(api.communities.getAllCommunities);

  // Fetch current user data to check if they're a creator
  const userData = useQuery(
    api.users.getUserProfile,
    user?.id ? { userId: user.id } : "skip"
  );

  // Mutation to create/update user
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

  // Auto-redirect to last visited community when Community tab is active (unless in discover mode)
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.id && activeTab === "community" && !discoverMode) {
      if (lastVisitedCommunity && lastVisitedCommunity._id) {
        console.log("🔄 Redirecting to last visited community:", lastVisitedCommunity.name);
        router.push(`/community/${lastVisitedCommunity._id}`);
      } else if (lastVisitedCommunity === null) {
        console.log("ℹ️ No last visited community - showing list");
      }
    }
  }, [isLoaded, isSignedIn, user?.id, activeTab, lastVisitedCommunity, router, discoverMode]);

  // Auto-create user in Convex if they don't exist
  useEffect(() => {
    if (isLoaded && isSignedIn && user && userData === null) {
      console.log("🔧 User exists in Clerk but not in Convex - creating user...");
      createOrUpdateUser({
        userId: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        prefs: {
          favorites: [],
        },
      }).catch((err) => {
        console.error("❌ Failed to create user:", err);
      });
    }
  }, [isLoaded, isSignedIn, user, userData, createOrUpdateUser]);

  const handleCommunityClick = async (communityId: string) => {
    if (!isSignedIn || !user?.id) {
      // Not signed in - let AuthBlockerModal handle this
      router.push(`/community/${communityId}`);
      return;
    }

    // Find the community to check if it's paid
    const community = convexCommunities?.find(c => c._id === communityId);
    if (!community) {
      router.push(`/community/${communityId}`);
      return;
    }

    // Check if community is free
    const isFree = !community.monthlyPrice && !community.yearlyPrice && !community.lifetimePrice;
    const isCreator = user.id === community.creatorId;

    // If free or user is creator, navigate directly
    if (isFree || isCreator) {
      router.push(`/community/${communityId}`);
      return;
    }

    // Community is paid - need to check access
    // For now, show checkout modal (will check access on backend)
    setSelectedCommunityForCheckout(communityId as Id<"communities">);
    setShowCheckout(true);
  };

  const handleCreateSuccess = (communityId: string) => {
    // Navigate to the newly created community
    router.push(`/community/${communityId}`);
  };

  const isCreator = userData?.isCreator === true;

  // Check if we should show the auth blocker modal
  const showAuthModal = isLoaded && !isSignedIn;

  // Debug logging
  console.log("=== [HOME PAGE] Debug Info ===");
  console.log("[DEBUG] isLoaded:", isLoaded);
  console.log("[DEBUG] isSignedIn:", isSignedIn);
  console.log("[DEBUG] showAuthModal:", showAuthModal);
  console.log("[DEBUG] Clerk userId:", user?.id);
  console.log("[DEBUG] userData exists:", !!userData);
  console.log("[DEBUG] userData:", userData);
  console.log("[DEBUG] isCreator field:", userData?.isCreator);
  console.log("[DEBUG] isCreator final:", isCreator);
  console.log("[DEBUG] activeTab:", activeTab);
  console.log("[DEBUG] Button will show:", isLoaded && isSignedIn && isCreator && activeTab === "community");

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Auth blocker modal - shows when user is not signed in */}
      <AuthBlockerModal isOpen={showAuthModal} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab Navigation - Bottom Navigation Style */}
        <TabsList className="fixed bottom-0 left-0 right-0 z-50 w-full bg-white border-t border-gray-200 rounded-none h-20 grid grid-cols-2 p-0 shadow-lg">
          <TabsTrigger
            value="cookbooks"
            className="rounded-none h-full flex flex-col items-center justify-center gap-1 data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-50 data-[state=active]:to-pink-50 data-[state=active]:text-healthymama-red data-[state=inactive]:text-gray-500"
          >
            <BookMarked className="w-6 h-6" />
            <span className="text-sm font-medium">Cookbooks</span>
          </TabsTrigger>
          <TabsTrigger
            value="community"
            className="rounded-none h-full flex flex-col items-center justify-center gap-1 data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-50 data-[state=active]:to-pink-50 data-[state=active]:text-healthymama-red data-[state=inactive]:text-gray-500"
          >
            <Users className="w-6 h-6" />
            <span className="text-sm font-medium">Community</span>
          </TabsTrigger>
        </TabsList>

        {/* Cookbooks Tab Content */}
        <TabsContent value="cookbooks" className="m-0 pb-24">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              {/* Left side - Logo and branding */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#dc2626] to-[#ec4899] rounded-full shadow-red-glow">
                  <HandPlatter className="text-white h-6 w-6" />
                </div>
                <h1
                  className="text-xl font-bold bg-gradient-to-r from-[#dc2626] to-[#ec4899] bg-clip-text text-transparent"
                  style={{
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Healthy Mama
                </h1>
              </div>

              {/* Right side - User profile dropdown (only when signed in) */}
              {isSignedIn && user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 hover:bg-pink-50">
                      <Avatar className="w-8 h-8 bg-healthymama-logo-pink">
                        <AvatarFallback className="text-white text-sm">
                          {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0].toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-gray-700 text-sm hidden sm:inline">
                        {user?.firstName || user?.emailAddresses[0]?.emailAddress || "User"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-white border-gray-200" align="end">
                    <DropdownMenuLabel className="text-gray-700">My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gray-200" />
                    <DropdownMenuItem
                      className="text-gray-700 hover:bg-pink-50 hover:text-healthymama-logo-pink cursor-pointer"
                      onClick={() => router.push('/profile')}
                    >
                      <UserCircle className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-gray-700 hover:bg-pink-50 hover:text-healthymama-logo-pink cursor-pointer"
                      onClick={() => router.push('/settings')}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-200" />
                    <DropdownMenuItem
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      onClick={() => router.push('/sign-out')}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          <CookbooksView />
        </TabsContent>

        {/* Community Tab Content */}
        <TabsContent value="community" className="m-0 pb-24">
          {lastVisitedCommunity && lastVisitedCommunity._id && !discoverMode ? (
            // User has last visited community - blank screen while redirecting (instant)
            <div className="min-h-screen bg-[#FAFAFA]" />
          ) : (
            // No last visited community - show the discover list
            <div className="min-h-screen bg-[#FAFAFA]">
              <main className="container mx-auto px-4 py-8">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-medium mb-1">Discover Communities</h1>
                    <p className="text-gray-600 mt-1">
                      Join chef-led communities and access exclusive recipes, videos, and cooking tips
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {convexCommunities && convexCommunities.length > 0 ? (
                      convexCommunities.map((community) => (
                        <div key={community._id} onClick={() => handleCommunityClick(community._id)}>
                          <CommunityCard
                            id={community._id}
                            name={community.name}
                            image={community.coverImage}
                            rating={community.rating || 0}
                            recipeCount={community.recipeCount}
                            memberCount={community.memberCount}
                            nationalities={community.nationalities}
                            creator={community.creator}
                            price={community.price}
                            priceType={community.priceType}
                          />
                        </div>
                      ))
                    ) : (
                      communities.map((community) => (
                        <div key={community.id} onClick={() => handleCommunityClick(community.id)}>
                          <CommunityCard {...community} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </main>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Button - Create Community (Creators Only) */}
      {isLoaded && isSignedIn && isCreator && activeTab === "community" && (
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="fixed bottom-28 right-6 z-40 h-14 w-14 rounded-full bg-healthymama-logo-pink text-white shadow-lg hover:bg-[#D81B60] hover:shadow-xl transition-all"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Create Community Modal */}
      <CreateCommunityModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Checkout Modal - shown on discover page */}
      {selectedCommunityForCheckout && convexCommunities && (
        <CheckoutModal
          open={showCheckout}
          onOpenChange={setShowCheckout}
          communityId={selectedCommunityForCheckout}
          communityName={convexCommunities.find(c => c._id === selectedCommunityForCheckout)?.name || ""}
          monthlyPrice={convexCommunities.find(c => c._id === selectedCommunityForCheckout)?.monthlyPrice}
          yearlyPrice={convexCommunities.find(c => c._id === selectedCommunityForCheckout)?.yearlyPrice}
          lifetimePrice={convexCommunities.find(c => c._id === selectedCommunityForCheckout)?.lifetimePrice}
          successUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/community/${selectedCommunityForCheckout}?checkout=success`}
          cancelUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/?tab=community&discover=true`}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA]" />}>
      <HomePageContent />
    </Suspense>
  );
}
