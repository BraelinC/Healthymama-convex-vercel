import { classifyQueryHeuristic, HeuristicIntentResult, IntentLevel } from "./heuristics";
import { classifyIntentWithGrok } from "./grok";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

export interface IntentDecision {
  intent: IntentLevel;
  confidence: number;
  usedGrok: boolean;
  heuristic: HeuristicIntentResult;
  latency: {
    heuristic: number;
    grok?: number;
  };
}

function getThreshold() {
  const raw = process.env.INTENT_CONFIDENCE_THRESHOLD;
  if (!raw) return DEFAULT_CONFIDENCE_THRESHOLD;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_CONFIDENCE_THRESHOLD;
}

export async function decideIntent(query: string): Promise<IntentDecision> {
  const start = Date.now();
  const heuristic = classifyQueryHeuristic(query);
  const heuristicLatency = Date.now() - start;

  if (heuristic.confidence >= getThreshold() && !heuristic.needsAI) {
    return {
      intent: heuristic.intent,
      confidence: heuristic.confidence,
      usedGrok: false,
      heuristic,
      latency: {
        heuristic: heuristicLatency,
      },
    };
  }

  const grokStart = Date.now();
  const grokIntent = await classifyIntentWithGrok(query);
  const grokLatency = Date.now() - grokStart;

  return {
    intent: grokIntent,
    confidence: Math.max(heuristic.confidence, getThreshold()),
    usedGrok: true,
    heuristic,
    latency: {
      heuristic: heuristicLatency,
      grok: grokLatency,
    },
  };
}
