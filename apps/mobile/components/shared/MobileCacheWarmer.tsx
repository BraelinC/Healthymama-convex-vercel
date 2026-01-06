import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@healthymama/convex";
import { Image } from "expo-image";

/**
 * MobileCacheWarmer
 *
 * Pre-warms memory cache when user enters app
 * - Runs once per app session when userId becomes available
 * - Pre-fetches user's recipes for instant cookbook loading
 * - Pre-fetches discovered recipes for instant discover page
 * - Preloads recipe images into disk cache for instant display
 *
 * Benefits:
 * - Recipe data: Instant load on navigation (cache hit instead of loading)
 * - Recipe images: Pre-cached on disk for instant display
 * - Same pattern as web app's GlobalCacheWarmer
 */
export function MobileCacheWarmer() {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const hasWarmedCache = useRef(false);
  const hasPreloadedImages = useRef(false);

  // Prefetch user's recipes (auto-cached via ConvexQueryCacheProvider)
  const userRecipes = useQuery(
    api.recipes.userRecipes.listUserRecipes,
    userId && isSignedIn ? {} : "skip"
  );

  // Prefetch discovered recipes for the Discover tab
  const discoveredRecipes = useQuery(
    api.discover.getAllExtractedRecipes,
    userId && isSignedIn ? { limit: 30 } : "skip"
  );

  // Log cache warming status
  useEffect(() => {
    if (hasWarmedCache.current) return;
    if (!isLoaded || !isSignedIn || !userId) return;

    if (userRecipes !== undefined && discoveredRecipes !== undefined) {
      console.log("[MobileCacheWarmer] Cache pre-warmed:", {
        userRecipes: userRecipes?.length || 0,
        discoveredRecipes: discoveredRecipes?.recipes?.length || 0,
      });
      hasWarmedCache.current = true;
    }
  }, [isLoaded, isSignedIn, userId, userRecipes, discoveredRecipes]);

  // Preload recipe images into disk cache for instant display
  useEffect(() => {
    if (hasPreloadedImages.current) return;

    const imageUrls: string[] = [];

    // Collect user recipe images
    if (userRecipes && Array.isArray(userRecipes)) {
      userRecipes.forEach((recipe) => {
        if (recipe.imageUrl) {
          imageUrls.push(recipe.imageUrl);
        }
      });
    }

    // Collect discovered recipe images (first 15)
    if (discoveredRecipes?.recipes) {
      discoveredRecipes.recipes.slice(0, 15).forEach((recipe: { imageUrl?: string }) => {
        if (recipe.imageUrl) {
          imageUrls.push(recipe.imageUrl);
        }
      });
    }

    if (imageUrls.length === 0) return;

    // Prefetch images using expo-image (stores to disk)
    console.log(`[MobileCacheWarmer] Preloading ${imageUrls.length} recipe images...`);

    Image.prefetch(imageUrls, { cachePolicy: "memory-disk" })
      .then(() => {
        console.log(`[MobileCacheWarmer] Successfully preloaded ${imageUrls.length} images`);
      })
      .catch((error) => {
        console.warn("[MobileCacheWarmer] Image prefetch error:", error);
      });

    hasPreloadedImages.current = true;
  }, [userRecipes, discoveredRecipes]);

  // No UI - silent background operation
  return null;
}
