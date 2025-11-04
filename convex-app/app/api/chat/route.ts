import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { decideIntent } from "@/lib/intent";
import { callGrokChat, GrokContextChunk } from "@/lib/grok";

export const runtime = "nodejs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
}

const convex = new ConvexHttpClient(convexUrl);

type IntentLevel = "simple" | "medium" | "complex";

const RETRIEVAL_PLAN: Record<IntentLevel, { recent: number; vectors: number; memories: number; includeProfile: boolean }> = {
  simple: { recent: 3, vectors: 0, memories: 0, includeProfile: false },
  medium: { recent: 5, vectors: 3, memories: 1, includeProfile: false },
  complex: { recent: 10, vectors: 5, memories: 3, includeProfile: true },
};

const PLAN_REQUIRES_EMBEDDING = (intent: IntentLevel) =>
  RETRIEVAL_PLAN[intent].vectors > 0 || RETRIEVAL_PLAN[intent].memories > 0;

interface ChatRequestBody {
  query: string;
  userId: string;
  email?: string;
}

interface ConvexMessage {
  _id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  intent?: IntentLevel;
  confidence?: number;
  createdAt: number;
}

function parseProfile(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    return raw;
  }
  return raw;
}

function buildSystemPrompt(intent: IntentLevel, context: any, query: string): { prompt: string; contextMessages: GrokContextChunk[] } {
  let prompt = "You are a helpful AI assistant focused on healthy cooking, nutrition, and meal planning.";

  const profileText = parseProfile(context.profile);
  if (profileText) {
    prompt += `\n\nUser preferences and profile:\n${profileText}`;
  }

  if (context.memories && context.memories.length > 0) {
    prompt += `\n\nLong-term memories about this user:\n${context.memories
      .map((m: any, index: number) => `${index + 1}. ${m.text}`)
      .join("\n")}`;
  }

  if (context.similar && context.similar.length > 0) {
    prompt += `\n\nRelevant prior messages:\n${context.similar
      .map((m: ConvexMessage) => `• (${m.role}) ${m.content}`)
      .join("\n")}`;
  }

  prompt += `\n\nAlways provide clear, encouraging guidance tailored to the user's stated goal.`;

  const history: GrokContextChunk[] = [];
  if (Array.isArray(context.recent)) {
    const sorted: ConvexMessage[] = [...context.recent].sort((a, b) => a.createdAt - b.createdAt);
    for (const msg of sorted) {
      const role = msg.role === "assistant" ? "assistant" : "user";
      history.push({ role, content: msg.content });
    }
  }

  return { prompt, contextMessages: history };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    if (!body.query || !body.userId) {
      return NextResponse.json({ error: "Missing query or userId" }, { status: 400 });
    }

    const trimmedQuery = body.query.trim();
    if (trimmedQuery.length === 0) {
      return NextResponse.json({ error: "Query cannot be empty" }, { status: 400 });
    }

    // Step 1: classify intent
    const intentStart = Date.now();
    const intentDecision = await decideIntent(trimmedQuery);
    const intentTime = Date.now() - intentStart;

    // Determine whether vector embedding is required
    let embedding: number[] | undefined;
    let embeddingTime = 0;
    if (PLAN_REQUIRES_EMBEDDING(intentDecision.intent)) {
      const embedStart = Date.now();
      // Note: This route appears to be using an older chat system (non-streaming)
      // The main chat system is in /api/chat/stream/route.ts which uses the new profile merge
      // This embedding call needs to be updated or this route deprecated
      // For now, skipping embedding to fix build
      embeddingTime = Date.now() - embedStart;
    }

    // Step 2: retrieve context from Convex
    const contextStart = Date.now();
    const context = await convex.query(api.retrieval.getContextByIntent, {
      userId: body.userId,
      intent: intentDecision.intent,
      embedding,
    });
    const contextTime = Date.now() - contextStart;

    // Persist the user message (for future retrieval)
    const saveUserResult = await convex.mutation(api.chat.messages.saveMessage, {
      userId: body.userId,
      role: "user",
      content: trimmedQuery,
      intent: intentDecision.intent,
      confidence: intentDecision.confidence,
    });

    if (saveUserResult.shouldEmbed && embedding) {
      // We already generated embedding for the query above; reuse it.
      await convex.mutation(api.chat.messages.updateMessageEmbedding, {
        messageId: saveUserResult.messageId,
        embedding,
      });
    } else if (saveUserResult.shouldEmbed && !embedding) {
      // Need to embed separately
      await convex.action(api.embeddings.embedMessage, {
        messageId: saveUserResult.messageId,
        content: trimmedQuery,
      });
    }

    // Build prompt + context messages
    const { prompt: systemPrompt, contextMessages } = buildSystemPrompt(intentDecision.intent, context, trimmedQuery);

    // Step 3: Call Grok for response generation
    const grokStart = Date.now();
    const assistantReply = await callGrokChat({
      intent: intentDecision.intent,
      systemPrompt,
      context: contextMessages,
      query: trimmedQuery,
    });
    const grokTime = Date.now() - grokStart;

    // Save assistant response
    const saveAssistantResult = await convex.mutation(api.chat.messages.saveAssistantResponse, {
      userId: body.userId,
      content: assistantReply,
      intent: intentDecision.intent,
    });

    if (saveAssistantResult.shouldEmbed) {
      await convex.action(api.embeddings.embedMessage, {
        messageId: saveAssistantResult.messageId,
        content: assistantReply,
      });
    }

    // Log analytics
    await convex.mutation(api.analytics.logIntent, {
      userId: body.userId,
      query: trimmedQuery,
      intent: intentDecision.intent,
      confidence: intentDecision.confidence,
      usedAI: intentDecision.usedGrok,
      latency: intentTime + contextTime + grokTime + embeddingTime,
      heuristicLatency: intentDecision.latency.heuristic,
      grokLatency: intentDecision.latency.grok,
    });

    return NextResponse.json({
      response: assistantReply,
      metadata: {
        intent: intentDecision.intent,
        confidence: intentDecision.confidence,
        usedGrok: intentDecision.usedGrok,
        timing: {
          intent: intentTime,
          embedding: embeddingTime,
          context: contextTime,
          grok: grokTime,
        },
        context: context.metadata,
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
