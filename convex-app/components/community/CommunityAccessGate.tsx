"use client";

import { ReactNode, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";
import { CheckoutModal } from "./CheckoutModal";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

interface CommunityAccessGateProps {
  communityId: Id<"communities">;
  children: ReactNode;
}

export function CommunityAccessGate({
  communityId,
  children,
}: CommunityAccessGateProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const [showCheckout, setShowCheckout] = useState(false);

  // Get community details (HOOK 1)
  const community = useQuery(
    api.communities.get,
    communityId ? { id: communityId } : "skip"
  );

  // Calculate if free/creator (needs to be before using in skip condition)
  const isFree = community
    ? !community.monthlyPrice && !community.yearlyPrice && !community.lifetimePrice
    : false;
  const isCreator = community && user ? user.id === community.creatorId : false;

  // Check if user has access - ALWAYS call this hook (HOOK 2)
  // Use "skip" to avoid running when not needed, but still call the hook
  const accessCheck = useQuery(
    api.stripe.queries.hasAccessToCommunity,
    user?.id && communityId && !isFree && !isCreator
      ? { userId: user.id, communityId }
      : "skip"
  );

  // Auto-show checkout if no access and community is paid (HOOK 3)
  useEffect(() => {
    if (
      userLoaded &&
      user &&
      !isCreator &&
      !isFree &&
      accessCheck &&
      !accessCheck.hasAccess &&
      community &&
      (community.monthlyPrice || community.yearlyPrice || community.lifetimePrice)
    ) {
      setShowCheckout(true);
    }
  }, [accessCheck, userLoaded, user, community, isCreator, isFree]);

  // NOW we can do conditional returns (after all hooks are called)

  // Loading states
  if (!userLoaded || !community) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-healthymama-logo-pink" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Lock className="h-16 w-16 text-gray-400" />
        <h2 className="text-2xl font-bold text-gray-900">Sign in Required</h2>
        <p className="text-gray-600 text-center max-w-md">
          Please sign in to access this community
        </p>
      </div>
    );
  }

  // Grant immediate access for free communities or creators
  if (isFree || isCreator) {
    return <>{children}</>;
  }

  // Check access (loading)
  if (accessCheck === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-healthymama-logo-pink" />
      </div>
    );
  }

  // User has access
  if (accessCheck.hasAccess) {
    return <>{children}</>;
  }

  // User needs to purchase - Show paywall screen (DO NOT render protected content)
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 px-6">
      <Lock className="h-16 w-16 text-gray-400" />
      <h2 className="text-2xl font-bold text-gray-900">Subscription Required</h2>
      <p className="text-gray-600 text-center max-w-md">
        This is a premium community. Subscribe to access exclusive content, AI chat, recipe extraction, and meal plans.
      </p>
      <Button
        onClick={() => setShowCheckout(true)}
        className="bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
      >
        View Pricing Options
      </Button>
      <CheckoutModal
        open={showCheckout}
        onOpenChange={setShowCheckout}
        communityId={communityId}
        communityName={community.name}
        monthlyPrice={community.monthlyPrice}
        yearlyPrice={community.yearlyPrice}
        lifetimePrice={community.lifetimePrice}
      />
    </div>
  );
}
