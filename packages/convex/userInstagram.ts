// @ts-nocheck
/**
 * User Instagram DM Management
 * Handles Instagram DM conversations for regular users (not bot admin)
 */

import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Process incoming Instagram DM for a regular user (webhook handler)
 */
export const processUserIncomingDM = mutation({
  args: {
    ayrshareRefId: v.string(),              // Ayrshare refId from webhook
    instagramUserId: v.string(),            // Sender's Instagram user ID
    instagramUsername: v.string(),          // Sender's Instagram username
    messageText: v.string(),
    instagramMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Find user profile by Ayrshare refId
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_ayrshareRefId", (q) => q.eq("ayrshareRefId", args.ayrshareRefId))
      .first();

    if (!userProfile) {
      console.error("[User Instagram] User profile not found for refId:", args.ayrshareRefId);
      throw new Error("User not found");
    }

    const userId = userProfile.userId;
    console.log("[User Instagram] Processing DM for user:", userId);

    // 2. Find or create conversation
    let conversation = await ctx.db
      .query("userInstagramConversations")
      .withIndex("by_user_and_instagram", (q) =>
        q.eq("userId", userId).eq("instagramUserId", args.instagramUserId)
      )
      .first();

    const now = Date.now();

    if (!conversation) {
      // Create new conversation
      const conversationId = await ctx.db.insert("userInstagramConversations", {
        userId: userId,
        instagramUserId: args.instagramUserId,
        instagramUsername: args.instagramUsername,
        lastMessageAt: now,
        lastMessageText: args.messageText,
        unreadCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      conversation = await ctx.db.get(conversationId);
      console.log("[User Instagram] Created new conversation:", conversationId);
    } else {
      // Update existing conversation
      await ctx.db.patch(conversation._id, {
        lastMessageAt: now,
        lastMessageText: args.messageText,
        unreadCount: conversation.unreadCount + 1,
        updatedAt: now,
      });
      console.log("[User Instagram] Updated conversation:", conversation._id);
    }

    // 3. Detect if message contains Instagram reel URL
    const isReelUrl = args.messageText?.includes('instagram.com/reel/') ||
                      args.messageText?.includes('instagram.com/p/') ||
                      args.messageText?.includes('instagram.com/tv/') ||
                      args.messageText?.includes('lookaside.fbsbx.com');

    // 4. Save message
    const messageId = await ctx.db.insert("userInstagramMessages", {
      conversationId: conversation!._id,
      userId: userId,
      direction: "inbound",
      messageText: args.messageText,
      instagramMessageId: args.instagramMessageId,
      attachmentType: isReelUrl ? "reel" as const : "text" as const,
      read: false,
      createdAt: now,
    });

    console.log("[User Instagram] Saved message:", messageId, "attachmentType:", isReelUrl ? "reel" : "text");

    return { success: true, conversationId: conversation!._id, messageId };
  },
});

/**
 * Get all conversations for a user (auto-updates via Convex reactivity)
 */
export const getUserConversations = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("userInstagramConversations")
      .withIndex("by_last_message", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return conversations;
  },
});

/**
 * Get messages for a specific conversation (auto-updates)
 */
export const getConversationMessages = query({
  args: {
    conversationId: v.id("userInstagramConversations"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("userInstagramMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return messages;
  },
});

/**
 * Mark messages as read
 */
export const markConversationAsRead = mutation({
  args: {
    conversationId: v.id("userInstagramConversations"),
  },
  handler: async (ctx, args) => {
    // Get conversation to verify it exists and get userId
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Mark all unread messages as read
    const messages = await ctx.db
      .query("userInstagramMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    for (const message of messages) {
      await ctx.db.patch(message._id, { read: true });
    }

    // Reset unread count
    await ctx.db.patch(conversation._id, { unreadCount: 0 });

    return { success: true };
  },
});

/**
 * Send outbound message
 */
export const sendUserMessage = action({
  args: {
    userId: v.string(),
    conversationId: v.id("userInstagramConversations"),
    messageText: v.string(),
  },
  handler: async (ctx, args) => {
    // Get conversation
    const conversation = await ctx.runQuery(api.userInstagram.getConversation, {
      conversationId: args.conversationId,
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Get user's Ayrshare profile key
    const user = await ctx.runQuery(api.userProfile.getUserProfile, {
      userId: args.userId,
    });

    if (!user?.ayrshareProfileKey) {
      throw new Error("Instagram not connected");
    }

    // Send via Ayrshare API
    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

    const response = await fetch(`${AYRSHARE_BASE_URL}/api/messages/instagram`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AYRSHARE_API_KEY}`,
        "Profile-Key": user.ayrshareProfileKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipientId: conversation.instagramUserId,
        message: args.messageText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[User Instagram] Send message error:", errorText);
      throw new Error("Failed to send message");
    }

    const data = await response.json();
    console.log("[User Instagram] Message sent:", data);

    // Save to database
    await ctx.runMutation(api.userInstagram.saveOutboundMessage, {
      conversationId: args.conversationId,
      userId: args.userId,
      messageText: args.messageText,
      instagramMessageId: data.id || `${Date.now()}`,
    });

    return { success: true };
  },
});

/**
 * Save outbound message to database
 */
export const saveOutboundMessage = mutation({
  args: {
    conversationId: v.id("userInstagramConversations"),
    userId: v.string(),
    messageText: v.string(),
    instagramMessageId: v.string(),
    // Video support fields
    recipeId: v.optional(v.id("userRecipes")),
    muxPlaybackId: v.optional(v.string()),
    videoThumbnailUrl: v.optional(v.string()),
    attachmentType: v.optional(v.union(v.literal("reel"), v.literal("recipe"), v.literal("text"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Save message as inbound (bot sending TO user)
    const messageId = await ctx.db.insert("userInstagramMessages", {
      conversationId: args.conversationId,
      userId: args.userId,
      direction: "inbound", // Bot sent this TO the user
      messageText: args.messageText,
      instagramMessageId: args.instagramMessageId,
      recipeId: args.recipeId,
      muxPlaybackId: args.muxPlaybackId,
      videoThumbnailUrl: args.videoThumbnailUrl,
      attachmentType: args.attachmentType,
      read: false, // Mark as unread so user sees notification
      createdAt: now,
    });

    // Update conversation and increment unread count
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation) {
      await ctx.db.patch(args.conversationId, {
        lastMessageAt: now,
        lastMessageText: args.messageText,
        unreadCount: conversation.unreadCount + 1,
        updatedAt: now,
      });
    }

    return { success: true, messageId };
  },
});

/**
 * Get single conversation (helper for actions)
 */
export const getConversation = query({
  args: {
    conversationId: v.id("userInstagramConversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

/**
 * Get conversation by userId and Instagram user ID
 */
export const getUserConversationByInstagram = query({
  args: {
    userId: v.string(),
    instagramUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("userInstagramConversations")
      .withIndex("by_user_and_instagram", (q) =>
        q.eq("userId", args.userId).eq("instagramUserId", args.instagramUserId)
      )
      .first();

    return conversation;
  },
});

/**
 * Create a new conversation for a user
 */
export const createUserConversation = mutation({
  args: {
    userId: v.string(),
    instagramUserId: v.string(),
    instagramUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const conversationId = await ctx.db.insert("userInstagramConversations", {
      userId: args.userId,
      instagramUserId: args.instagramUserId,
      instagramUsername: args.instagramUsername,
      lastMessageAt: now,
      lastMessageText: "",
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const conversation = await ctx.db.get(conversationId);
    return conversation;
  },
});

/**
 * Save user's outbound message (when user sends TO the bot)
 */
export const saveUserOutboundMessage = internalMutation({
  args: {
    conversationId: v.id("userInstagramConversations"),
    userId: v.string(),
    messageText: v.string(),
    instagramMessageId: v.string(),
    attachmentType: v.optional(v.union(v.literal("reel"), v.literal("recipe"), v.literal("text"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Save message as outbound (user sent it)
    const messageId = await ctx.db.insert("userInstagramMessages", {
      conversationId: args.conversationId,
      userId: args.userId,
      direction: "outbound",
      messageText: args.messageText,
      instagramMessageId: args.instagramMessageId,
      attachmentType: args.attachmentType || "text",
      read: true, // User's own messages are always "read"
      createdAt: now,
    });

    // Update conversation
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessageText: args.messageText,
      updatedAt: now,
    });

    return { success: true, messageId };
  },
});
