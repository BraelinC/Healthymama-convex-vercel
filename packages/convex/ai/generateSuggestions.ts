"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

interface LearnedPreference {
  preferenceType: string;
  summary: string;
}

interface RecentMeal {
  recipeName: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Generate 20 personalized meal suggestions for voice interface
 * Uses Google Gemini via OpenRouter
 */
export const generateSuggestions = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // Get user context (profile + learned preferences + recent meals)
    const userProfile = await ctx.runQuery(api.userProfile.getUserProfile, {
      userId: args.userId,
    });

    const learnedPrefs = await ctx.runQuery(api.memory.learnedPreferences.getTopPreferences, {
      userId: args.userId,
      agentId: undefined,
      limit: 10,
    });

    const recentMeals = await ctx.runQuery(api.memory.recentMeals.getRecentMeals, {
      userId: args.userId,
      limit: 10,
      days: 7,
    });

    // Build context string
    let contextParts: string[] = [];

    if (userProfile) {
      contextParts.push(`Profile: ${userProfile.name || "User"}`);
      if (userProfile.familySize) contextParts.push(`Family: ${userProfile.familySize} people`);
      if (userProfile.allergens?.length > 0) {
        contextParts.push(`⚠️ ALLERGENS (MUST AVOID): ${userProfile.allergens.join(", ")}`);
      }
      if (userProfile.dietaryPreferences?.length > 0) {
        contextParts.push(`Dietary Preferences: ${userProfile.dietaryPreferences.join(", ")}`);
      }
      if (userProfile.preferredCuisines?.length > 0) {
        contextParts.push(`Preferred Cuisines: ${userProfile.preferredCuisines.join(", ")}`);
      }
    }

    if (learnedPrefs && learnedPrefs.length > 0) {
      const prefs = learnedPrefs as LearnedPreference[];
      const loves = prefs.filter((p: LearnedPreference) => p.preferenceType === "food_love").map((p: LearnedPreference) => p.summary);
      const dislikes = prefs.filter((p: LearnedPreference) => p.preferenceType === "food_dislike").map((p: LearnedPreference) => p.summary);
      const habits = prefs.filter((p: LearnedPreference) => p.preferenceType === "cooking_habit").map((p: LearnedPreference) => p.summary);

      if (loves.length > 0) contextParts.push(`Loves: ${loves.join(", ")}`);
      if (dislikes.length > 0) contextParts.push(`Dislikes: ${dislikes.join(", ")}`);
      if (habits.length > 0) contextParts.push(`Habits: ${habits.join(", ")}`);
    }

    if (recentMeals && recentMeals.length > 0) {
      const meals = recentMeals as RecentMeal[];
      const recentList = meals.map((m: RecentMeal) => m.recipeName).join(", ");
      contextParts.push(`Recent meals: ${recentList}`);
    }

    const userContext = contextParts.join(" | ");

    // Generate suggestions via OpenRouter + Gemini
    const apiKey = process.env.OPEN_ROUTER_API_KEY!;

    const prompt = `You are a helpful cooking assistant. Based on the user's profile and preferences, generate 20 DIVERSE meal suggestion phrases.

User Context:
${userContext}

Requirements:
- Each phrase must be 2-3 words max
- Mix breakfast, lunch, dinner, and snack ideas
- Be specific and actionable (e.g., "Quick breakfast", "Healthy lunch", "Easy dinner", "Protein snack")
- **CRITICAL**: If allergens are listed (⚠️ ALLERGENS), NEVER suggest any meals containing those ingredients. This is life-threatening.
- Respect dietary preferences (vegan, keto, etc.) when present
- Personalize based on their preferences and learned habits
- Include variety of cuisines if they have preferences
- Avoid recently eaten meals if possible
- Make suggestions practical and appealing

Return ONLY a JSON array of exactly 20 suggestion strings, no other text.
Example format: ["Quick breakfast", "Healthy lunch", "Easy dinner", ...]`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://healthymama.app",
          "X-Title": "HealthyMama Suggestion Generator",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[GENERATE SUGGESTIONS] OpenRouter API error:", errorText);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json() as OpenRouterResponse;
      const content = data.choices[0].message.content;

      // Parse JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("[GENERATE SUGGESTIONS] Could not parse JSON from response:", content);
        throw new Error("Failed to parse suggestions from AI response");
      }

      const suggestions: string[] = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error("AI returned invalid suggestions format");
      }

      const latency = Date.now() - startTime;
      console.log(`[GENERATE SUGGESTIONS] Generated ${suggestions.length} suggestions in ${latency}ms`);

      return {
        suggestions: suggestions.slice(0, 20), // Ensure exactly 20
        contextSnapshot: userContext.substring(0, 500), // Store brief context
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error("[GENERATE SUGGESTIONS] Error:", error);

      // Fallback: Return generic suggestions if AI fails
      return {
        suggestions: [
          "Quick breakfast",
          "Healthy lunch",
          "Easy dinner",
          "Protein snack",
          "Light meal",
          "Comfort food",
          "Meal prep",
          "Quick recipe",
          "Vegetarian option",
          "Low carb",
          "High protein",
          "Kid friendly",
          "One pot",
          "30 minute",
          "Sheet pan",
          "Slow cooker",
          "Healthy dessert",
          "Soup recipe",
          "Salad idea",
          "Pasta dish",
        ],
        contextSnapshot: "Fallback suggestions (AI error)",
        generatedAt: Date.now(),
      };
    }
  },
});
