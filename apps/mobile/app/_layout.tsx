import { Slot } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth as useClerkAuth } from "@clerk/clerk-expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileCacheWarmer } from "../components/shared/MobileCacheWarmer";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

function useAuthForConvex() {
  const { getToken, isSignedIn, isLoaded, orgId, orgRole } = useClerkAuth();
  return {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    getToken: async (options: { template?: "convex"; skipCache?: boolean }) => {
      const token = await getToken({ template: options.template, skipCache: options.skipCache });
      return token;
    },
    orgId,
    orgRole,
  };
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <ConvexProviderWithClerk client={convex} useAuth={useAuthForConvex}>
          <ConvexQueryCacheProvider>
            <SafeAreaProvider>
              <MobileCacheWarmer />
              <Slot />
            </SafeAreaProvider>
          </ConvexQueryCacheProvider>
        </ConvexProviderWithClerk>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
