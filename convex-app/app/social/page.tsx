"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search, UserPlus, Check, X, Users, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { CreateSharedCookbookModal } from "@/components/cookbook/CreateSharedCookbookModal";

export default function SocialPage() {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);

  // Shared cookbook modal state
  const [isSharedCookbookModalOpen, setIsSharedCookbookModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<{
    userId: string;
    name: string;
    email: string;
  } | null>(null);

  // Queries
  const recipesSharedWithMe = useQuery(
    api.sharing.getRecipesSharedWithMe,
    user?.id ? { userId: user.id } : "skip"
  );

  const recipesSharedByMe = useQuery(
    api.sharing.getRecipesSharedByMe,
    user?.id ? { userId: user.id } : "skip"
  );

  const friends = useQuery(
    api.friends.getFriends,
    user?.id ? { userId: user.id } : "skip"
  );

  const pendingRequests = useQuery(
    api.friends.getPendingFriendRequests,
    user?.id ? { userId: user.id } : "skip"
  );

  // Mutations
  const searchUser = useQuery(
    api.friends.searchUserByEmail,
    user?.id && searchEmail.length > 3
      ? { email: searchEmail, currentUserId: user.id }
      : "skip"
  );

  const sendFriendRequest = useMutation(api.friends.sendFriendRequest);
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const declineRequest = useMutation(api.friends.declineFriendRequest);
  const markAsViewed = useMutation(api.sharing.markShareAsViewed);

  // Handle friend request
  const handleSendFriendRequest = async (toUserId: string) => {
    if (!user?.id) return;

    try {
      await sendFriendRequest({
        fromUserId: user.id,
        toUserId,
      });
      toast({
        title: "Friend request sent!",
        description: "They'll be notified of your request.",
      });
      setSearchEmail("");
      setSearchResult(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send friend request",
        variant: "destructive",
      });
    }
  };

  // Handle accept friend request
  const handleAcceptRequest = async (friendshipId: string) => {
    if (!user?.id) return;

    try {
      await acceptRequest({
        userId: user.id,
        friendshipId: friendshipId as any,
      });
      toast({
        title: "Friend request accepted!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept request",
        variant: "destructive",
      });
    }
  };

  // Handle decline friend request
  const handleDeclineRequest = async (friendshipId: string) => {
    if (!user?.id) return;

    try {
      await declineRequest({
        userId: user.id,
        friendshipId: friendshipId as any,
      });
      toast({
        title: "Friend request declined",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to decline request",
        variant: "destructive",
      });
    }
  };

  // Mark share as viewed when user clicks on it
  const handleViewRecipe = async (shareId: string) => {
    try {
      await markAsViewed({ shareId: shareId as any });
    } catch (error) {
      console.error("Failed to mark as viewed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Social</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="received">
              Received ({recipesSharedWithMe?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="shared">
              Shared ({recipesSharedByMe?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="friends">
              Friends ({friends?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Recipes Shared With Me */}
          <TabsContent value="received" className="space-y-4">
            {recipesSharedWithMe && recipesSharedWithMe.length > 0 ? (
              recipesSharedWithMe.map((share) => (
                <Card key={share._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Recipe Image */}
                      {share.recipeImageUrl ? (
                        <img
                          src={share.recipeImageUrl}
                          alt={share.recipeTitle}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                          <span className="text-gray-400 text-sm">No image</span>
                        </div>
                      )}

                      {/* Recipe Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900">
                              {share.recipeTitle}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Shared by <span className="font-medium">{share.senderName}</span>
                            </p>
                            {share.message && (
                              <p className="text-sm text-gray-500 mt-2 italic">"{share.message}"</p>
                            )}
                          </div>
                          {share.status === "unread" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                              New
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            onClick={() => {
                              handleViewRecipe(share._id);
                              router.push(`/recipe/${share.recipeId}`);
                            }}
                          >
                            View Recipe
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500">No recipes shared with you yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Recipes I've Shared */}
          <TabsContent value="shared" className="space-y-4">
            {recipesSharedByMe && recipesSharedByMe.length > 0 ? (
              recipesSharedByMe.map((share) => (
                <Card key={share._id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {share.recipeImageUrl ? (
                        <img
                          src={share.recipeImageUrl}
                          alt={share.recipeTitle}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-200 rounded-lg" />
                      )}

                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {share.recipeTitle}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Shared with <span className="font-medium">{share.recipientName}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(share.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500">You haven't shared any recipes yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends" className="space-y-6">
            {/* Add Friend Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Friend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      type="email"
                      placeholder="Search by email..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Search Result */}
                {searchUser && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 bg-healthymama-logo-pink">
                        <AvatarFallback className="text-white">
                          {searchUser.name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900">{searchUser.name}</p>
                        <p className="text-sm text-gray-500">{searchUser.email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSendFriendRequest(searchUser.userId)}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Friend
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Requests */}
            {pendingRequests && pendingRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pending Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.friendshipId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 bg-healthymama-logo-pink">
                          <AvatarFallback className="text-white">
                            {request.requesterName[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">{request.requesterName}</p>
                          <p className="text-sm text-gray-500">{request.requesterEmail}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcceptRequest(request.friendshipId)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineRequest(request.friendshipId)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Friends List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  My Friends
                </CardTitle>
              </CardHeader>
              <CardContent>
                {friends && friends.length > 0 ? (
                  <div className="space-y-3">
                    {friends.map((friend) => (
                      <div
                        key={friend.userId}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <Avatar className="w-10 h-10 bg-healthymama-logo-pink">
                          <AvatarFallback className="text-white">
                            {friend.name[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{friend.name}</p>
                          <p className="text-sm text-gray-500">{friend.email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-healthymama-pink border-healthymama-pink hover:bg-pink-50"
                          onClick={() => {
                            setSelectedFriend({
                              userId: friend.userId,
                              name: friend.name,
                              email: friend.email,
                            });
                            setIsSharedCookbookModalOpen(true);
                          }}
                        >
                          <Shuffle className="w-4 h-4 mr-1" />
                          Remix
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No friends yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Search for friends by email to get started
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Shared Cookbook Modal */}
      <CreateSharedCookbookModal
        open={isSharedCookbookModalOpen}
        onOpenChange={setIsSharedCookbookModalOpen}
        friend={selectedFriend}
        onSuccess={(cookbookId) => {
          toast({
            title: "Shared cookbook created!",
            description: `You can now share recipes with ${selectedFriend?.name}`,
          });
          setSelectedFriend(null);
        }}
      />
    </div>
  );
}
