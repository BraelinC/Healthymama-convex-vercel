import { action, mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { internal, api } from "../_generated/api";

// ========== QUERIES ==========

/**
 * List all chat sessions for a user in a specific community
 */
export const listSessions = query({
  args: {
    userId: v.string(),
    communityId: v.string(),
  },
  handler: async (ctx, args) => {
    // Use by_user_lastMessage index to enable ordering by lastMessageAt
    const allSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_lastMessage", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    // Filter by communityId in memory (fast for typical session counts)
    const sessions = allSessions.filter(
      (session) => session.communityId === args.communityId
    );

    return sessions;
  },
});

/**
 * Get all messages for a specific session
 */
export const getSessionMessages = query({
  args: {
    sessionId: v.id("chatSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(limit);

    return messages;
  },
});

/**
 * Get AI customization settings for a user
 */
export const getAISettings = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("aiSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    // Return default settings if none exist
    return settings ?? {
      aiName: "RecipeAI",
      persona: "You are a helpful cooking assistant with expertise in recipes, meal planning, and nutrition.",
      temperature: 0.7,
      defaultModel: "gpt-5-mini",
    };
  },
});

// ========== MUTATIONS ==========

/**
 * Create a new chat session
 */
export const createSession = mutation({
  args: {
    userId: v.string(),
    communityId: v.string(),
    title: v.optional(v.string()),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("chatSessions", {
      userId: args.userId,
      communityId: args.communityId,
      title: args.title ?? "New Chat",
      model: args.model,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

/**
 * Add a message to a session (public mutation for API routes)
 */
export const addMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    metadata: v.optional(v.object({
      model: v.optional(v.string()),
      temperature: v.optional(v.number()),
      persona: v.optional(v.string()),
      recipeData: v.optional(v.array(v.object({
        id: v.string(),
        name: v.string(),
        description: v.string(),
        ingredients: v.array(v.string()),
        steps: v.array(v.string()),
        dietTags: v.array(v.string()),
        imageUrl: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        similarity: v.optional(v.number()),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    // Get session to extract userId and communityId
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Save message
    const messageId = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: session.userId,
      community: session.communityId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    // Update session's last message timestamp
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: Date.now(),
    });

    return messageId;
  },
});

/**
 * Save a message to a session (internal mutation for use by actions)
 */
export const saveMessage = internalMutation({
  args: {
    sessionId: v.id("chatSessions"),
    userId: v.string(),
    communityId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(v.object({
      model: v.optional(v.string()),
      temperature: v.optional(v.number()),
      persona: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // Save message
    const messageId = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: args.userId,
      community: args.communityId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    // Update session's last message timestamp
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: Date.now(),
    });

    return messageId;
  },
});

/**
 * Update AI customization settings
 */
export const updateAISettings = mutation({
  args: {
    userId: v.string(),
    aiName: v.string(),
    persona: v.string(),
    temperature: v.number(),
    defaultModel: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if settings exist
    const existing = await ctx.db
      .query("aiSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, {
        aiName: args.aiName,
        persona: args.persona,
        temperature: args.temperature,
        defaultModel: args.defaultModel,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("aiSettings", {
        userId: args.userId,
        aiName: args.aiName,
        persona: args.persona,
        temperature: args.temperature,
        defaultModel: args.defaultModel,
        updatedAt: Date.now(),
      });
      return settingsId;
    }
  },
});

/**
 * Delete a chat session and all its messages
 */
export const deleteSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    // Delete all messages in the session
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the session
    await ctx.db.delete(args.sessionId);
  },
});

/**
 * Update session title
 */
export const updateSessionTitle = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      title: args.title,
    });
  },
});

/**
 * Auto-generate session title using Grok 4 Fast
 * Called automatically after 2nd user message
 */
export const generateSessionTitle = action({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    // Get first 4 messages (2 user + 2 assistant typically)
    const messages = await ctx.runQuery(api.communitychat.getSessionMessages, {
      sessionId: args.sessionId,
      limit: 4,
    });

    if (messages.length < 2) {
      console.log("[AutoTitle] Not enough messages to generate title");
      return;
    }

    // Extract conversation context (first 2 exchanges)
    const conversationContext = messages
      .slice(0, 4)
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join("\n");

    // Call Grok 4 Fast via OpenRouter to generate title
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) {
      console.error("[AutoTitle] OPEN_ROUTER_API_KEY not configured");
      return;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://healthymama.app",
          "X-Title": "HealthyMama Community Chat",
        },
        body: JSON.stringify({
          model: "x-ai/grok-4-fast",
          messages: [
            {
              role: "system",
              content: `Generate a short, descriptive title (3-5 words max) for this conversation. Focus on the main topic or request. Examples: "Mexican Chicken Recipes", "Low-Carb Meal Planning", "Protein Breakfast Ideas". Only output the title, nothing else.`,
            },
            {
              role: "user",
              content: `Conversation:\n${conversationContext}\n\nTitle:`,
            },
          ],
          temperature: 0.3, // Lower temperature for consistent, focused titles
          max_tokens: 20,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("[AutoTitle] Grok API error:", error);
        return;
      }

      const data = await response.json();
      const generatedTitle = data.choices[0]?.message?.content?.trim();

      if (generatedTitle && generatedTitle !== "New Chat") {
        // Update session title
        await ctx.runMutation(api.communitychat.updateSessionTitle, {
          sessionId: args.sessionId,
          title: generatedTitle,
        });

        console.log(`[AutoTitle] Generated title: "${generatedTitle}"`);
      }
    } catch (error) {
      console.error("[AutoTitle] Failed to generate title:", error);
    }
  },
});

// ========== ACTIONS ==========

/**
 * Send a chat message and get AI response
 * Supports multiple AI providers: OpenAI (gpt-5-mini) and Grok (grok-4-fast)
 */
export const sendChatMessage = action({
  args: {
    sessionId: v.id("chatSessions"),
    userId: v.string(),
    communityId: v.string(),
    message: v.string(),
    model: v.string(),
    aiSettings: v.object({
      aiName: v.string(),
      persona: v.string(),
      temperature: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Save user message
    const userMessageId = await ctx.runMutation(internal.communitychat.saveMessage, {
      sessionId: args.sessionId,
      userId: args.userId,
      communityId: args.communityId,
      role: "user",
      content: args.message,
      metadata: {
        model: args.model,
        temperature: args.aiSettings.temperature,
      },
    });

    // ========== SMART MEMORY PROCESSING (Async) ==========
    // Queue background processing: GPT-5 Nano validation → GPT-5 Mini summarization
    ctx.scheduler.runAfter(0, internal.memory.tieredProcessing.processMessageMemory, {
      messageId: userMessageId,
      sessionId: args.sessionId,
      userId: args.userId,
      communityId: args.communityId,
      messageContent: args.message,
      role: "user",
    });

    // Get conversation history
    const history = await ctx.runQuery(api.communitychat.getSessionMessages, {
      sessionId: args.sessionId,
      limit: 50,
    });

    // Build messages for AI (let AI decide if it needs memories via tools)
    const messages = [
      {
        role: "system" as const,
        content: `You are ${args.aiSettings.aiName}. ${args.aiSettings.persona}`,
      },
      ...history.slice(0, -1).map((msg: any) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: args.message,
      },
    ];

    // Call appropriate AI provider with memory tool
    let aiResponse: string;

    if (args.model === "grok-4-fast") {
      aiResponse = await callGrokAPIWithTools(
        ctx,
        messages,
        args.aiSettings.temperature,
        args.userId,
        args.sessionId
      );
    } else {
      // Default to OpenAI (gpt-5-mini or gpt-4o-mini)
      aiResponse = await callOpenAIWithTools(
        ctx,
        messages,
        args.model,
        args.aiSettings.temperature,
        args.userId,
        args.sessionId
      );
    }

    // Save AI response
    await ctx.runMutation(internal.communitychat.saveMessage, {
      sessionId: args.sessionId,
      userId: args.userId,
      communityId: args.communityId,
      role: "assistant",
      content: aiResponse,
      metadata: {
        model: args.model,
        temperature: args.aiSettings.temperature,
        persona: args.aiSettings.persona,
      },
    });

    return {
      response: aiResponse,
      model: args.model,
    };
  },
});

// ========== HELPER FUNCTIONS ==========

/**
 * Call OpenAI API with memory retrieval tool
 */
async function callOpenAIWithTools(
  ctx: any,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  model: string,
  temperature: number,
  userId: string,
  sessionId: any
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  // Map model names (gpt-5-mini doesn't exist yet, use gpt-4o-mini)
  const openaiModel = model === "gpt-5-mini" ? "gpt-4o-mini" : model;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: openaiModel,
      messages,
      temperature,
      max_tokens: 2000,
      tools: [
        {
          type: "function",
          function: {
            name: "retrieve_user_memories",
            description: "Retrieve relevant user preferences, dietary restrictions, cooking history, and past conversation context. Use this when you need personalized information about the user.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "What to search for in user's memory (e.g., 'dietary preferences', 'favorite cuisines')",
                },
              },
              required: ["query"],
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const choice = data.choices[0];

  // Check if AI wants to use the memory tool
  if (choice.finish_reason === "tool_calls" && choice.message?.tool_calls?.length) {
    const toolCall = choice.message.tool_calls[0];
    const args = JSON.parse(toolCall.function.arguments);

    console.log(`[Memory] AI requested memories: "${args.query}"`);

    // Retrieve memories
    const retrieved = await ctx.runAction(api.memory.smartRetrieval.retrieveMemoryContext, {
      userId,
      sessionId,
      query: args.query,
      includeRecent: false,
    });

    // Send tool result back to AI
    const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          ...messages,
          choice.message,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: retrieved.formattedContext || "No relevant memories found.",
          },
        ],
        temperature,
        max_tokens: 2000,
      }),
    });

    if (!followUpResponse.ok) {
      const error = await followUpResponse.json();
      throw new Error(`OpenAI follow-up API error: ${JSON.stringify(error)}`);
    }

    const followUpData = await followUpResponse.json();
    return followUpData.choices[0]?.message?.content ?? "I apologize, but I couldn't generate a response.";
  }

  return choice.message?.content ?? "I apologize, but I couldn't generate a response.";
}

/**
 * Call Grok API via OpenRouter with memory retrieval tool
 */
async function callGrokAPIWithTools(
  ctx: any,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  temperature: number,
  userId: string,
  sessionId: any
): Promise<string> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY is not set for Grok");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://healthymama.app",
      "X-Title": "HealthyMama Community Chat",
    },
    body: JSON.stringify({
      model: "x-ai/grok-4-fast",
      messages,
      temperature,
      max_tokens: 2000,
      tools: [
        {
          type: "function",
          function: {
            name: "retrieve_user_memories",
            description: "Retrieve relevant user preferences, dietary restrictions, cooking history, and past conversation context. Use this when you need personalized information about the user.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "What to search for in user's memory (e.g., 'dietary preferences', 'favorite cuisines')",
                },
              },
              required: ["query"],
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Grok API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const choice = data.choices[0];

  // Check if AI wants to use the memory tool
  if (choice.finish_reason === "tool_calls" && choice.message?.tool_calls?.length) {
    const toolCall = choice.message.tool_calls[0];
    const args = JSON.parse(toolCall.function.arguments);

    console.log(`[Memory] AI requested memories: "${args.query}"`);

    // Retrieve memories
    const retrieved = await ctx.runAction(api.memory.smartRetrieval.retrieveMemoryContext, {
      userId,
      sessionId,
      query: args.query,
      includeRecent: false,
    });

    // Send tool result back to AI
    const followUpResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://healthymama.app",
        "X-Title": "HealthyMama Community Chat",
      },
      body: JSON.stringify({
        model: "x-ai/grok-4-fast",
        messages: [
          ...messages,
          choice.message,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: retrieved.formattedContext || "No relevant memories found.",
          },
        ],
        temperature,
        max_tokens: 2000,
      }),
    });

    if (!followUpResponse.ok) {
      const error = await followUpResponse.json();
      throw new Error(`Grok follow-up API error: ${JSON.stringify(error)}`);
    }

    const followUpData = await followUpResponse.json();
    return followUpData.choices[0]?.message?.content ?? "I apologize, but I couldn't generate a response.";
  }

  return choice.message?.content ?? "I apologize, but I couldn't generate a response.";
}
