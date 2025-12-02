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

// REMOVED: Instagram DM polling (replaced by webhooks)
// Webhooks provide instant notifications instead of 15-second polling
// Webhook registered automatically when Instagram account is connected

export default crons;
