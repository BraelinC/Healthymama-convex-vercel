"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@healthymama/convex";
import { Id } from "@healthymama/convex/dataModel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, ChevronDown, Check, Compass } from "lucide-react";

interface CommunitySwitcherProps {
  userId: string;
  currentCommunityId: Id<"communities">;
  currentCommunityName: string;
  memberCount: number;
  isPublic: boolean;
}

export function CommunitySwitcher({
  userId,
  currentCommunityId,
  currentCommunityName,
  memberCount,
  isPublic,
}: CommunitySwitcherProps) {
  const router = useRouter();

  // Get user's accessible communities
  const accessibleCommunities = useQuery(
    api.communities.getUserAccessibleCommunities,
    { userId }
  );

  const handleCommunitySelect = (communityId: string) => {
    if (communityId === "discover") {
      router.push("/?tab=community&discover=true");
    } else {
      router.push(`/community/${communityId}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
          <Avatar className="w-10 h-10 bg-healthymama-logo-pink">
            <AvatarFallback className="text-white font-bold">
              {currentCommunityName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-gray-900 font-semibold">
                {currentCommunityName}
              </h1>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-3 h-3" />
              <span>{memberCount} members</span>
              <Badge className="bg-healthymama-logo-pink text-white text-xs">
                {isPublic ? "Public" : "Private"}
              </Badge>
            </div>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 bg-white border-gray-200" align="start">
        <DropdownMenuLabel className="text-gray-700">
          Your Communities
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-200" />

        {/* Current Community */}
        <DropdownMenuItem
          className="flex items-center gap-3 cursor-pointer bg-pink-50 text-healthymama-logo-pink font-medium"
          disabled
        >
          <Avatar className="w-8 h-8 bg-healthymama-logo-pink">
            <AvatarFallback className="text-white text-sm font-bold">
              {currentCommunityName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">{currentCommunityName}</div>
            <div className="text-xs text-gray-500">{memberCount} members</div>
          </div>
          <Check className="w-4 h-4" />
        </DropdownMenuItem>

        {/* Other Communities */}
        {accessibleCommunities &&
          accessibleCommunities
            .filter((community) => community._id !== currentCommunityId)
            .map((community) => (
              <DropdownMenuItem
                key={community._id}
                className="flex items-center gap-3 cursor-pointer hover:bg-pink-50 hover:text-healthymama-logo-pink"
                onClick={() => handleCommunitySelect(community._id)}
              >
                <Avatar className="w-8 h-8 bg-gray-400">
                  <AvatarFallback className="text-white text-sm font-bold">
                    {community.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{community.name}</div>
                  <div className="text-xs text-gray-500">
                    {community.memberCount} members
                  </div>
                </div>
              </DropdownMenuItem>
            ))}

        {accessibleCommunities && accessibleCommunities.length === 1 && (
          <div className="px-2 py-3 text-sm text-gray-500 text-center">
            No other communities yet
          </div>
        )}

        <DropdownMenuSeparator className="bg-gray-200" />

        {/* Discover Communities */}
        <DropdownMenuItem
          className="flex items-center gap-3 cursor-pointer hover:bg-pink-50 hover:text-healthymama-logo-pink font-medium"
          onClick={() => handleCommunitySelect("discover")}
        >
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-healthymama-red to-healthymama-pink rounded-md">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <span>Discover Communities</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
