import { IntentLevel } from "./heuristics";

const CLASSIFICATION_PROMPT = `Classify the user's latest message into one of three buckets:
- simple: greetings, acknowledgements, very short answers
- medium: straightforward requests or single instructions
- complex: analytical, multi-step, or exploratory questions

Reply with only one word: simple, medium, or complex.`;

function getXaiApiKey(): string {
  const key = process.env.XAI_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  if (!key) {
    throw new Error("Missing Grok API key. Set XAI_API_KEY or OPEN_ROUTER_API_KEY.");
  }
  return key;
}

interface GrokOptions {
  model?: "grok-4-fast-non-reasoning" | "grok-4-fast";
  temperature?: number;
  maxTokens?: number;
}

async function callGrokApi(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, options: GrokOptions) {
  const key = getXaiApiKey();
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: options.model ?? "grok-4-fast-non-reasoning",
      messages,
      max_tokens: options.maxTokens ?? 256,
      temperature: options.temperature ?? 0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Grok API error (${response.status}): ${errText}`);
  }

  const payload = await response.json();
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function classifyIntentWithGrok(query: string): Promise<IntentLevel> {
  try {
    const completion = await callGrokApi(
      [
        { role: "system", content: CLASSIFICATION_PROMPT },
        { role: "user", content: query },
      ],
      { model: "grok-4-fast-non-reasoning", maxTokens: 10, temperature: 0 }
    );

    const normalized = completion.toLowerCase();
    if (normalized.includes("simple")) return "simple";
    if (normalized.includes("medium")) return "medium";
    if (normalized.includes("complex")) return "complex";
    return "medium";
  } catch (error) {
    console.error("[Grok] classification failed:", error);
    return "medium";
  }
}

interface SelectModelOptions {
  intent: IntentLevel;
}

function selectChatModel({ intent }: SelectModelOptions) {
  return intent === "simple" ? "grok-4-fast-non-reasoning" : "grok-4-fast";
}

function selectMaxTokens(intent: IntentLevel) {
  return intent === "simple" ? 250 : intent === "medium" ? 750 : 1200;
}

export interface GrokContextChunk {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function callGrokChat({
  intent,
  systemPrompt,
  context,
  query,
}: {
  intent: IntentLevel;
  systemPrompt: string;
  context: GrokContextChunk[];
  query: string;
}): Promise<string> {
  const messages: GrokContextChunk[] = [
    { role: "system", content: systemPrompt },
    ...context,
    { role: "user", content: query },
  ];

  try {
    const completion = await callGrokApi(messages, {
      model: selectChatModel({ intent }),
      temperature: 0.7,
      maxTokens: selectMaxTokens(intent),
    });

    return completion || "I'm not sure how to help with that yet!";
  } catch (error) {
    console.error("[Grok] chat generation failed:", error);
    throw error;
  }
}
