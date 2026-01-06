"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@healthymama/convex";
import { Id } from "@healthymama/convex/dataModel";

/**
 * GlobalCacheWarmer
 *
 * Pre-warms memory cache when user enters app (any page)
 * - Runs once per app session when userId becomes available
 * - Initializes cache for most recent chat session
 * - Pre-fetches top 10 recent recipes for instant cookbook loading
 * - Pre-fetches friend stories and their attached recipes for instant story recipe loading
 * - Pre-fetches my own stories for instant viewing
 * - Preloads story images into browser cache for instant display
 * - Cache auto-expires after 2 min inactivity
 * - Silent background operation - no UI impact
 *
 * Benefits:
 * - First message: ~893ms → ~50ms (cache hit instead of miss)
 * - Cookbook recipes: ~500-1000ms → ~50ms (cache hit)
 * - Story recipes: Instant load when tapping recipe in story
 * - Story images: Pre-cached in browser for instant display
 * - Saves ~850ms on preprocessing time
 */
export function GlobalCacheWarmer() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const hasWarmedCache = useRef(false);
  const hasPreloadedImages = useRef(false);

  // Get user's sessions (sorted by most recent)
  const sessions = useQuery(
    api.chat.communitychat.listSessions,
    userId && isSignedIn ? { userId, communityId: "community_1" } : "skip"
  );

  // Prefetch top 10 recent recipes - this query auto-caches via ConvexQueryCacheProvider
  // When CookbookDetailSheet loads, it will get instant cache hits for these recipes
  const _recentRecipes = useQuery(
    api.recipes.userRecipes.getRecentRecipesForPrefetch,
    userId && isSignedIn ? { userId, limit: 10 } : "skip"
  );

  // Prefetch friend stories - this caches stories data for instant loading
  const friendStories = useQuery(
    api.stories.getFriendsStories,
    userId && isSignedIn ? { userId } : "skip"
  );

  // Prefetch my own stories - for instant viewing when tapping my story circle
  const myStories = useQuery(
    api.stories.getMyStories,
    userId && isSignedIn ? { userId } : "skip"
  );

  // Prefetch user profile for story display
  const _myProfile = useQuery(
    api.userProfile.getUserProfileWithImage,
    userId && isSignedIn ? { userId } : "skip"
  );

  // Extract recipe IDs from stories and prefetch them
  // This ensures recipes load instantly when user taps on a story recipe
  const storyRecipeIds = friendStories
    ?.flatMap((storyUser) => storyUser.stories)
    .filter((story) => story.recipeId)
    .map((story) => story.recipeId as Id<"userRecipes">)
    .slice(0, 10) || []; // Limit to 10 recipes

  // Prefetch individual story recipes - batch fetch for efficiency
  const _storyRecipe0 = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    storyRecipeIds[0] ? { recipeId: storyRecipeIds[0] } : "skip"
  );
  const _storyRecipe1 = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    storyRecipeIds[1] ? { recipeId: storyRecipeIds[1] } : "skip"
  );
  const _storyRecipe2 = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    storyRecipeIds[2] ? { recipeId: storyRecipeIds[2] } : "skip"
  );
  const _storyRecipe3 = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    storyRecipeIds[3] ? { recipeId: storyRecipeIds[3] } : "skip"
  );
  const _storyRecipe4 = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    storyRecipeIds[4] ? { recipeId: storyRecipeIds[4] } : "skip"
  );

  const initializeCache = useAction(api.memory.sessionCache.initializeSessionCache);

  useEffect(() => {
    console.log('[GlobalCache] Effect triggered:', {
      hasWarmed: hasWarmedCache.current,
      isLoaded,
      isSignedIn,
      userId: userId ? 'present' : 'missing',
      sessionsLoaded: !!sessions,
      sessionCount: sessions?.length || 0
    });

    // Only run once per app session
    if (hasWarmedCache.current) {
      console.log('[GlobalCache] Already warmed this session - skipping');
      return;
    }

    // Wait for auth to load and user to be signed in
    if (!isLoaded || !isSignedIn || !userId) {
      console.log('[GlobalCache] Waiting for auth...', { isLoaded, isSignedIn, hasUserId: !!userId });
      return;
    }

    // Wait for sessions to load
    if (!sessions) {
      console.log('[GlobalCache] Waiting for sessions to load...');
      return;
    }

    // Get most recent session (if exists)
    const recentSession = sessions[0];
    if (!recentSession) {
      console.log("[GlobalCache] No recent sessions - skipping pre-warm");
      hasWarmedCache.current = true;
      return;
    }

    // Pre-warm cache for recent session
    console.log(`[GlobalCache] 🔥 Starting pre-warm for session: ${recentSession._id}`);
    const warmStart = Date.now();

    initializeCache({
      sessionId: recentSession._id,
      userId,
    })
      .then(() => {
        const warmLatency = Date.now() - warmStart;
        console.log(`[GlobalCache] ✅ Cache pre-warmed successfully (${warmLatency}ms)`);
        hasWarmedCache.current = true;
      })
      .catch((error) => {
        console.error("[GlobalCache] ❌ Failed to pre-warm cache:", error);
        console.error("[GlobalCache] Error details:", error);
        // Don't mark as warmed so it can retry on next page load
      });
  }, [isLoaded, isSignedIn, userId, sessions, initializeCache]);

  // Preload story images into browser cache for instant display
  useEffect(() => {
    if (hasPreloadedImages.current) return;
    if (!friendStories && !myStories) return;

    const imageUrls: string[] = [];

    // Collect all story media URLs (images only - videos are streamed)
    friendStories?.forEach((storyUser) => {
      // Profile image
      if (storyUser.profileImageUrl) {
        imageUrls.push(storyUser.profileImageUrl);
      }
      // Story images (first 3 per user for thumbnails)
      storyUser.stories.slice(0, 3).forEach((story) => {
        if (story.mediaUrl && story.mediaType === "image") {
          imageUrls.push(story.mediaUrl);
        }
      });
    });

    // My story images
    myStories?.slice(0, 3).forEach((story) => {
      if (story.mediaUrl && story.mediaType === "image") {
        imageUrls.push(story.mediaUrl);
      }
    });

    if (imageUrls.length === 0) return;

    console.log(`[GlobalCache] 🖼️ Preloading ${imageUrls.length} story images...`);
    const preloadStart = Date.now();
    let loadedCount = 0;

    // Preload images using Image objects (browser will cache them)
    imageUrls.forEach((url) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === imageUrls.length) {
          const preloadTime = Date.now() - preloadStart;
          console.log(`[GlobalCache] ✅ All ${loadedCount} story images preloaded (${preloadTime}ms)`);
        }
      };
      img.onerror = () => {
        loadedCount++;
        // Still count errors to track completion
      };
      img.src = url;
    });

    hasPreloadedImages.current = true;
  }, [friendStories, myStories]);

  // No UI - silent background operation
  return null;
}
