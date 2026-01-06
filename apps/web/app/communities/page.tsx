"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { CommunityCard } from "@/components/community/CommunityCard";
import { CreateCommunityModal } from "@/components/community/CreateCommunityModal";
import { Button } from "@/components/ui/button";
import { BookMarked, Users, Plus } from "lucide-react";

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

export default function CommunitiesPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch all communities from Convex
  const convexCommunities = useQuery(api.communities.getAllCommunities);

  // Fetch current user data to check if they're a creator
  const userData = useQuery(
    api.users.getUserProfile,
    user?.id ? { userId: user.id } : "skip"
  );

  // Mutation to create/update user
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

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

  const handleCommunityClick = (communityId: string) => {
    // Navigate to individual community page with actual ID
    router.push(`/community/${communityId}`);
  };

  const handleCreateSuccess = (communityId: string) => {
    // Navigate to the newly created community
    router.push(`/community/${communityId}`);
  };

  const isCreator = userData?.isCreator === true;

  // Debug logging
  console.log("=== [COMMUNITIES PAGE] Debug Info ===");
  console.log("[DEBUG] isLoaded:", isLoaded);
  console.log("[DEBUG] isSignedIn:", isSignedIn);
  console.log("[DEBUG] Clerk userId:", user?.id);
  console.log("[DEBUG] userData exists:", !!userData);
  console.log("[DEBUG] userData:", userData);
  console.log("[DEBUG] isCreator field:", userData?.isCreator);
  console.log("[DEBUG] isCreator final:", isCreator);
  console.log("[DEBUG] Button will show:", isLoaded && isSignedIn && isCreator);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <main className="container mx-auto px-4 py-8 pb-24">
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
                    image={community.coverImage || ""}
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

      {/* Floating Action Button - Create Community (Creators Only) */}
      {isLoaded && isSignedIn && isCreator && (
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 w-full bg-white border-t border-gray-200 h-20 grid grid-cols-2 p-0 shadow-lg">
        <button
          onClick={() => router.push('/')}
          className="h-full flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gradient-to-br hover:from-red-50 hover:to-pink-50 hover:text-healthymama-red transition-colors"
        >
          <BookMarked className="w-6 h-6" />
          <span className="text-sm font-medium">Cookbooks</span>
        </button>
        <button
          onClick={() => router.push('/?tab=community')}
          className="h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-red-50 to-pink-50 text-healthymama-red"
        >
          <Users className="w-6 h-6" />
          <span className="text-sm font-medium">Community</span>
        </button>
      </div>
    </div>
  );
}
