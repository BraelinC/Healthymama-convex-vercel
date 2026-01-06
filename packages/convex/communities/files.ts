/**
 * Community File Storage & Recipe Image Uploads
 * Handles image uploads for community cover images and recipe identification
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Generate upload URL for community cover image or recipe image
 * Used by UploadStuff to get a secure upload URL
 */
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

/**
 * Get community image URL from storage ID
 * Use query instead of mutation for read-only operations
 */
export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
