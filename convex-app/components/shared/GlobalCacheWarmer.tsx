"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * GlobalCacheWarmer
 *
 * Pre-warms memory cache when user enters app (any page)
 * - Runs once per app session when userId becomes available
 * - Initializes cache for most recent chat session
 * - Cache auto-expires after 2 min inactivity
 * - Silent background operation - no UI impact
 *
 * Benefits:
 * - First message: ~893ms → ~50ms (cache hit instead of miss)
 * - Saves ~850ms on preprocessing time
 */
export function GlobalCacheWarmer() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const hasWarmedCache = useRef(false);

  // Get user's sessions (sorted by most recent)
  const sessions = useQuery(
    api.chat.communitychat.listSessions,
    userId && isSignedIn ? { userId, communityId: "community_1" } : "skip"
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

  // No UI - silent background operation
  return null;
}
