/**
 * Blocked Recipe Domains Management
 *
 * Manages domains that return 403 errors (anti-bot protection).
 * Auto-detects and tracks blocked domains to improve extraction success rate.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

/**
 * Get all active blocked domains
 */
export const getActiveBlockedDomains = query({
  handler: async (ctx) => {
    const blocked = await ctx.db
      .query("blockedRecipeDomains")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return blocked.map(b => b.domain);
  },
});

/**
 * Get all blocked domains with metadata (for admin UI)
 */
export const getAllBlockedDomains = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("blockedRecipeDomains")
      .order("desc")
      .collect();
  },
});

/**
 * Add or update a blocked domain when a 403 error occurs
 */
export const recordDomainBlock = mutation({
  args: {
    url: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    // Extract domain from URL
    let domain: string;
    try {
      const urlObj = new URL(args.url);
      domain = urlObj.hostname.toLowerCase();
    } catch {
      console.error(`[Blocklist] Invalid URL: ${args.url}`);
      return null;
    }

    // Check if domain already exists
    const existing = await ctx.db
      .query("blockedRecipeDomains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        errorCount: existing.errorCount + 1,
        lastErrorAt: now,
        updatedAt: now,
      });

      console.log(`[Blocklist] Updated ${domain} - Total errors: ${existing.errorCount + 1}`);
      return existing._id;
    } else {
      // Create new entry
      const newId = await ctx.db.insert("blockedRecipeDomains", {
        domain,
        reason: args.errorMessage,
        errorCount: 1,
        lastErrorAt: now,
        isManualBlock: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`[Blocklist] Added new blocked domain: ${domain}`);
      return newId;
    }
  },
});

/**
 * Manually add a blocked domain
 */
export const addBlockedDomain = mutation({
  args: {
    domain: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const domain = args.domain.toLowerCase();

    // Check if already exists
    const existing = await ctx.db
      .query("blockedRecipeDomains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .first();

    if (existing) {
      throw new Error(`Domain ${domain} is already in the blocklist`);
    }

    const now = Date.now();

    return await ctx.db.insert("blockedRecipeDomains", {
      domain,
      reason: args.reason,
      errorCount: 0,
      lastErrorAt: now,
      isManualBlock: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Remove a blocked domain
 */
export const removeBlockedDomain = mutation({
  args: {
    domainId: v.id("blockedRecipeDomains"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.domainId);
  },
});

/**
 * Toggle domain active status (for testing)
 */
export const toggleDomainStatus = mutation({
  args: {
    domainId: v.id("blockedRecipeDomains"),
  },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) {
      throw new Error("Domain not found");
    }

    await ctx.db.patch(args.domainId, {
      isActive: !domain.isActive,
      updatedAt: Date.now(),
    });

    return !domain.isActive;
  },
});

/**
 * Seed initial known blocked domains
 */
export const seedBlockedDomains = mutation({
  handler: async (ctx) => {
    const knownBlockedDomains = [
      { domain: "allrecipes.com", reason: "403 Forbidden - Cloudflare protection" },
      { domain: "www.allrecipes.com", reason: "403 Forbidden - Cloudflare protection" },
      { domain: "tasteslovely.com", reason: "403 Forbidden - Anti-bot protection" },
      { domain: "www.tasteslovely.com", reason: "403 Forbidden - Anti-bot protection" },
      { domain: "food.com", reason: "403 Forbidden - Known bot blocker" },
      { domain: "www.food.com", reason: "403 Forbidden - Known bot blocker" },
      { domain: "yummly.com", reason: "403 Forbidden - Cloudflare protection" },
      { domain: "www.yummly.com", reason: "403 Forbidden - Cloudflare protection" },
      { domain: "nytimes.com", reason: "Paywalled content" },
      { domain: "www.nytimes.com", reason: "Paywalled content" },
      { domain: "bonappetit.com", reason: "403 Forbidden - Condé Nast protection" },
      { domain: "www.bonappetit.com", reason: "403 Forbidden - Condé Nast protection" },
      { domain: "epicurious.com", reason: "403 Forbidden - Condé Nast protection" },
      { domain: "www.epicurious.com", reason: "403 Forbidden - Condé Nast protection" },
    ];

    const now = Date.now();
    const inserted = [];

    for (const { domain, reason } of knownBlockedDomains) {
      // Check if already exists
      const existing = await ctx.db
        .query("blockedRecipeDomains")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("blockedRecipeDomains", {
          domain,
          reason,
          errorCount: 0,
          lastErrorAt: now,
          isManualBlock: true,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        inserted.push(domain);
      }
    }

    return { inserted, count: inserted.length };
  },
});
