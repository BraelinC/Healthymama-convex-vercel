/**
 * Mikey: Instagram DM Automation - Actions
 * External API calls (Ayrshare, recipe extraction)
 * Updated: Dec 3, 2024
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

      // Get conversation for later use
      const conversation = await ctx.runQuery(api.mikey.queries.getConversation, {
        conversationId: args.conversationId,
      });

      // Step 1: Call Next.js API route to extract recipe from Instagram reel
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://healthymama.app";
      const apiUrl = `${appUrl}/api/instagram/import`;

      console.log("[Mikey] Calling Instagram import API:", apiUrl);

      const extractResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Fake auth token to bypass auth check (since this is internal server call)
          "X-Internal-Call": "mikey-bot",
        },
        body: JSON.stringify({ url: args.instagramReelUrl }),
      });

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error("[Mikey] Instagram API error:", errorText);
        throw new Error(`Failed to extract recipe: ${errorText}`);
      }

      const extractResult = await extractResponse.json();

      if (!extractResult.success || !extractResult.recipe) {
        throw new Error(extractResult.error || "Recipe extraction failed");
      }

      console.log("[Mikey] Recipe extracted:", extractResult.recipe.title);
      console.log("[Mikey] Ingredients:", extractResult.recipe.ingredients?.length || 0);
      console.log("[Mikey] Instructions:", extractResult.recipe.instructions?.length || 0);
      console.log("[Mikey] 🎥 MUX Playback ID from API:", extractResult.recipe.muxPlaybackId);
      console.log("[Mikey] 🎥 MUX Asset ID from API:", extractResult.recipe.muxAssetId);
      console.log("[Mikey] 📹 Instagram Video URL:", extractResult.recipe.instagramVideoUrl);

      // Step 2: Save recipe to database using importInstagramRecipe
      const recipe = extractResult.recipe;
      const result = await ctx.runAction(api.instagram.importInstagramRecipe, {
        userId: args.userId, // Pass userId for Mikey bot
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: recipe.servings || undefined,
        prep_time: recipe.prep_time || undefined,
        cook_time: recipe.cook_time || undefined,
        cuisine: recipe.cuisine || undefined,
        source: recipe.source || "instagram",
        instagramUrl: recipe.instagramUrl || args.instagramReelUrl,
        instagramVideoUrl: recipe.instagramVideoUrl,
        instagramThumbnailUrl: recipe.instagramThumbnailUrl,
        instagramUsername: recipe.instagramUsername,
        muxPlaybackId: recipe.muxPlaybackId,
        muxAssetId: recipe.muxAssetId,
        videoSegments: recipe.videoSegments,
        cookbookCategory: undefined, // No cookbook initially - user can add later
      });

      console.log("[Mikey] Import result:", result);
      console.log("[Mikey] Recipe ID received from importInstagramRecipe:", result.recipeId);
      console.log("[Mikey] Recipe ID type:", typeof result.recipeId);

      if (!result.success || !result.recipeId) {
        throw new Error(result.error || "Recipe import failed");
      }

      // Generate recipe page URL (reuse appUrl from above)
      const recipeUrl = `${appUrl}/recipe/${result.recipeId}`;
      console.log("[Mikey] Generated recipe URL:", recipeUrl);

      // Update message status
      await ctx.runMutation(api.mikey.mutations.updateMessageStatus, {
        messageId: args.messageId,
        status: "completed",
        extractedRecipeId: result.recipeId as Id<"userRecipes">,
        uniquePageUrl: recipeUrl,
      });

      // Send recipe link back to user
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
 * Poll for new Instagram DMs from Ayrshare API
 * Called by cron job every 30 seconds
 */
export const pollInstagramMessages = action({
  args: {},
  handler: async (ctx) => {
    try {
      console.log("[Mikey Poll] Starting Instagram DM poll");

      // Get all active Instagram accounts
      const accounts = await ctx.runQuery(api.mikey.queries.getAllInstagramAccounts);
      const activeAccounts = accounts.filter((acc: any) =>
        acc.status === "active" && acc.ayrshareProfileKey
      );

      console.log(`[Mikey Poll] Polling ${activeAccounts.length} active accounts`);

      for (const account of activeAccounts) {
        try {
          // Fetch messages from Ayrshare
          const messages = await fetchAyrshareMessages(account.ayrshareProfileKey!);

          if (!messages || messages.length === 0) {
            continue;
          }

          console.log(`[Mikey Poll] Found ${messages.length} messages for @${account.username}`);

          // Process each message
          for (const msg of messages) {
            // Check if we've already processed this message
            const existing = await ctx.runQuery(api.mikey.queries.getMessageByArshareId, {
              arshareMessageId: msg.id || msg.messageId,
            });

            if (existing) {
              continue; // Already processed
            }

            // Only process received messages (not sent)
            if (msg.action === "sent" || msg.direction === "outbound") {
              continue;
            }

            console.log(`[Mikey Poll] Processing new message from ${msg.senderDetails?.username}`);

            // Process the DM
            const result = await ctx.runMutation(api.mikey.mutations.processIncomingDM, {
              profileKey: account.ayrshareProfileKey!,
              instagramUserId: msg.senderId || msg.senderDetails?.id,
              instagramUsername: msg.senderDetails?.username || msg.senderDetails?.name || "unknown",
              messageText: msg.message || msg.text || "",
              arshareMessageId: msg.id || msg.messageId,
            });

            // Schedule appropriate action based on result
            if (result.instagramReelUrl && result.conversationId) {
              await ctx.runAction(api.mikey.actions.importRecipeFromDM, {
                instagramReelUrl: result.instagramReelUrl,
                userId: result.userId,
                conversationId: result.conversationId,
                messageId: result.messageId,
                profileKey: result.profileKey,
              });
            } else if (result.needsErrorMessage) {
              await ctx.runAction(api.mikey.actions.sendErrorMessage, {
                conversationId: result.conversationId,
                messageId: result.messageId,
                profileKey: result.profileKey,
                errorType: result.errorType,
              });
            } else if (result.needsHelpMessage) {
              await ctx.runAction(api.mikey.actions.sendHelpMessage, {
                conversationId: result.conversationId,
                messageId: result.messageId,
              });
            }
          }
        } catch (accountError: any) {
          console.error(`[Mikey Poll] Error polling account ${account.username}:`, accountError);
        }
      }

      return { success: true, accountsPolled: activeAccounts.length };
    } catch (error: any) {
      console.error("[Mikey Poll] Error in pollInstagramMessages:", error);
      throw error;
    }
  },
});

/**
 * Fetch Instagram messages from Ayrshare API
 */
async function fetchAyrshareMessages(profileKey: string) {
  const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
  const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

  if (!AYRSHARE_API_KEY) {
    throw new Error("AYRSHARE_API_KEY is not configured");
  }

  console.log("[Ayrshare] Fetching messages for profileKey:", profileKey.substring(0, 8) + "...");

  const response = await fetch(`${AYRSHARE_BASE_URL}/api/messages/instagram`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${AYRSHARE_API_KEY}`,
      "Profile-Key": profileKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Ayrshare] Fetch messages error:", response.status, errorText);

    // Include the actual error from Ayrshare in the thrown error
    let errorMessage = `Ayrshare API error (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  console.log("[Ayrshare] Messages response:", {
    status: data.status,
    messageCount: data.messages?.length || 0,
  });

  // Return messages array (structure from Kev's reference)
  return data.messages || [];
}

/**
 * Fetch live DMs from Ayrshare API for user's profile
 * Returns conversations and messages directly from API (not from database)
 */
export const fetchUserDMs = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("[Mikey] Fetching live DMs for user:", args.userId);

    // 1. Get user's ayrshareProfileKey from their profile
    const userProfile = await ctx.runQuery(api.userProfile.getUserProfile, {
      userId: args.userId,
    });

    if (!userProfile?.ayrshareProfileKey) {
      return { conversations: [], error: "Instagram not connected" };
    }

    // 2. Fetch messages from Ayrshare API
    try {
      const messages = await fetchAyrshareMessages(userProfile.ayrshareProfileKey);

      console.log("[Mikey] Sample message structure:", messages[0] ? JSON.stringify(messages[0], null, 2) : "No messages");

      // 3. Group messages by conversation (sender)
      const conversationsMap = new Map<string, any>();

      for (const msg of messages) {
        // Try multiple possible field names for sender ID and username
        const senderId = msg.senderId || msg.sender?.id || msg.senderDetails?.id || msg.conversationId;
        const senderUsername =
          msg.senderDetails?.username ||
          msg.sender?.username ||
          msg.senderDetails?.name ||
          msg.sender?.name ||
          msg.senderUsername ||
          senderId; // Fallback to ID if no username

        // Skip messages without valid sender info
        if (!senderId || senderId === "unknown") {
          console.warn("[Mikey] Skipping message with invalid sender:", msg);
          continue;
        }

        if (!conversationsMap.has(senderId)) {
          conversationsMap.set(senderId, {
            senderId,
            senderUsername,
            messages: [],
          });
        }

        conversationsMap.get(senderId)!.messages.push({
          id: msg.id || msg.messageId,
          text: msg.message || msg.text || "",
          timestamp: msg.timestamp || Date.now(),
          direction: msg.direction || "incoming",
        });
      }

      // Convert to array and sort by most recent message
      const conversations = Array.from(conversationsMap.values()).map((conv) => ({
        ...conv,
        messages: conv.messages.sort((a: any, b: any) => a.timestamp - b.timestamp),
        lastMessageTime: Math.max(...conv.messages.map((m: any) => m.timestamp)),
      })).sort((a, b) => b.lastMessageTime - a.lastMessageTime);

      console.log("[Mikey] Found", conversations.length, "conversations");

      return { conversations, error: null };
    } catch (error: any) {
      console.error("[Mikey] Error fetching user DMs:", error);
      return { conversations: [], error: error.message };
    }
  },
});

/**
 * Send DM from user's profile page (direct to Ayrshare API)
 */
export const sendUserDM = action({
  args: {
    userId: v.string(),
    recipientId: v.string(),
    messageText: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("[Mikey] User sending DM:", args.userId, "to:", args.recipientId);

    // Validate recipientId
    if (!args.recipientId || args.recipientId === "unknown") {
      throw new Error("Invalid recipient. Cannot send message to unknown user.");
    }

    // 1. Get user's profileKey
    const userProfile = await ctx.runQuery(api.userProfile.getUserProfile, {
      userId: args.userId,
    });

    if (!userProfile?.ayrshareProfileKey) {
      throw new Error("Instagram not connected");
    }

    // 2. Send message via Ayrshare
    try {
      await sendArshareMessage({
        profileKey: userProfile.ayrshareProfileKey,
        recipientId: args.recipientId,
        message: args.messageText,
      });

      console.log("[Mikey] User DM sent successfully");

      return { success: true };
    } catch (error: any) {
      console.error("[Mikey] Error sending user DM:", error);
      throw new Error(`Failed to send message: ${error.message}`);
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
  const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

  if (!AYRSHARE_API_KEY) {
    throw new Error("AYRSHARE_API_KEY is not configured");
  }

  const response = await fetch(`${AYRSHARE_BASE_URL}/api/messages/instagram`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AYRSHARE_API_KEY}`,
      "Profile-Key": profileKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipientId: recipientId, // camelCase, not snake_case
      message: message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Ayrshare] Send message error:", response.status, errorText);

    // Try to parse JSON error for better error message
    let errorMessage = `Ayrshare API error (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message || errorJson.error) {
        errorMessage = errorJson.message || errorJson.error;
      }
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log("[Ayrshare] Send message success:", data);
  return data;
}

/**
 * Process incoming DM from Ayrshare webhook (instant notification)
 * This is called by the /mikey/webhook HTTP endpoint
 */
export const processWebhookDM = action({
  args: {
    profileKey: v.string(),
    botInstagramUserId: v.string(),  // The bot's Instagram user ID (recipientId from webhook)
    instagramUserId: v.string(),
    instagramUsername: v.string(),
    messageText: v.string(),
    arshareMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log("[Mikey Webhook] Processing DM from:", args.instagramUsername);

      // 1. Save incoming message to database
      const result = await ctx.runMutation(api.mikey.mutations.processIncomingDM, {
        profileKey: args.profileKey,
        botInstagramUserId: args.botInstagramUserId,  // Pass bot's Instagram user ID
        instagramUserId: args.instagramUserId,
        instagramUsername: args.instagramUsername,
        messageText: args.messageText,
        arshareMessageId: args.arshareMessageId,
      });

      // Check if this is a duplicate webhook (10-second blocking window triggered)
      if (result.duplicate) {
        console.log("[Mikey Webhook] ⚠️ Skipping duplicate webhook - already processed");
        console.log("[Mikey Webhook] Reason:", result.reason || "duplicate");
        return {
          success: true,
          skipped: true,
          reason: result.reason || "duplicate",
        };
      }

      // 2. Handle based on message type
      if (result.needsHelpMessage) {
        // No URL found - send help message
        console.log("[Mikey Webhook] Sending help message");
        await ctx.runAction(api.mikey.actions.sendHelpMessage, {
          conversationId: result.conversationId,
          messageId: result.messageId,
        });
      } else if (result.recipeUrl) {
        // Recipe URL found - extract and send
        console.log("[Mikey Webhook] Extracting recipe:", result.recipeUrl);
        await ctx.runAction(api.mikey.actions.extractAndSendRecipe, {
          conversationId: result.conversationId,
          messageId: result.messageId,
          recipeUrl: result.recipeUrl,
        });
      } else if (result.instagramReelUrl && result.userId) {
        // Instagram reel URL found - import recipe
        console.log("[Mikey Webhook] Importing Instagram reel:", result.instagramReelUrl);

        // Get Instagram account by refId (webhooks send refId, not profileKey)
        const instagramAccount = await ctx.runQuery(api.mikey.queries.getInstagramAccountByRefId, {
          refId: args.profileKey, // Webhooks actually send refId in the profileKey field
        });

        if (instagramAccount) {
          await ctx.runAction(api.mikey.actions.importRecipeFromDM, {
            instagramReelUrl: result.instagramReelUrl,
            userId: result.userId,
            conversationId: result.conversationId,
            messageId: result.messageId,
            profileKey: instagramAccount.ayrshareProfileKey!, // Pass the actual profileKey for sending messages
          });
        } else {
          console.error("[Mikey Webhook] Instagram account not found for refId:", args.profileKey);
        }
      }

      console.log("[Mikey Webhook] DM processed successfully");
      return { success: true };
    } catch (error: any) {
      console.error("[Mikey Webhook] Error processing DM:", error);
      throw error;
    }
  },
});

/**
 * Register webhook with Ayrshare for instant DM notifications
 * Called automatically when a new profile is created
 */
export const registerWebhookForProfile = action({
  args: {
    profileKey: v.string(),
  },
  handler: async (ctx, args) => {
    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

    // Build webhook URL dynamically from environment
    // CONVEX_SITE_URL should be set to your Convex deployment URL (e.g., https://zealous-sockeye-430.convex.site)
    const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL;
    if (!CONVEX_SITE_URL) {
      throw new Error("CONVEX_SITE_URL is not configured");
    }
    const WEBHOOK_URL = `${CONVEX_SITE_URL}/mikey/webhook`;

    if (!AYRSHARE_API_KEY) {
      throw new Error("AYRSHARE_API_KEY is not configured");
    }

    console.log(`[Webhook Registration] Registering webhook for profile: ${args.profileKey}`);
    console.log(`[Webhook Registration] Webhook URL: ${WEBHOOK_URL}`);

    try {
      const response = await fetch(`${AYRSHARE_BASE_URL}/api/hook/webhook`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
          "Profile-Key": args.profileKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "messages",
          url: WEBHOOK_URL,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Webhook Registration] Error: ${response.status}`, errorText);
        throw new Error(`Webhook registration failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("[Webhook Registration] Success:", data);
      return { success: true, data };
    } catch (error: any) {
      console.error("[Webhook Registration] Failed:", error);
      throw error;
    }
  },
});
