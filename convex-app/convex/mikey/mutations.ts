/**
 * Mikey: Instagram DM Automation - Mutations
 * Database mutations for managing Instagram accounts, conversations, and messages
 */

import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Add a new Instagram account connected via Ayrshare (NEW FLOW - Profile Key based)
 */
export const addInstagramAccountWithProfileKey = mutation({
  args: {
    username: v.string(),
    ayrshareProfileKey: v.string(),
    ayrshareRefId: v.string(),
    maxUsers: v.number(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if this specific username already exists
    const existing = await ctx.db
      .query("instagramAccounts")
      .filter((q) => q.eq(q.field("username"), args.username))
      .first();

    if (existing) {
      // Update existing account (in case of reconnection)
      await ctx.db.patch(existing._id, {
        ayrshareProfileKey: args.ayrshareProfileKey,
        ayrshareRefId: args.ayrshareRefId,
        status: "active",
        updatedAt: Date.now(),
      });
      return { success: true, accountId: existing._id, updated: true };
    }

    // Create new Instagram account entry
    const accountId = await ctx.db.insert("instagramAccounts", {
      username: args.username,
      ayrshareProfileKey: args.ayrshareProfileKey,
      ayrshareRefId: args.ayrshareRefId,
      status: "active",
      currentUserCount: 0,
      maxUsers: args.maxUsers,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: args.createdBy,
    });

    return { success: true, accountId };
  },
});

/**
 * Add a new Instagram account connected via Arshare (DEPRECATED - Old OAuth flow)
 */
export const addInstagramAccount = mutation({
  args: {
    username: v.string(),
    arshareAccountId: v.string(),
    arshareAccessToken: v.string(),
    maxUsers: v.number(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if account already exists
    const existing = await ctx.db
      .query("instagramAccounts")
      .filter((q) => q.eq(q.field("arshareAccountId"), args.arshareAccountId))
      .first();

    if (existing) {
      throw new Error("This Instagram account is already connected");
    }

    const accountId = await ctx.db.insert("instagramAccounts", {
      username: args.username,
      arshareAccountId: args.arshareAccountId,
      arshareAccessToken: args.arshareAccessToken,
      status: "active",
      currentUserCount: 0,
      maxUsers: args.maxUsers,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: args.createdBy,
    });

    return { success: true, accountId };
  },
});

/**
 * Update Instagram account status
 */
export const updateAccountStatus = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("full")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete an Instagram account
 */
export const deleteInstagramAccount = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.accountId);
    return { success: true };
  },
});

/**
 * Process incoming DM from Arshare webhook
 */
export const processIncomingDM = mutation({
  args: {
    profileKey: v.string(), // Changed from arshareAccountId to profileKey
    instagramUserId: v.string(),
    instagramUsername: v.string(),
    messageText: v.string(),
    arshareMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Find Instagram account by profileKey (which is actually refId from webhook)
    // Webhooks send refId, not profileKey, so search by refId
    let instagramAccount = await ctx.db
      .query("instagramAccounts")
      .withIndex("by_refId", (q) => q.eq("ayrshareRefId", args.profileKey))
      .first();

    // Fallback: try searching by profileKey if refId lookup fails
    if (!instagramAccount) {
      instagramAccount = await ctx.db
        .query("instagramAccounts")
        .withIndex("by_profileKey", (q) => q.eq("ayrshareProfileKey", args.profileKey))
        .first();
    }

    if (!instagramAccount) {
      console.error("[Mikey] Instagram account not found for profileKey/refId:", args.profileKey);
      throw new Error("Instagram account not found");
    }

    // 2. Find or create conversation
    let conversation = await ctx.db
      .query("dmConversations")
      .withIndex("by_instagram_user", (q) => q.eq("instagramUserId", args.instagramUserId))
      .first();

    if (!conversation) {
      // Create new conversation
      const conversationId = await ctx.db.insert("dmConversations", {
        instagramAccountId: instagramAccount._id,
        instagramUserId: args.instagramUserId,
        instagramUsername: args.instagramUsername,
        lastMessageAt: Date.now(),
        messageCount: 0,
        status: "active",
        createdAt: Date.now(),
      });

      conversation = await ctx.db.get(conversationId);

      // Increment user count on Instagram account
      await ctx.db.patch(instagramAccount._id, {
        currentUserCount: (instagramAccount.currentUserCount || 0) + 1,
        status:
          (instagramAccount.currentUserCount || 0) + 1 >= instagramAccount.maxUsers
            ? "full"
            : "active",
        updatedAt: Date.now(),
      });
    }

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    // 3. Check for duplicate message (prevents processing same webhook twice)
    const existingMessage = await ctx.db
      .query("dmMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
      .filter((q) => q.eq(q.field("arshareMessageId"), args.arshareMessageId))
      .first();

    if (existingMessage) {
      console.log("[Mikey] Duplicate message detected, skipping:", args.arshareMessageId);
      return {
        messageId: existingMessage._id,
        conversationId: conversation._id,
        userId: instagramAccount.userId,
        duplicate: true,
      };
    }

    // 4. Check rate limits
    const recentMessages = await ctx.db
      .query("dmMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
      .filter((q) => q.gt(q.field("createdAt"), Date.now() - 60000)) // Last minute
      .collect();

    if (recentMessages.length >= 5) {
      // Rate limit exceeded
      await ctx.db.patch(conversation._id, {
        status: "rate_limited",
      });
      throw new Error("Rate limit exceeded");
    }

    // 5. Save incoming message
    const messageId = await ctx.db.insert("dmMessages", {
      conversationId: conversation._id,
      direction: "inbound",
      messageText: args.messageText,
      arshareMessageId: args.arshareMessageId,
      status: "received",
      createdAt: Date.now(),
    });

    // 6. Update conversation
    await ctx.db.patch(conversation._id, {
      lastMessageAt: Date.now(),
      messageCount: (conversation.messageCount || 0) + 1,
    });

    // 7. Extract and validate Instagram reel URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = args.messageText.match(urlRegex);

    if (!urls || urls.length === 0) {
      // No URL found - mark for help message
      await ctx.db.patch(messageId, {
        status: "completed",
      });
      return {
        messageId,
        conversationId: conversation._id,
        needsHelpMessage: true
      };
    }

    // Check if URL is an Instagram reel or CDN video URL (from share button)
    const instagramReelUrl = urls.find(url =>
      (url.includes('instagram.com') && (url.includes('/reel/') || url.includes('/p/') || url.includes('/tv/'))) ||
      url.includes('lookaside.fbsbx.com/ig_messaging_cdn')
    );

    if (!instagramReelUrl) {
      // Check if it's Instagram but not a reel
      const isInstagramUrl = urls.some(url => url.includes('instagram.com'));

      await ctx.db.patch(messageId, {
        status: "failed",
        errorMessage: isInstagramUrl
          ? "Only Instagram reels are supported"
          : "No Instagram reel URL found",
      });

      return {
        messageId,
        conversationId: conversation._id,
        profileKey: args.profileKey,
        needsErrorMessage: true,
        errorType: isInstagramUrl ? "non_reel_instagram" : "no_instagram_url",
      };
    }

    // 7. Look up the DM sender's Clerk userId by their Instagram username
    // This allows the bot to save recipes to the actual sender's account
    const senderProfile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("instagramUsername"), args.instagramUsername))
      .first();

    const senderUserId = senderProfile?.userId;

    if (!senderUserId) {
      console.log(`[Mikey] DM sender @${args.instagramUsername} does not have a linked healthymama.app account`);
    } else {
      console.log(`[Mikey] DM sender @${args.instagramUsername} found: userId=${senderUserId}`);
    }

    // 8. Update message with extracted Instagram reel URL
    await ctx.db.patch(messageId, {
      recipeUrl: instagramReelUrl,
      status: "processing",
    });

    return {
      messageId,
      conversationId: conversation._id,
      profileKey: args.profileKey,
      instagramReelUrl,
      userId: senderUserId || instagramAccount.createdBy || "anonymous",
    };
  },
});

/**
 * Update message status after recipe extraction
 */
export const updateMessageStatus = mutation({
  args: {
    messageId: v.id("dmMessages"),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    extractedRecipeId: v.optional(v.id("userRecipes")),
    uniquePageUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      status: args.status,
      ...(args.extractedRecipeId && { extractedRecipeId: args.extractedRecipeId }),
      ...(args.uniquePageUrl && { uniquePageUrl: args.uniquePageUrl }),
      ...(args.errorMessage && { errorMessage: args.errorMessage }),
    });

    return { success: true };
  },
});

/**
 * Create outgoing message (sent by user from profile)
 */
export const createOutgoingMessage = mutation({
  args: {
    conversationId: v.id("dmConversations"),
    messageText: v.string(),
    sentBy: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("dmMessages", {
      conversationId: args.conversationId,
      direction: "outgoing",
      messageText: args.messageText,
      status: "completed",
      createdAt: Date.now(),
      arshareMessageId: `user-sent-${Date.now()}`,
    });

    // Update conversation's last message time
    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return { messageId };
  },
});

/**
 * Log outbound message sent to user
 */
export const logOutboundMessage = mutation({
  args: {
    conversationId: v.id("dmConversations"),
    messageText: v.string(),
    arshareMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("dmMessages", {
      conversationId: args.conversationId,
      direction: "outbound",
      messageText: args.messageText,
      arshareMessageId: args.arshareMessageId || `outbound_${Date.now()}`,
      status: "completed",
      createdAt: Date.now(),
    });

    return { messageId };
  },
});

/**
 * Create anonymous recipe for shared viewing (no user required)
 */
export const createAnonymousRecipe = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),
    imageUrl: v.optional(v.string()),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Create a "ghost" recipe with special userId "anonymous"
    const recipeId = await ctx.db.insert("userRecipes", {
      userId: "anonymous", // Special user for DM-sourced recipes
      recipeType: "custom",
      cookbookCategory: "dm_shared", // Special category for tracking
      customRecipeData: {
        title: args.title,
        description: args.description,
        imageUrl: args.imageUrl,
        ingredients: args.ingredients,
        instructions: args.instructions,
      },
      cachedTitle: args.title,
      cachedImageUrl: args.imageUrl,
      isFavorited: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
    });

    return recipeId;
  },
});

/**
 * Block/unblock a conversation
 */
export const updateConversationStatus = mutation({
  args: {
    conversationId: v.id("dmConversations"),
    status: v.union(
      v.literal("active"),
      v.literal("blocked"),
      v.literal("rate_limited")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      status: args.status,
    });

    return { success: true };
  },
});

/**
 * Save pending Ayrshare profile connection (temporary storage)
 */
export const savePendingProfile = mutation({
  args: {
    userId: v.string(),
    profileKey: v.string(),
    refId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // Expire in 15 minutes

    const pendingId = await ctx.db.insert("pendingAyrshareProfiles", {
      userId: args.userId,
      profileKey: args.profileKey,
      refId: args.refId,
      createdAt: now,
      expiresAt,
    });

    return { pendingId };
  },
});

/**
 * Get latest pending profile for user
 */
export const getLatestPendingProfile = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get most recent non-expired pending profile
    const pending = await ctx.db
      .query("pendingAyrshareProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .order("desc")
      .first();

    if (!pending) {
      return null;
    }

    // Delete after retrieving (one-time use)
    await ctx.db.delete(pending._id);

    return {
      profileKey: pending.profileKey,
      refId: pending.refId,
    };
  },
});

/**
 * Delete all Instagram accounts (for cleanup/testing)
 */
export const deleteAllInstagramAccounts = mutation({
  args: {},
  handler: async (ctx, args) => {
    const accounts = await ctx.db.query("instagramAccounts").collect();

    let deletedCount = 0;
    for (const account of accounts) {
      await ctx.db.delete(account._id);
      deletedCount++;
    }

    return deletedCount;
  },
});

/**
 * Delete all pending Ayrshare profiles (for cleanup/testing)
 */
export const deleteAllPendingProfiles = mutation({
  args: {},
  handler: async (ctx, args) => {
    const pending = await ctx.db.query("pendingAyrshareProfiles").collect();

    let deletedCount = 0;
    for (const profile of pending) {
      await ctx.db.delete(profile._id);
      deletedCount++;
    }

    return deletedCount;
  },
});
