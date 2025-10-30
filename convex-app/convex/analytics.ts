import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const logIntent = mutation({
  args: {
    userId: v.string(),
    query: v.string(),
    intent: v.union(v.literal("simple"), v.literal("medium"), v.literal("complex")),
    confidence: v.number(),
    usedAI: v.boolean(),
    latency: v.number(),
    heuristicLatency: v.optional(v.number()),
    grokLatency: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("intentLogs", {
      userId: args.userId,
      query: args.query,
      intent: args.intent,
      confidence: args.confidence,
      usedAI: args.usedAI,
      latency: args.latency,
      metadata: {
        heuristicLatency: args.heuristicLatency,
        grokLatency: args.grokLatency,
      },
      timestamp: Date.now(),
    });
  },
});
