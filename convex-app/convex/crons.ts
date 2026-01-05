/**
 * Convex Cron Jobs
 * Scheduled background tasks
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Expire old session caches
 * Runs every 10 minutes to clean up abandoned sessions (>30 min idle)
 * Cache now persists while user is actively on the app
 */
crons.interval(
  "expire-old-caches",
  { minutes: 10 },
  internal.memory.sessionCacheQueries.expireOldCaches
);

/**
 * Process timed-out voice sessions
 * Runs every 5 minutes to find stale voice sessions (>5 min inactive)
 * Ends them and extracts facts for memory storage
 */
crons.interval(
  "process-stale-voice-sessions",
  { minutes: 5 },
  internal.voiceSessionsActions.processTimedOutSessions
);

// REMOVED: Instagram DM polling (replaced by webhooks)
// Webhooks provide instant notifications instead of 15-second polling
// Webhook registered automatically when Instagram account is connected

export default crons;
