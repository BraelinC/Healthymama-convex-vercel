"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Loader2, Link2, X } from "lucide-react";
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
  const [sharingToId, setSharingToId] = useState<string | null>(null);
  const [recentlyShared, setRecentlyShared] = useState<Set<string>>(new Set());

  // Get friends sorted by most recently shared with
  const friends = useQuery(
    api.sharing.getFriendsForSharing,
    userId ? { userId } : "skip"
  );

  // Get who this recipe has been shared with
  const existingShares = useQuery(
    api.sharing.getSharesForRecipe,
    userId && recipeId ? { userId, recipeId } : "skip"
  );

  // Share recipe mutation
  const shareRecipeMutation = useMutation(api.sharing.shareRecipe);

  // Check if already shared with a friend
  const isAlreadyShared = (friendId: string) => {
    return existingShares?.some((share) => share.toUserId === friendId) || recentlyShared.has(friendId);
  };

  // Handle share to friend
  const handleShareToFriend = async (friendId: string, friendName: string) => {
    if (isAlreadyShared(friendId)) return;

    setSharingToId(friendId);
    try {
      await shareRecipeMutation({
        fromUserId: userId,
        toUserId: friendId,
        recipeId,
      });

      setRecentlyShared(prev => new Set(prev).add(friendId));

      toast({
        title: "Shared!",
        description: `Sent to ${friendName}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to share",
        variant: "destructive",
      });
    } finally {
      setSharingToId(null);
    }
  };

  // Handle copy link
  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/recipe/${recipeId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Recipe link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="w-full rounded-t-3xl px-4 pb-8 pt-2"
      >
        {/* Handle bar */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Share</h3>
        </div>

        {/* Friends row - horizontal scrollable */}
        <div className="mb-6">
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {/* Copy Link button - first item */}
            <button
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-2 min-w-[60px]"
            >
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <Link2 className="w-6 h-6 text-gray-600" />
              </div>
              <span className="text-xs text-gray-600 truncate max-w-[60px]">Copy link</span>
            </button>

            {/* Friend avatars */}
            {friends?.map((friend) => {
              const shared = isAlreadyShared(friend.userId);
              const isSharing = sharingToId === friend.userId;

              return (
                <button
                  key={friend.userId}
                  onClick={() => handleShareToFriend(friend.userId, friend.name)}
                  disabled={shared || isSharing}
                  className="flex flex-col items-center gap-2 min-w-[60px]"
                >
                  <div className="relative">
                    <Avatar className={`w-14 h-14 border-2 transition-all ${
                      shared
                        ? "border-green-500"
                        : "border-transparent hover:border-healthymama-pink"
                    }`}>
                      {friend.profileImageUrl ? (
                        <AvatarImage src={friend.profileImageUrl} alt={friend.name} />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-healthymama-pink to-healthymama-red text-white text-lg">
                        {friend.name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Loading or check overlay */}
                    {(isSharing || shared) && (
                      <div className={`absolute inset-0 rounded-full flex items-center justify-center ${
                        shared ? "bg-green-500/90" : "bg-black/50"
                      }`}>
                        {isSharing ? (
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : (
                          <Check className="w-5 h-5 text-white" />
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 truncate max-w-[60px]">
                    {friend.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}

            {/* Empty state */}
            {(!friends || friends.length === 0) && (
              <div className="flex-1 text-center py-4 text-gray-500 text-sm">
                Add friends to share recipes
              </div>
            )}
          </div>
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="w-full py-3 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition-colors"
        >
          Cancel
        </button>
      </SheetContent>
    </Sheet>
  );
}
