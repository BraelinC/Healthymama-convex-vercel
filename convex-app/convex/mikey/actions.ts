/**
 * Mikey: Instagram DM Automation - Actions
 * External API calls (Arshare, recipe extraction)
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Extract recipe from URL and send DM back to user
 */
export const extractAndSendRecipe = action({
  args: {
    conversationId: v.id("dmConversations"),
    messageId: v.id("dmMessages"),
    recipeUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log("[Mikey] Extracting recipe from:", args.recipeUrl);

      // 1. Call existing recipe extraction API
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const response = await fetch(`${appUrl}/api/recipe-url/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: args.recipeUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Mikey] Extraction API error:", response.status, errorText);
        throw new Error(`Extraction failed: ${response.status}`);
      }

      const recipeData = await response.json();
      console.log("[Mikey] Recipe extracted:", recipeData.title);

      // 2. Create anonymous "ghost" recipe for viewing
      const recipeId = await ctx.runMutation(api.mikey.mutations.createAnonymousRecipe, {
        title: recipeData.title,
        description: recipeData.description,
        ingredients: recipeData.ingredients || [],
        instructions: recipeData.instructions || [],
        imageUrl: recipeData.imageUrl,
        sourceUrl: args.recipeUrl,
      });

      // 3. Generate unique shareable URL
      const uniqueUrl = `${appUrl}/shared-recipe/${recipeId}`;

      // 4. Update message status
      await ctx.runMutation(api.mikey.mutations.updateMessageStatus, {
        messageId: args.messageId,
        status: "completed",
        extractedRecipeId: recipeId,
        uniquePageUrl: uniqueUrl,
      });

      // 5. Get conversation and account details
      const conversation = await ctx.runQuery(api.mikey.queries.getConversation, {
        conversationId: args.conversationId,
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const instagramAccount = await ctx.runQuery(api.mikey.queries.getInstagramAccount, {
        accountId: conversation.instagramAccountId,
      });

      if (!instagramAccount) {
        throw new Error("Instagram account not found");
      }

      // 6. Send DM back to user via Ayrshare
      const replyText = `✨ Here's your recipe!\n\n${recipeData.title}\n\n👉 View & Save: ${uniqueUrl}\n\nSign up to save it to your cookbook! 🍳`;

      await sendArshareMessage({
        profileKey: instagramAccount.ayrshareProfileKey!,
        recipientId: conversation.instagramUserId,
        message: replyText,
      });

      // 7. Log outbound message
      await ctx.runMutation(api.mikey.mutations.logOutboundMessage, {
        conversationId: args.conversationId,
        messageText: replyText,
      });

      console.log("[Mikey] Recipe sent successfully to", conversation.instagramUsername);
      return { success: true, recipeId, uniqueUrl };
    } catch (error: any) {
      console.error("[Mikey] extractAndSendRecipe error:", error);

      // Update message with error
      await ctx.runMutation(api.mikey.mutations.updateMessageStatus, {
        messageId: args.messageId,
        status: "failed",
        errorMessage: error.message,
      });

      // Try to send error message to user
      try {
        const conversation = await ctx.runQuery(api.mikey.queries.getConversation, {
          conversationId: args.conversationId,
        });

        if (conversation) {
          const instagramAccount = await ctx.runQuery(api.mikey.queries.getInstagramAccount, {
            accountId: conversation.instagramAccountId,
          });

          if (instagramAccount && instagramAccount.ayrshareProfileKey) {
            const errorMessage = `Sorry, I couldn't extract that recipe. 😔\n\nPlease try:\n• Sending a different recipe link\n• Making sure the URL works\n\nNeed help? Visit healthymama.app`;

            await sendArshareMessage({
              profileKey: instagramAccount.ayrshareProfileKey,
              recipientId: conversation.instagramUserId,
              message: errorMessage,
            });

            await ctx.runMutation(api.mikey.mutations.logOutboundMessage, {
              conversationId: args.conversationId,
              messageText: errorMessage,
            });
          }
        }
      } catch (sendError) {
        console.error("[Mikey] Failed to send error message:", sendError);
      }

      throw error;
    }
  },
});

/**
 * Send help message when no URL is detected
 */
export const sendHelpMessage = action({
  args: {
    conversationId: v.id("dmConversations"),
    messageId: v.id("dmMessages"),
  },
  handler: async (ctx, args) => {
    try {
      const conversation = await ctx.runQuery(api.mikey.queries.getConversation, {
        conversationId: args.conversationId,
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const instagramAccount = await ctx.runQuery(api.mikey.queries.getInstagramAccount, {
        accountId: conversation.instagramAccountId,
      });

      if (!instagramAccount) {
        throw new Error("Instagram account not found");
      }

      const helpText = `👋 Hi! I'm the HealthyMama recipe bot!\n\nSend me a recipe link and I'll extract it for you.\n\nExample:\nhttps://www.allrecipes.com/recipe/...\n\nI'll send you back a link to view & save the recipe! 🍳`;

      await sendArshareMessage({
        profileKey: instagramAccount.ayrshareProfileKey!,
        recipientId: conversation.instagramUserId,
        message: helpText,
      });

      await ctx.runMutation(api.mikey.mutations.logOutboundMessage, {
        conversationId: args.conversationId,
        messageText: helpText,
      });

      await ctx.runMutation(api.mikey.mutations.updateMessageStatus, {
        messageId: args.messageId,
        status: "completed",
      });

      return { success: true };
    } catch (error: any) {
      console.error("[Mikey] sendHelpMessage error:", error);
      throw error;
    }
  },
});

/**
 * Import Instagram reel recipe and send link back via DM
 */
export const importRecipeFromDM = action({
  args: {
    instagramReelUrl: v.string(),
    userId: v.string(),
    conversationId: v.id("dmConversations"),
    messageId: v.id("dmMessages"),
    profileKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log("[Mikey] Importing Instagram reel:", args.instagramReelUrl);

      // 1. Send "Received!" acknowledgment immediately
      const conversation = await ctx.runQuery(api.mikey.queries.getConversation, {
        conversationId: args.conversationId,
      });

      if (conversation) {
        await sendArshareMessage({
          profileKey: args.profileKey,
          recipientId: conversation.instagramUserId,
          message: "Received! Processing your recipe... 🍳",
        });

        await ctx.runMutation(api.mikey.mutations.logOutboundMessage, {
          conversationId: args.conversationId,
          messageText: "Received! Processing your recipe... 🍳",
        });
      }

      // 2. Call Instagram import action (full Mux upload + AI extraction + video segments)
      const result = await ctx.runAction(api.instagram.importInstagramRecipe, {
        userId: args.userId,
        url: args.instagramReelUrl,
        cookbookCategory: undefined, // No cookbook initially - user can add later
      });

      console.log("[Mikey] Import result:", result);

      if (!result.success || !result.recipeId) {
        throw new Error(result.error || "Recipe import failed");
      }

      // 3. Generate recipe page URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://healthymama.app";
      const recipeUrl = `${appUrl}/recipe/${result.recipeId}`;

      // 4. Update message status
      await ctx.runMutation(api.mikey.mutations.updateMessageStatus, {
        messageId: args.messageId,
        status: "completed",
        extractedRecipeId: result.recipeId as Id<"userRecipes">,
        uniquePageUrl: recipeUrl,
      });

      // 5. Send recipe link back to user
      const replyText = `✨ Your recipe is ready!\n\n👉 View it here: ${recipeUrl}\n\nYou can add it to your cookbook from the recipe page! 🍳`;

      if (conversation) {
        await sendArshareMessage({
          profileKey: args.profileKey,
          recipientId: conversation.instagramUserId,
          message: replyText,
        });

        await ctx.runMutation(api.mikey.mutations.logOutboundMessage, {
          conversationId: args.conversationId,
          messageText: replyText,
        });
      }

      console.log("[Mikey] Recipe sent successfully to", conversation?.instagramUsername);
      return { success: true, recipeId: result.recipeId, recipeUrl };
    } catch (error: any) {
      console.error("[Mikey] importRecipeFromDM error:", error);

      // Update message with error
      await ctx.runMutation(api.mikey.mutations.updateMessageStatus, {
        messageId: args.messageId,
        status: "failed",
        errorMessage: error.message,
      });

      // Try to send error message to user
      try {
        const conversation = await ctx.runQuery(api.mikey.queries.getConversation, {
          conversationId: args.conversationId,
        });

        if (conversation) {
          const errorMessage = `Sorry, I couldn't process that Instagram reel. 😔\n\nPossible reasons:\n• The reel is private\n• The reel was deleted\n• The content couldn't be extracted\n\nTry sharing a different public reel!`;

          await sendArshareMessage({
            profileKey: args.profileKey,
            recipientId: conversation.instagramUserId,
            message: errorMessage,
          });

          await ctx.runMutation(api.mikey.mutations.logOutboundMessage, {
            conversationId: args.conversationId,
            messageText: errorMessage,
          });
        }
      } catch (sendError) {
        console.error("[Mikey] Failed to send error message:", sendError);
      }

      throw error;
    }
  },
});

/**
 * Send error message for non-Instagram reel URLs
 */
export const sendErrorMessage = action({
  args: {
    conversationId: v.id("dmConversations"),
    messageId: v.id("dmMessages"),
    profileKey: v.string(),
    errorType: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const conversation = await ctx.runQuery(api.mikey.queries.getConversation, {
        conversationId: args.conversationId,
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      let errorMessage: string;
      if (args.errorType === "non_reel_instagram") {
        errorMessage = "Sorry, I can only process Instagram reels right now. Please share a reel URL! 🎬";
      } else {
        errorMessage = `👋 Hi! I can help you save Instagram recipes!\n\nJust send me an Instagram reel link like:\nhttps://www.instagram.com/reel/...\n\nI'll extract the recipe and send you a link! 🍳`;
      }

      await sendArshareMessage({
        profileKey: args.profileKey,
        recipientId: conversation.instagramUserId,
        message: errorMessage,
      });

      await ctx.runMutation(api.mikey.mutations.logOutboundMessage, {
        conversationId: args.conversationId,
        messageText: errorMessage,
      });

      await ctx.runMutation(api.mikey.mutations.updateMessageStatus, {
        messageId: args.messageId,
        status: "completed",
      });

      return { success: true };
    } catch (error: any) {
      console.error("[Mikey] sendErrorMessage error:", error);
      throw error;
    }
  },
});

/**
 * Helper: Send message via Ayrshare API
 */
async function sendArshareMessage({
  profileKey,
  recipientId,
  message,
}: {
  profileKey: string;
  recipientId: string;
  message: string;
}) {
  const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
  const AYRSHARE_API = process.env.AYRSHARE_API;

  if (!AYRSHARE_API) {
    throw new Error("AYRSHARE_API is not configured");
  }

  const response = await fetch(`${AYRSHARE_BASE_URL}/api/messages/instagram`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AYRSHARE_API}`,
      "Profile-Key": profileKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient_id: recipientId,
      message: message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Ayrshare] Send message error:", response.status, errorText);
    throw new Error(`Ayrshare API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
