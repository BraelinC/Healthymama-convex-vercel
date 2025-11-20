/**
 * Instagram Account Management - Convex Backend
 *
 * This file provides mutations and queries for managing multiple Instagram accounts
 * with round-robin rotation for scaling to 100+ video extractions per hour.
 *
 * Architecture:
 * - Convex stores multiple Instagram accounts with credentials
 * - Railway Python service calls Convex API to get next available account
 * - Round-robin rotation: use account with oldest lastUsedAt timestamp
 * - Health tracking: mark accounts as rate_limited/banned/login_failed
 * - Auto-skip unhealthy accounts when rotating
 *
 * Rotation Strategy (Round-Robin):
 * 1. Query all active accounts (isActive=true, status="active")
 * 2. Sort by lastUsedAt ascending (oldest first)
 * 3. Return account with oldest lastUsedAt (or never used)
 * 4. After use, update lastUsedAt and increment usageCount
 *
 * Rate Limiting Strategy:
 * - Instagram limits: ~200 requests/hour per account
 * - With 1 account: max 50-100 videos/hour (safe)
 * - With 5 accounts: max 250-500 videos/hour
 * - Rotation distributes load evenly across accounts
 *
 * Error Recovery:
 * - If login fails: mark status="login_failed", skip in rotation
 * - If rate limited: mark status="rate_limited", skip for 1 hour
 * - If banned: mark status="banned", skip permanently
 * - Admin can manually reactivate accounts via updateAccountStatus
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Add a new Instagram account to the rotation pool
 *
 * This mutation creates a new Instagram account entry in the database.
 * The account is immediately available for rotation if isActive=true.
 *
 * @param username - Instagram username (e.g., "healthymama_bot1")
 * @param password - Instagram password (stored securely in Convex)
 * @param proxyUrl - Optional proxy URL (e.g., "http://user:pass@proxy.com:8080")
 * @param notes - Optional admin notes (e.g., "Primary account", "Backup #2")
 *
 * @returns {accountId: string} - The created account ID
 *
 * Security Notes:
 * - Passwords are stored in Convex (encrypted at rest)
 * - Consider using dedicated Instagram accounts (not personal)
 * - Use strong, unique passwords for each account
 * - Enable 2FA on Instagram accounts (may require app passwords)
 */
export const addAccount = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    proxyUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { username, password, proxyUrl, notes } = args;

    // Check for duplicate username
    const existingAccount = await ctx.db
      .query("instagramAccounts")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (existingAccount) {
      throw new Error(`Instagram account with username "${username}" already exists`);
    }

    // Create new account
    const accountId = await ctx.db.insert("instagramAccounts", {
      username,
      password,
      isActive: true, // Active by default
      lastUsedAt: undefined, // Never used yet
      usageCount: 0,
      status: "active",
      proxyUrl,
      notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`[Instagram Accounts] ✅ Added account: ${username} (${accountId})`);

    return { accountId };
  },
});

/**
 * Get the next available Instagram account (Round-Robin Rotation)
 *
 * This query implements the round-robin rotation strategy by returning
 * the active account that was used least recently (oldest lastUsedAt).
 *
 * Process:
 * 1. Query all accounts where isActive=true AND status="active"
 * 2. Sort by lastUsedAt ascending (null values first = never used)
 * 3. Return the first account (least recently used)
 * 4. Caller must call updateLastUsed() after successfully using the account
 *
 * @returns {username, password, accountId, proxyUrl} or null if no accounts available
 *
 * Error Cases:
 * - No accounts in database: returns null
 * - All accounts inactive/unhealthy: returns null
 * - Caller should handle null by showing error to user
 *
 * Usage Pattern (Railway Service):
 * ```python
 * # 1. Get next account from Convex
 * account = convex.query("instagramAccounts:getNextAccount")
 *
 * # 2. Use account to fetch Instagram data
 * client = Client()
 * client.login(account.username, account.password)
 * media = client.media_info(media_pk)
 *
 * # 3. Update usage timestamp (success)
 * convex.mutation("instagramAccounts:updateLastUsed", {accountId: account.accountId})
 *
 * # 4. Handle errors (mark unhealthy if needed)
 * except LoginRequired:
 *   convex.mutation("instagramAccounts:updateAccountStatus", {
 *     accountId: account.accountId,
 *     status: "login_failed"
 *   })
 * ```
 */
export const getNextAccount = query({
  args: {},
  handler: async (ctx) => {
    // Get all active accounts with "active" status
    const activeAccounts = await ctx.db
      .query("instagramAccounts")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    if (activeAccounts.length === 0) {
      console.log("[Instagram Accounts] ⚠️ No active accounts available");
      return null;
    }

    // Sort by lastUsedAt ascending (null/undefined first = never used)
    // This implements round-robin: always use the least recently used account
    activeAccounts.sort((a, b) => {
      // Never-used accounts (lastUsedAt = undefined) should come first
      if (a.lastUsedAt === undefined && b.lastUsedAt === undefined) return 0;
      if (a.lastUsedAt === undefined) return -1;
      if (b.lastUsedAt === undefined) return 1;
      return a.lastUsedAt - b.lastUsedAt;
    });

    const nextAccount = activeAccounts[0];

    console.log(
      `[Instagram Accounts] 🔄 Rotating to account: ${nextAccount.username} ` +
      `(used ${nextAccount.usageCount} times, last used: ${nextAccount.lastUsedAt ? new Date(nextAccount.lastUsedAt).toISOString() : "never"})`
    );

    return {
      accountId: nextAccount._id,
      username: nextAccount.username,
      password: nextAccount.password,
      proxyUrl: nextAccount.proxyUrl,
    };
  },
});

/**
 * Update account after successful use
 *
 * Call this mutation immediately after successfully using an Instagram account
 * to fetch data. This updates the rotation tracking fields.
 *
 * @param accountId - The account ID that was just used
 *
 * Updates:
 * - lastUsedAt: current timestamp (for round-robin rotation)
 * - usageCount: incremented by 1 (for analytics)
 * - updatedAt: current timestamp
 *
 * Error Cases:
 * - Account not found: throws error
 */
export const updateLastUsed = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
  },
  handler: async (ctx, { accountId }) => {
    const account = await ctx.db.get(accountId);

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const now = Date.now();

    await ctx.db.patch(accountId, {
      lastUsedAt: now,
      usageCount: account.usageCount + 1,
      updatedAt: now,
    });

    console.log(
      `[Instagram Accounts] ✅ Updated usage for ${account.username} ` +
      `(total uses: ${account.usageCount + 1})`
    );

    return { success: true };
  },
});

/**
 * Update account status (health tracking)
 *
 * Call this mutation when an account encounters errors or needs status changes.
 * Accounts with status != "active" are automatically skipped in rotation.
 *
 * @param accountId - The account ID to update
 * @param status - New status: "active" | "rate_limited" | "banned" | "login_failed"
 * @param isActive - Optional: set to false to completely disable account
 *
 * Status Meanings:
 * - active: Account is healthy and ready for use
 * - rate_limited: Instagram rate limit detected (skip for 1 hour, then manually reactivate)
 * - banned: Account blocked by Instagram (skip permanently until manually reactivated)
 * - login_failed: Invalid credentials or 2FA issues (fix credentials, then reactivate)
 *
 * Error Recovery Workflow:
 * 1. Railway service detects error (e.g., LoginRequired exception)
 * 2. Call updateAccountStatus with appropriate status
 * 3. Rotation automatically skips this account
 * 4. Admin investigates and fixes issue
 * 5. Admin calls updateAccountStatus({status: "active", isActive: true}) to reactivate
 */
export const updateAccountStatus = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    status: v.union(
      v.literal("active"),
      v.literal("rate_limited"),
      v.literal("banned"),
      v.literal("login_failed")
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { accountId, status, isActive }) => {
    const account = await ctx.db.get(accountId);

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const updates: any = {
      status,
      updatedAt: Date.now(),
    };

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    await ctx.db.patch(accountId, updates);

    console.log(
      `[Instagram Accounts] 🔧 Status updated for ${account.username}: ` +
      `${status}${isActive !== undefined ? `, isActive=${isActive}` : ""}`
    );

    return { success: true };
  },
});

/**
 * List all Instagram accounts with their status
 *
 * Returns all accounts in the database with their health and usage statistics.
 * Useful for admin dashboard or debugging rotation issues.
 *
 * @returns Array of accounts with full details
 */
export const listAccounts = query({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("instagramAccounts").collect();

    // Sort by createdAt (newest first)
    accounts.sort((a, b) => b.createdAt - a.createdAt);

    return accounts.map((account) => ({
      accountId: account._id,
      username: account.username,
      isActive: account.isActive,
      status: account.status,
      usageCount: account.usageCount,
      lastUsedAt: account.lastUsedAt,
      proxyUrl: account.proxyUrl,
      notes: account.notes,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      // Don't return password for security
    }));
  },
});

/**
 * Delete an Instagram account
 *
 * Permanently removes an account from the rotation pool.
 * Use with caution - consider setting isActive=false instead if you might need it later.
 *
 * @param accountId - The account ID to delete
 */
export const deleteAccount = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
  },
  handler: async (ctx, { accountId }) => {
    const account = await ctx.db.get(accountId);

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    await ctx.db.delete(accountId);

    console.log(`[Instagram Accounts] 🗑️ Deleted account: ${account.username}`);

    return { success: true };
  },
});

/**
 * Get account statistics (for analytics/monitoring)
 *
 * Returns aggregate stats across all accounts:
 * - Total accounts
 * - Active accounts
 * - Total usage count
 * - Status breakdown
 */
export const getAccountStats = query({
  args: {},
  handler: async (ctx) => {
    const allAccounts = await ctx.db.query("instagramAccounts").collect();

    const totalAccounts = allAccounts.length;
    const activeAccounts = allAccounts.filter((a) => a.isActive && a.status === "active").length;
    const totalUsage = allAccounts.reduce((sum, a) => sum + a.usageCount, 0);

    const statusBreakdown = {
      active: allAccounts.filter((a) => a.status === "active").length,
      rate_limited: allAccounts.filter((a) => a.status === "rate_limited").length,
      banned: allAccounts.filter((a) => a.status === "banned").length,
      login_failed: allAccounts.filter((a) => a.status === "login_failed").length,
    };

    return {
      totalAccounts,
      activeAccounts,
      totalUsage,
      statusBreakdown,
      averageUsagePerAccount: totalAccounts > 0 ? Math.round(totalUsage / totalAccounts) : 0,
    };
  },
});
