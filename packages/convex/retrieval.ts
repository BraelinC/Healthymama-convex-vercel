// @ts-nocheck
import { query } from "./_generated/server";
import { v } from "convex/values";

type IntentLevel = "simple" | "medium" | "complex";

const RETRIEVAL_PLAN: Record<IntentLevel, { recent: number; vectors: number; includeProfile: boolean; memories: number }> = {
  simple: { recent: 3, vectors: 0, includeProfile: false, memories: 0 },
  medium: { recent: 5, vectors: 3, includeProfile: false, memories: 1 },
  complex: { recent: 10, vectors: 5, includeProfile: true, memories: 3 },
};

export const getContextByIntent = query({
  args: {
    userId: v.string(),
    intent: v.union(v.literal("simple"), v.literal("medium"), v.literal("complex")),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const plan = RETRIEVAL_PLAN[args.intent];

    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(plan.recent);

    const similarMessages =
      plan.vectors > 0 && args.embedding
        ? await ctx.db
            .vectorSearch("messages", "by_embedding", args.embedding, (q) =>
              q.eq("userId", args.userId)
            )
            .take(plan.vectors)
        : [];

    let profileString: string | null = null;

    if (plan.includeProfile) {
      const storedProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .unique();

      if (storedProfile) {
        profileString = storedProfile.preferences;
      } else {
        const userPrefs = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .unique();

        if (userPrefs?.prefs) {
          profileString = JSON.stringify(userPrefs.prefs);
        }
      }
    }

    const memories =
      plan.memories > 0 && args.embedding
        ? await ctx.db
            .vectorSearch("userMemories", "by_embedding", args.embedding, (q) =>
              q.eq("userId", args.userId)
            )
            .take(plan.memories)
        : [];

    return {
      recent: recentMessages.reverse(),
      similar: similarMessages,
      memories,
      profile: profileString,
      metadata: {
        intent: args.intent,
        counts: {
          recent: recentMessages.length,
          similar: similarMessages.length,
          memories: memories.length,
          hasProfile: Boolean(profileString),
        },
      },
    };
  },
});
