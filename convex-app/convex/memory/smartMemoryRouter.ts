import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Unified memory search tool for AI
 * Intelligently routes to Tier 2 (preferences) or Tier 3 (conversations) based on query
 */
export const searchMemory = action({
  args: {
    userId: v.string(),
    communityId: v.optional(v.string()),
    query: v.string(),
    timeRange: v.optional(v.string()), // "today", "this_week", "last_week", "last_month"
    memoryType: v.optional(v.string()), // Optional hint: "preference", "conversation", "recipe"
  },
  handler: async (ctx, args) => {
    console.log(`[SMART MEMORY ROUTER] Query: "${args.query}"`);

    // Step 1: Classify query type (fast - GPT-4o-mini)
    const queryType = await classifyQuery(args.query, args.memoryType);
    console.log(`[SMART MEMORY ROUTER] Query type: ${queryType}`);

    // Step 2: Route to appropriate tier(s)
    const results: any = {
      queryType,
      preferences: [],
      conversations: [],
      recentRecipes: [],
    };

    if (queryType === "RECIPE" || queryType === "GENERAL_KNOWLEDGE") {
      // Search Tier 2.5: Recent Meals
      const timeRangeDays = parseTimeRange(args.timeRange);
      const recentRecipes = await ctx.runAction(
        api.memory.recentMeals.searchRecentMeals,
        {
          userId: args.userId,
          query: args.query,
          timeRangeDays,
          limit: 5,
        }
      );
      results.recentRecipes = recentRecipes;
      console.log(`[SMART MEMORY ROUTER] Found ${recentRecipes.length} recent recipes`);
    }

    if (queryType === "PREFERENCE" || queryType === "GENERAL_KNOWLEDGE") {
      // Search Tier 2: Learned Preferences
      const preferences = await ctx.runAction(
        api.memory.learnedPreferences.searchPreferences,
        {
          userId: args.userId,
          agentId: args.communityId,
          query: args.query,
          limit: 5,
        }
      );
      results.preferences = preferences;
      console.log(`[SMART MEMORY ROUTER] Found ${preferences.length} preferences`);
    }

    if (queryType === "SPECIFIC_CONVERSATION" || queryType === "GENERAL_KNOWLEDGE") {
      // Search Tier 3: Conversation Summaries
      const timeRangeDays = parseTimeRange(args.timeRange);
      const conversations = await ctx.runAction(
        api.memory.conversationSummaries.searchConversationSummaries,
        {
          userId: args.userId,
          communityId: args.communityId,
          query: args.query,
          timeRangeDays,
          limit: 3,
        }
      );
      results.conversations = conversations;
      console.log(`[SMART MEMORY ROUTER] Found ${conversations.length} conversations`);
    }

    return results;
  },
});

/**
 * Classify query type using GPT-4o-mini (fast and cheap)
 */
async function classifyQuery(
  query: string,
  hint?: string
): Promise<"PREFERENCE" | "SPECIFIC_CONVERSATION" | "RECIPE" | "GENERAL_KNOWLEDGE"> {
  // If hint provided, use it directly
  if (hint === "preference") return "PREFERENCE";
  if (hint === "conversation") return "SPECIFIC_CONVERSATION";
  if (hint === "recipe") return "RECIPE";

  const classificationPrompt = `Classify this user query into ONE category:

1. PREFERENCE: QUESTIONS asking about user's food preferences, cooking habits, dietary needs, or lifestyle
   Examples:
   - "Do I like chicken?" (questioning existing preference)
   - "What are my cooking habits?" (asking about learned patterns)
   - "Did I say I'm allergic to anything?" (checking past dietary mentions)
   - "What are my dietary restrictions?" (asking about preferences)

2. SPECIFIC_CONVERSATION: QUESTIONS about a specific past conversation from a certain time period
   Examples:
   - "What did we talk about on Monday?" (time-specific conversation recall)
   - "What was that conversation about pasta?" (referring to past discussion)

3. RECIPE: User wants a SPECIFIC RECIPE they discussed or saw recently
   Examples:
   - "Make the lasagna from last week" (specific recipe by time reference)
   - "That chicken curry we talked about" (specific recipe by name reference)
   - "The chocolate cake recipe" (specific recipe reference)
   - "Show me that pasta recipe again" (retrieving discussed recipe)

4. GENERAL_KNOWLEDGE: Broad query that may need both preferences and conversation history
   Examples: "What do I usually cook?", "Show me my favorite recipes", "What have we been cooking lately?"

IMPORTANT: Only classify as PREFERENCE, SPECIFIC_CONVERSATION, or RECIPE if the user is ASKING A QUESTION about past information.
Do NOT classify statements like "I love chicken" or "I want dinner" - these are NEW information, not queries about the past.

Query: "${query}"

Return ONLY one word: PREFERENCE, SPECIFIC_CONVERSATION, RECIPE, or GENERAL_KNOWLEDGE`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: classificationPrompt }],
      temperature: 0,
      max_tokens: 50,
    });

    const classification = response.choices[0].message.content
      ?.trim()
      .toUpperCase();

    if (
      classification === "PREFERENCE" ||
      classification === "SPECIFIC_CONVERSATION" ||
      classification === "RECIPE" ||
      classification === "GENERAL_KNOWLEDGE"
    ) {
      return classification as any;
    }

    // Default to GENERAL_KNOWLEDGE if unclear
    return "GENERAL_KNOWLEDGE";
  } catch (error) {
    console.error("[QUERY CLASSIFICATION] Error:", error);
    return "GENERAL_KNOWLEDGE";
  }
}

/**
 * Parse natural language time range to days
 */
function parseTimeRange(timeRange?: string): number | undefined {
  if (!timeRange) return undefined;

  const lowerRange = timeRange.toLowerCase();

  if (lowerRange.includes("today")) return 1;
  if (lowerRange.includes("yesterday")) return 2;
  if (lowerRange.includes("this week") || lowerRange.includes("this_week"))
    return 7;
  if (lowerRange.includes("last week") || lowerRange.includes("last_week"))
    return 14; // Current week + last week
  if (lowerRange.includes("this month") || lowerRange.includes("this_month"))
    return 30;
  if (lowerRange.includes("last month") || lowerRange.includes("last_month"))
    return 60; // Current month + last month

  // Try to extract number of days from query
  const daysMatch = timeRange.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    return parseInt(daysMatch[1]);
  }

  return undefined;
}

/**
 * Get full conversation details (Stage 2 deep retrieval)
 */
export const getConversationDetails = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.runQuery(
      api.memory.conversationSummaries.getFullConversation,
      {
        sessionId: args.sessionId,
      }
    );

    return messages;
  },
});

/**
 * Tool definition for AI (exported for use in system prompts)
 */
export const MEMORY_TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "search_memory",
    description: `Search user's memories, preferences, and past conversations. Use this when the user asks about:
- Their food preferences, likes/dislikes, dietary restrictions
- Their cooking habits, time constraints, lifestyle
- Past conversations or recipes they've discussed
- Specific recipes or discussions from a certain time period`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for (e.g., 'Do I like chicken?', 'That sauce from last week')",
        },
        timeRange: {
          type: "string",
          description:
            "Optional time range for searching past conversations: 'today', 'this_week', 'last_week', 'last_month'",
          enum: ["today", "this_week", "last_week", "last_month"],
        },
        memoryType: {
          type: "string",
          description:
            "Optional hint about what type of memory to search: 'preference', 'conversation', 'recipe'",
          enum: ["preference", "conversation", "recipe"],
        },
      },
      required: ["query"],
    },
  },
};
