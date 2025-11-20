"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareRecipeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: Id<"userRecipes">;
  recipeTitle: string;
  userId: string;
}

export function ShareRecipeSheet({
  isOpen,
  onClose,
  recipeId,
  recipeTitle,
  userId,
}: ShareRecipeSheetProps) {
  const { toast } = useToast();
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  // Get friends list
  const friends = useQuery(
    api.friends.getFriends,
    userId ? { userId } : "skip"
  );

  // Get who this recipe has been shared with
  const existingShares = useQuery(
    api.sharing.getSharesForRecipe,
    userId && recipeId ? { userId, recipeId } : "skip"
  );

  // Share recipe mutation
  const shareRecipeMutation = useMutation(api.sharing.shareRecipe);

  // Handle share
  const handleShare = async () => {
    if (!selectedFriendId) {
      toast({
        title: "Please select a friend",
        variant: "destructive",
      });
      return;
    }

    setIsSharing(true);
    try {
      await shareRecipeMutation({
        fromUserId: userId,
        toUserId: selectedFriendId,
        recipeId,
        message: message.trim() || undefined,
      });

      toast({
        title: "Recipe shared!",
        description: `${recipeTitle} was shared successfully.`,
      });

      setSelectedFriendId(null);
      setMessage("");
      onClose();
    } catch (error: any) {
      toast({
        title: "Error sharing recipe",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Check if already shared with a friend
  const isAlreadyShared = (friendId: string) => {
    return existingShares?.some((share) => share.toUserId === friendId);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="w-full sm:max-w-md mx-auto overflow-y-auto rounded-t-2xl max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>Share Recipe</SheetTitle>
          <SheetDescription>
            Share "{recipeTitle}" with your friends
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Already Shared With Section */}
          {existingShares && existingShares.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Already shared with:
              </h3>
              <div className="flex flex-wrap gap-2">
                {existingShares.map((share) => (
                  <div
                    key={share._id}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-full"
                  >
                    <Avatar className="w-6 h-6 bg-healthymama-logo-pink">
                      <AvatarFallback className="text-white text-xs">
                        {share.recipientName[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-700">{share.recipientName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Select a friend:
            </h3>

            {friends && friends.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {friends.map((friend) => {
                  const alreadyShared = isAlreadyShared(friend.userId);
                  return (
                    <button
                      key={friend.userId}
                      onClick={() => !alreadyShared && setSelectedFriendId(friend.userId)}
                      disabled={alreadyShared}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        selectedFriendId === friend.userId
                          ? "border-healthymama-pink bg-pink-50"
                          : alreadyShared
                          ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                          : "border-gray-200 hover:border-healthymama-pink hover:bg-pink-50"
                      }`}
                    >
                      <Avatar className="w-10 h-10 bg-healthymama-logo-pink">
                        <AvatarFallback className="text-white">
                          {friend.name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900">{friend.name}</p>
                        <p className="text-sm text-gray-500">{friend.email}</p>
                      </div>
                      {alreadyShared && (
                        <Check className="w-5 h-5 text-green-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No friends yet</p>
                <p className="text-sm mt-1">
                  Add friends from the Social page to share recipes
                </p>
              </div>
            )}
          </div>

          {/* Optional Message */}
          {selectedFriendId && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Add a message (optional)
              </label>
              <Textarea
                placeholder="Hey, you should try this recipe!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          )}

          {/* Share Button */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              className="flex-1 bg-healthymama-pink hover:bg-healthymama-pink/90"
              disabled={!selectedFriendId || isSharing}
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                "Share Recipe"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
