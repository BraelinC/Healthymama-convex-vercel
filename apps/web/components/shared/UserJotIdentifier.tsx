"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * UserJot User Identifier Component
 * Automatically identifies users with UserJot when they're authenticated
 */
export function UserJotIdentifier() {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    // Only identify if user is signed in and UserJot SDK is loaded
    if (isSignedIn && user && typeof window !== "undefined" && window.uj) {
      // Small delay to ensure SDK is fully initialized
      const timer = setTimeout(() => {
        try {
          window.uj.identify({
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            name: user.fullName || user.firstName || undefined,
          });
          console.log("✅ UserJot: User identified", {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
          });
        } catch (error) {
          console.error("❌ UserJot: Failed to identify user", error);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isSignedIn, user]);

  // This component doesn't render anything
  return null;
}
