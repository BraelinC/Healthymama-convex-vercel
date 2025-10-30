"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CookbooksView } from "@/components/CookbooksView";
import { CommunityCard } from "@/components/CommunityCard";
import { BookMarked, Users } from "lucide-react";

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

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("cookbooks");

  const handleCommunityClick = (communityId: string) => {
    // Navigate to individual community page
    router.push("/community");
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab Navigation - Bottom Navigation Style */}
        <TabsList className="fixed bottom-0 left-0 right-0 z-50 w-full bg-white border-t border-gray-200 rounded-none h-20 grid grid-cols-2 p-0 shadow-lg">
          <TabsTrigger
            value="cookbooks"
            className="rounded-none h-full flex flex-col items-center justify-center gap-1 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-600 data-[state=inactive]:text-gray-500"
          >
            <BookMarked className="w-6 h-6" />
            <span className="text-sm font-medium">Cookbooks</span>
          </TabsTrigger>
          <TabsTrigger
            value="community"
            className="rounded-none h-full flex flex-col items-center justify-center gap-1 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-600 data-[state=inactive]:text-gray-500"
          >
            <Users className="w-6 h-6" />
            <span className="text-sm font-medium">Community</span>
          </TabsTrigger>
        </TabsList>

        {/* Cookbooks Tab Content */}
        <TabsContent value="cookbooks" className="m-0 pb-24">
          <CookbooksView />
        </TabsContent>

        {/* Community Tab Content */}
        <TabsContent value="community" className="m-0 pb-24">
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
                  {communities.map((community) => (
                    <div key={community.id} onClick={() => handleCommunityClick(community.id)}>
                      <CommunityCard {...community} />
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
