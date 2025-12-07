"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { CreateStoryModal } from "./CreateStoryModal";
import { StoryViewer } from "./StoryViewer";

interface StoryUser {
  userId: string;
  userName: string;
  userEmail?: string;
  profileImageUrl?: string | null;
  stories: any[];
  hasUnviewed: boolean;
}

export function StoriesRow() {
  const { userId, isLoaded } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUserStories, setSelectedUserStories] = useState<StoryUser | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure client-side only rendering to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch friends' stories
  const friendsStories = useQuery(
    api.stories.getFriendsStories,
    userId ? { userId } : "skip"
  );

  // Fetch my own stories
  const myStories = useQuery(
    api.stories.getMyStories,
    userId ? { userId } : "skip"
  );

  // Fetch my profile image
  const myProfile = useQuery(
    api.userProfile.getUserProfileWithImage,
    userId ? { userId } : "skip"
  );

  // Don't render until mounted to avoid hydration issues
  if (!isMounted || !isLoaded) {
    return (
      <div className="mb-6">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
            <span className="text-xs text-gray-400 mt-1">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const handleStoryClick = (storyUser: StoryUser) => {
    setSelectedUserStories(storyUser);
    setIsViewerOpen(true);
  };

  const handleMyStoriesClick = () => {
    if (myStories && myStories.length > 0) {
      // View my own stories
      setSelectedUserStories({
        userId: userId!,
        userName: "Your Story",
        profileImageUrl: myProfile?.profileImageUrl || null,
        stories: myStories,
        hasUnviewed: false,
      });
      setIsViewerOpen(true);
    } else {
      // Create new story
      setIsCreateModalOpen(true);
    }
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {/* Create Story Button - Simple + button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex flex-col items-center justify-center flex-shrink-0"
          >
            <div className="w-16 h-16 bg-white border-2 border-healthymama-pink rounded-full flex items-center justify-center">
              <Plus className="w-8 h-8 text-healthymama-pink" strokeWidth={2.5} />
            </div>
          </button>

          {/* My Stories (if I have any) - no colored border */}
          {myStories && myStories.length > 0 && (
            <button
              onClick={handleMyStoriesClick}
              className="flex items-center justify-center flex-shrink-0"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden">
                {myProfile?.profileImageUrl ? (
                  <img
                    src={myProfile.profileImageUrl}
                    alt="Your story"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-600">
                      {getInitials("You")}
                    </span>
                  </div>
                )}
              </div>
            </button>
          )}

          {/* Friends' Stories */}
          {friendsStories?.map((storyUser: StoryUser) => (
            <button
              key={storyUser.userId}
              onClick={() => handleStoryClick(storyUser)}
              className="flex flex-col items-center flex-shrink-0"
            >
              <div
                className={`w-16 h-16 rounded-full p-[2px] ${
                  storyUser.hasUnviewed
                    ? "bg-gradient-to-br from-healthymama-red to-healthymama-pink"
                    : "bg-gray-300"
                }`}
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  {/* Profile image, first story thumbnail, or initials */}
                  {storyUser.profileImageUrl ? (
                    <img
                      src={storyUser.profileImageUrl}
                      alt={storyUser.userName}
                      className="w-full h-full object-cover"
                    />
                  ) : storyUser.stories[0]?.mediaUrl && storyUser.stories[0]?.mediaType === "image" ? (
                    <img
                      src={storyUser.stories[0].mediaUrl}
                      alt={storyUser.userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-gray-600">
                      {getInitials(storyUser.userName)}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-600 mt-1 max-w-16 truncate">
                {storyUser.userName}
              </span>
            </button>
          ))}

        </div>
      </div>

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Story Viewer */}
      {selectedUserStories && (
        <StoryViewer
          isOpen={isViewerOpen}
          onClose={() => {
            setIsViewerOpen(false);
            setSelectedUserStories(null);
          }}
          storyUser={selectedUserStories}
        />
      )}
    </>
  );
}
