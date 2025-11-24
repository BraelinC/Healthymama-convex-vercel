"use client";

import { ReactNode, useEffect, useState } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { GlobalCacheWarmer } from "./GlobalCacheWarmer";
import { UserJotIdentifier } from "./UserJotIdentifier";

type Props = {
  children: ReactNode;
};

// ============ DEBUGGING: Environment Variables ============
console.log("=== [CONVEX PROVIDER] Environment Check ===");
console.log("[ENV] NEXT_PUBLIC_CONVEX_URL:", process.env.NEXT_PUBLIC_CONVEX_URL);
console.log("[ENV] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:",
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? `${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.substring(0, 15)}...`
    : "❌ NOT FOUND"
);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("❌ [ENV] NEXT_PUBLIC_CONVEX_URL is missing!");
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not defined. Add it to your environment (e.g. `.env.local`) so ConvexProvider can initialise."
  );
}

console.log("✅ [CONVEX] Creating ConvexReactClient with URL:", convexUrl);
const convexClient = new ConvexReactClient(convexUrl);
console.log("✅ [CONVEX] ConvexReactClient created successfully");

// Wrapper component to debug auth state
function ConvexProviderWithDebug({ children }: Props) {
  const auth = useAuth();

  useEffect(() => {
    console.log("=== [CLERK AUTH] State Update ===");
    console.log("[CLERK] isLoaded:", auth.isLoaded);
    console.log("[CLERK] isSignedIn:", auth.isSignedIn);
    console.log("[CLERK] userId:", auth.userId || "❌ No userId");
    console.log("[CLERK] sessionId:", auth.sessionId || "❌ No sessionId");

    if (auth.isLoaded && !auth.isSignedIn) {
      console.warn("⚠️ [CLERK] User is NOT signed in!");
    } else if (auth.isLoaded && auth.isSignedIn) {
      console.log("✅ [CLERK] User is signed in with ID:", auth.userId);
    }
  }, [auth.isLoaded, auth.isSignedIn, auth.userId, auth.sessionId]);

  return (
    <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
      <ConvexQueryCacheProvider>
        <GlobalCacheWarmer />
        <UserJotIdentifier />
        {children}
      </ConvexQueryCacheProvider>
    </ConvexProviderWithClerk>
  );
}

export function HealthyMamaConvexProvider({ children }: Props) {
  console.log("🚀 [CONVEX PROVIDER] Mounting provider...");

  // Create QueryClient instance (client-side only to avoid SSR issues)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
      },
    },
  }));

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <QueryClientProvider client={queryClient}>
        <ConvexProviderWithDebug>{children}</ConvexProviderWithDebug>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
