import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const EMBEDDING_MODEL = "text-embedding-3-small";

function shouldEmbed(content: string) {
  const trimmed = content.trim();
  if (trimmed.length < 50) return false;
  if (/^(hi|hello|hey|thanks|thank you|ok|okay)\b/i.test(trimmed)) return false;
  return true;
}

export const saveMessage = mutation({
  args: {
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    intent: v.optional(v.union(v.literal("simple"), v.literal("medium"), v.literal("complex"))),
    confidence: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const createdAt = args.createdAt ?? Date.now();
    const messageId = await ctx.db.insert("messages", {
      userId: args.userId,
      role: args.role,
      content: args.content,
      intent: args.intent,
      confidence: args.confidence,
      createdAt,
      embeddingModel: shouldEmbed(args.content) ? EMBEDDING_MODEL : undefined,
      embedding: undefined,
    });

    return {
      messageId,
      shouldEmbed: shouldEmbed(args.content),
    };
  },
});

export const updateMessageEmbedding = mutation({
  args: {
    messageId: v.id("messages"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      embedding: args.embedding,
    });
  },
});

export const saveAssistantResponse = mutation({
  args: {
    userId: v.string(),
    content: v.string(),
    intent: v.union(v.literal("simple"), v.literal("medium"), v.literal("complex")),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const createdAt = args.createdAt ?? Date.now();
    const messageId = await ctx.db.insert("messages", {
      userId: args.userId,
      role: "assistant",
      content: args.content,
      intent: args.intent,
      confidence: 1,
      createdAt,
      embeddingModel: shouldEmbed(args.content) ? EMBEDDING_MODEL : undefined,
      embedding: undefined,
    });

    return {
      messageId,
      shouldEmbed: shouldEmbed(args.content),
    };
  },
});

export type SaveMessageReturn = Awaited<ReturnType<typeof saveMessage["handler"]>>;
