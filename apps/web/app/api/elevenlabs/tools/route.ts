import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[ELEVENLABS WEBHOOK] Received tool call:", body);

    const { tool_name, parameters } = body;

    // Route to appropriate tool handler
    switch (tool_name) {
      case "search_recipes":
        return await handleSearchRecipes(parameters);

      case "get_suggestions":
        return await handleGetSuggestions(parameters);

      case "search_memory":
        return await handleSearchMemory(parameters);

      default:
        console.error("[ELEVENLABS WEBHOOK] Unknown tool:", tool_name);
        return Response.json({
          result: "I don't have access to that tool yet."
        });
    }
  } catch (error) {
    console.error("[ELEVENLABS WEBHOOK] Error:", error);
    return Response.json(
      { result: "Sorry, I encountered an error processing your request." },
      { status: 500 }
    );
  }
}

/**
 * Search recipes in the database
 */
async function handleSearchRecipes(parameters: {
  query: string;
  limit?: number;
  userId?: string;
  communityId?: string;
}) {
  try {
    const { query, limit = 5, userId = "system", communityId = "mn714r42da03y0xrdz87m3h6ts7tz302" } = parameters;

    console.log("[SEARCH RECIPES] Query:", query, "Limit:", limit);

    const recipes = await convex.action(
      api.recipes.recipeRetrieval.searchRecipesByQuery,
      {
        query,
        userId,
        communityId,
        limit
      }
    );

    if (!recipes || recipes.length === 0) {
      return Response.json({
        result: `I couldn't find any recipes matching "${query}". Would you like to try a different search?`
      });
    }

    // Format top 3 recipes for voice response
    const topRecipes = recipes.slice(0, 3);
    const recipeDescriptions = topRecipes.map((r: any, i: number) =>
      `${i + 1}. ${r.name || r.recipeName}: ${(r.description || "").substring(0, 100)}`
    ).join(". ");

    const result = `I found ${recipes.length} recipe${recipes.length > 1 ? 's' : ''} for ${query}. ${recipeDescriptions}. I've displayed them on your screen. Which one would you like to know more about?`;

    return Response.json({ result });
  } catch (error) {
    console.error("[SEARCH RECIPES] Error:", error);
    return Response.json({
      result: "I had trouble searching for recipes. Please try again."
    });
  }
}

/**
 * Get personalized meal suggestions for the user
 */
async function handleGetSuggestions(parameters: {
  userId: string;
}) {
  try {
    const { userId } = parameters;

    console.log("[GET SUGGESTIONS] UserId:", userId);

    const suggestionsResult = await convex.action(
      api.ai.userSuggestions.getOrGenerateSuggestions,
      { userId }
    );

    const suggestions = suggestionsResult.suggestions || [];

    if (suggestions.length === 0) {
      return Response.json({
        result: "I don't have any personalized suggestions ready yet. Let me get to know your preferences first. What types of meals do you enjoy?"
      });
    }

    // Pick 5 random suggestions to share
    const randomSuggestions = suggestions
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    const result = `Based on your preferences, here are some meal ideas: ${randomSuggestions.join(", ")}. I've displayed more options on your screen. What sounds good to you?`;

    return Response.json({ result });
  } catch (error) {
    console.error("[GET SUGGESTIONS] Error:", error);
    return Response.json({
      result: "I had trouble getting your personalized suggestions. Please try again."
    });
  }
}

/**
 * Search user's memory (preferences, past conversations)
 */
async function handleSearchMemory(parameters: {
  query: string;
  userId: string;
  timeRange?: string;
  memoryType?: "preference" | "conversation" | "all";
}) {
  try {
    const { query, userId, timeRange, memoryType = "all" } = parameters;

    console.log("[SEARCH MEMORY] Query:", query, "UserId:", userId);

    const memoryResults = await convex.action(
      api.memory.smartMemoryRouter.searchMemory,
      {
        query,
        userId,
        timeRange,
        memoryType
      }
    );

    // Format results for voice
    const preferences = memoryResults.preferences || [];
    const conversations = memoryResults.conversations || [];
    const recentRecipes = memoryResults.recentRecipes || [];

    let resultParts: string[] = [];

    if (preferences.length > 0) {
      const prefSummary = preferences.slice(0, 2).map((p: any) => p.summary).join(", ");
      resultParts.push(`Your preferences: ${prefSummary}`);
    }

    if (recentRecipes.length > 0) {
      const recipeSummary = recentRecipes.slice(0, 2).map((r: any) => r.recipeName).join(", ");
      resultParts.push(`Recently you've discussed: ${recipeSummary}`);
    }

    if (resultParts.length === 0) {
      return Response.json({
        result: `I don't have any information about "${query}" in your history yet.`
      });
    }

    return Response.json({
      result: resultParts.join(". ")
    });
  } catch (error) {
    console.error("[SEARCH MEMORY] Error:", error);
    return Response.json({
      result: "I had trouble searching your preferences. Please try again."
    });
  }
}
