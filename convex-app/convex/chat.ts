import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createOrUpdateUser, getUserProfile } from "./users";
import { searchRecipes } from "./recipes";

const COMPLETIONS_MODEL = "gpt-4o-mini";
const TOOL_CLASSIFIER_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";

type ToolCallDecision =
  | { type: "respond"; rationale: string }
  | { type: "search"; rationale: string; query: string };

async function classifyIntent({
  message,
  community,
  apiKey,
}: {
  message: string;
  community: string;
  apiKey: string;
}): Promise<ToolCallDecision> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TOOL_CLASSIFIER_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a recipe assistant. Decide whether to call the search tool when the user is asking for recipe ideas. Respond directly otherwise.",
        },
        {
          role: "user",
          content: `Community: ${community}\nUser message: ${message}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "search_recipes",
            description: "Search the recipe knowledge base for relevant matches.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "A focused recipe search query",
                },
                community: {
                  type: "string",
                  description: "Community identifier to scope the search",
                },
              },
              required: ["query", "community"],
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI tool classification failed: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (choice?.finish_reason === "tool_calls" && choice?.message?.tool_calls?.length) {
    const toolCall = choice.message.tool_calls[0];
    const args = JSON.parse(toolCall.function.arguments) as { query: string; community: string };
    return {
      type: "search",
      rationale: "User asked for recipe ideas that benefit from lookup.",
      query: args.query || message,
    };
  }

  const rationale = choice?.message?.content ?? "Respond directly.";
  return { type: "respond", rationale };
}

async function embedWithCache(ctx: any, text: string, apiKey: string) {
  return await ctx.actionCache.fetch(["embedding", EMBEDDING_MODEL, text], async () => {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`OpenAI embedding failed: ${JSON.stringify(err)}`);
    }

    const payload = await response.json();
    return payload.data[0].embedding as number[];
  });
}

async function draftAssistantReply({
  apiKey,
  message,
  recipes,
  profile,
  community,
}: {
  apiKey: string;
  message: string;
  recipes: Array<any>;
  profile: any;
  community: string;
}) {
  const recipeSummaries = recipes
    .map(
      (recipe, index) =>
        `Recipe ${index + 1}: ${recipe.name}
Community: ${recipe.community}
Diet Tags: ${recipe.dietTags.join(", ")}
Description: ${recipe.description}
Key ingredients: ${recipe.ingredients.slice(0, 6).join(", ")}
Steps: ${recipe.steps.slice(0, 3).join(" → ")}`
    )
    .join("\n\n");

  const profileContext = profile
    ? `User preferences: diet=${profile.prefs.diet ?? "unspecified"}, favorites=${profile.prefs.favorites.join(
        ", "
      )}`
    : "No saved preferences.";

  const prompt = [
    {
      role: "system",
      content: `You are RecipeAI, a culinary assistant for ${community}. Provide concise, friendly recipe suggestions.`,
    },
    {
      role: "user",
      content: message,
    },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: COMPLETIONS_MODEL,
      temperature: 0.7,
      messages: [
        ...prompt,
        {
          role: "system",
          content: `Context:\n${profileContext}\n\nTop recipe matches:\n${recipeSummaries || "No matches found."}`,
        },
        {
          role: "system",
          content:
            "If recipes are available, highlight 2-3 options with key ingredients and brief cooking notes. If not, offer alternative guidance.",
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI completion failed: ${JSON.stringify(err)}`);
  }

  const completion = await response.json();
  return completion.choices?.[0]?.message?.content ?? "I'm not sure how to help with that yet!";
}

export const sendMessage = mutation({
  args: {
    userId: v.string(),
    community: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatMessages", {
      userId: args.userId,
      community: args.community,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

export const listMessages = query({
  args: {
    userId: v.string(),
    community: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const results = await ctx.db
      .query("chatMessages")
      .withIndex("by_user_community_createdAt", (q) =>
        q.eq("userId", args.userId).eq("community", args.community)
      )
      .order("desc")
      .take(limit);

    return results.reverse();
  },
});

export const handleChatQuery = action({
  args: {
    userId: v.string(),
    email: v.string(),
    community: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    await ctx.runMutation(sendMessage as any, {
      userId: args.userId,
      community: args.community,
      role: "user",
      content: args.message,
    });

    let profile = await ctx.runQuery(getUserProfile as any, { userId: args.userId });
    if (!profile) {
      await ctx.runMutation(createOrUpdateUser as any, {
        userId: args.userId,
        email: args.email,
        prefs: { diet: undefined, favorites: [] },
      });
      profile = await ctx.runQuery(getUserProfile as any, { userId: args.userId });
    }

    const decision = await classifyIntent({
      message: args.message,
      community: args.community,
      apiKey,
    });

    let recipes: any = [];

    if (decision.type === "search") {
      const embedding = await embedWithCache(ctx, decision.query, apiKey);
      recipes = await ctx.runQuery(searchRecipes as any, {
        embedding,
        community: args.community,
        dietPreference: profile?.prefs.diet,
        excludedIngredientTerms: [],
        limit: 5,
      });
    }

    const reply = await draftAssistantReply({
      apiKey,
      message: args.message,
      recipes,
      profile,
      community: args.community,
    });

    await ctx.runMutation(sendMessage as any, {
      userId: args.userId,
      community: args.community,
      role: "assistant",
      content: reply,
    });

    return {
      reply,
      recipes,
      decision,
    };
  },
});
