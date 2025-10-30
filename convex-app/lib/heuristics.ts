const SIMPLE_PATTERNS = /^(hi|hey|hello|thanks|thank you|yes|no|ok|okay|sure|cool|great)$/i;
const COMPLEX_KEYWORDS = [
  "how do",
  "why",
  "explain",
  "compare",
  "history",
  "step by step",
  "walk me through",
  "all of",
  "help me plan",
];

const CLAUSE_REGEX = /\b(and|or|but)\b/gi;

export type IntentLevel = "simple" | "medium" | "complex";

export interface HeuristicIntentResult {
  intent: IntentLevel;
  confidence: number;
  needsAI: boolean;
  reasons: string[];
}

export function classifyQueryHeuristic(query: string): HeuristicIntentResult {
  const reasons: string[] = [];
  const normalized = query.trim().toLowerCase();
  const wordCount = normalized.length === 0 ? 0 : normalized.split(/\s+/).length;

  if (normalized.length === 0) {
    reasons.push("empty input");
    return { intent: "simple", confidence: 0.5, needsAI: false, reasons };
  }

  if (wordCount <= 3 || SIMPLE_PATTERNS.test(normalized)) {
    reasons.push("greeting/short utterance");
    return { intent: "simple", confidence: 0.95, needsAI: false, reasons };
  }

  const matchesKeyword = COMPLEX_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const clauseMatches = normalized.match(CLAUSE_REGEX);
  const clauseCount = clauseMatches ? clauseMatches.length : 0;

  if (wordCount > 20 || matchesKeyword || clauseCount >= 2) {
    if (wordCount > 20) reasons.push("long query");
    if (matchesKeyword) reasons.push("complex keyword");
    if (clauseCount >= 2) reasons.push("multiple clauses");
    return { intent: "complex", confidence: 0.88, needsAI: false, reasons };
  }

  if (wordCount >= 4 && wordCount <= 12) {
    reasons.push("ambiguous medium-range query");
    return { intent: "medium", confidence: 0.6, needsAI: true, reasons };
  }

  reasons.push("default medium classification");
  return { intent: "medium", confidence: 0.55, needsAI: true, reasons };
}
