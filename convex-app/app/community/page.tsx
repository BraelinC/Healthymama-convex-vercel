"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConvexCommunityChat from "@/components/chat/ConvexCommunityChat";
import ConvexExtractor from "@/components/shared/ConvexExtractor";
import ConvexDebugger from "@/components/shared/ConvexDebugger";
import {
  Users,
  ChefHat,
  MessageSquare,
  ArrowLeft,
  Plus,
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  LogIn,
  UserCircle,
  Settings,
  LogOut
} from "lucide-react";

// Mock community data
const MOCK_COMMUNITY = {
  id: "community_1",
  name: "Godsplan",
  description: "Become your best self and meet the best of others",
  category: "Health",
  member_count: 2,
  is_public: true,
  cover_image: "/godsplan-cover.jpg"
};

export default function CommunityPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [activeTab, setActiveTab] = useState("community");
  const [postContent, setPostContent] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // ============ DEBUGGING: User State ============
  console.log("=== [COMMUNITY PAGE] Render ===");
  console.log("[USER] isLoaded:", isLoaded);
  console.log("[USER] isSignedIn:", isSignedIn);
  console.log("[USER] user.id:", user?.id || "❌ No user ID");
  console.log("[USER] user.firstName:", user?.firstName || "N/A");
  console.log("[USER] user.email:", user?.emailAddresses?.[0]?.emailAddress || "N/A");

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
    console.log("⏳ [USER] Still loading Clerk authentication...");

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if user is not authenticated
  if (!isSignedIn) {
    console.warn("⚠️ [USER] User is NOT signed in - showing sign-in prompt");
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <LogIn className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-gray-400 mb-6">
            Please sign in to access the {MOCK_COMMUNITY.name} community and use features like AI Chat and Recipe Extractor.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => router.push('/sign-in')}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Button
              onClick={() => router.push('/sign-up')}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Create Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated - log it
  console.log("✅ [USER] User authenticated successfully");
  console.log("📌 [USER] Passing user.id to components:", user.id);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300 hover:text-white"
              onClick={() => router.push('/communities')}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Avatar className="w-10 h-10 bg-purple-600">
              <AvatarFallback className="text-white font-bold">G</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-white font-semibold">{MOCK_COMMUNITY.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Users className="w-3 h-3" />
                <span>{MOCK_COMMUNITY.member_count} members</span>
                <Badge className="bg-emerald-600 text-white text-xs">Public</Badge>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 hover:bg-gray-700">
                <Avatar className="w-8 h-8 bg-blue-600">
                  <AvatarFallback className="text-white text-sm">
                    {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0].toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-gray-300 text-sm">{user?.firstName || user?.emailAddresses[0]?.emailAddress || "User"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-gray-800 border-gray-700" align="end">
              <DropdownMenuLabel className="text-gray-300">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem
                className="text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer"
                onClick={() => router.push('/profile')}
              >
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer"
                onClick={() => router.push('/settings')}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem
                className="text-red-400 hover:bg-gray-700 hover:text-red-300 cursor-pointer"
                onClick={() => router.push('/sign-out')}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Tab Navigation - Sticky */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="sticky top-0 z-40 w-full bg-gray-800 border-b border-gray-700 rounded-none h-12 grid grid-cols-4 p-0">
          <TabsTrigger
            value="community"
            className="rounded-none bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors data-[state=active]:bg-gray-700 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-500"
          >
            Community
          </TabsTrigger>
          <TabsTrigger
            value="meals"
            className="rounded-none bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors data-[state=active]:bg-gray-700 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-500"
          >
            Meal Plans
          </TabsTrigger>
          <TabsTrigger
            value="ai-chat"
            className="rounded-none bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors data-[state=active]:bg-gray-700 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-500"
          >
            AI Chat
          </TabsTrigger>
          <TabsTrigger
            value="extractor"
            className="rounded-none bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors data-[state=active]:bg-gray-700 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-500"
          >
            Extractor
          </TabsTrigger>
        </TabsList>

        {/* Community Tab Content */}
        <TabsContent value="community" className="p-4 bg-gray-900 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Feed Area */}
              <div className="lg:col-span-2 space-y-4">
                {/* Post Creation */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10 bg-blue-600">
                        <AvatarFallback className="text-white">B</AvatarFallback>
                      </Avatar>
                      <Input
                        placeholder="Write something..."
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Filter Pills */}
                <div className="flex gap-2 flex-wrap">
                  {["all", "updates", "discussions", "questions", "meal_shares"].map((filter) => (
                    <Button
                      key={filter}
                      variant={activeFilter === filter ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveFilter(filter)}
                      className={
                        activeFilter === filter
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700"
                      }
                    >
                      {filter === "all" ? "All" :
                       filter === "updates" ? "Updates" :
                       filter === "discussions" ? "Discussions" :
                       filter === "questions" ? "Questions" :
                       "Meal Shares"}
                    </Button>
                  ))}
                </div>

                {/* Sample Post */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 bg-teal-600">
                          <AvatarFallback className="text-white">M</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white font-medium">Matheus</p>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-600 text-white text-xs">Meal Share</Badge>
                            <span className="text-xs text-gray-400">10/5/2025, 7:30:19 PM</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white mb-3">Hello</p>
                    <div className="flex items-center gap-4 text-gray-400">
                      <button className="flex items-center gap-1 hover:text-white">
                        <Heart className="w-4 h-4" />
                        <span className="text-sm">0</span>
                      </button>
                      <button className="flex items-center gap-1 hover:text-white">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm">1</span>
                      </button>
                      <button className="flex items-center gap-1 hover:text-white">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">{MOCK_COMMUNITY.name}</CardTitle>
                    <Badge className="bg-purple-600 text-white w-fit">
                      {MOCK_COMMUNITY.category}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300 text-sm mb-4">{MOCK_COMMUNITY.description}</p>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Users className="w-4 h-4" />
                      <span>{MOCK_COMMUNITY.member_count} members</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Meal Plans Tab Content */}
        <TabsContent value="meals" className="p-4 bg-gray-900 min-h-screen">
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
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700"
                  }
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ChefHat className="w-16 h-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Recipes Yet</h3>
              <p className="text-gray-400 mb-6">Create your first recipe to get started!</p>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
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
        <TabsContent value="ai-chat" className="bg-gray-900 h-screen">
          <ConvexCommunityChat
            userId={user.id}
            communityId={MOCK_COMMUNITY.id}
          />
        </TabsContent>

        {/* Extractor Tab Content */}
        <TabsContent value="extractor" className="p-4 bg-gray-900 min-h-screen">
          <ConvexExtractor
            userId={user.id}
            communityId={MOCK_COMMUNITY.id}
          />
        </TabsContent>
      </Tabs>

      {/* Debug Panel */}
      <ConvexDebugger />
    </div>
  );
}
