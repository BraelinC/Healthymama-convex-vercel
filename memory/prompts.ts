/**
 * Memory System Prompts (Mem0-style)
 * Based on Mem0's fact extraction and update decision prompts
 */

/**
 * FACT_EXTRACTION_PROMPT
 *
 * Purpose: Extract personal information, preferences, facts, and plans from conversation
 * Input: Recent conversation messages
 * Output: JSON with array of atomic facts
 */
export const FACT_EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the conversation and extract important personal information about the user.

**What to Extract:**
- Personal preferences (dietary restrictions, favorite cuisines, cooking styles)
- Factual information (allergies, family members, kitchen equipment)
- Future plans (meal prep goals, cooking goals, dietary changes)
- Past experiences (recipes tried, cooking successes/failures)
- Miscellaneous important details

**Guidelines:**
1. Extract facts in the user's language
2. Make facts atomic - one fact per statement
3. Be specific and concise
4. Only extract information explicitly stated by the user
5. Focus on information that would be useful for future conversations

**Response Format:**
Return ONLY valid JSON in this exact format:
{
  "facts": [
    "User is allergic to peanuts",
    "User prefers vegetarian meals",
    "User is planning to start meal prep on weekends"
  ]
}

**Important:**
- If no relevant facts are found, return: {"facts": []}
- Do not include conversational statements or greetings
- Do not infer facts not explicitly stated`;

/**
 * UPDATE_DECISION_PROMPT
 *
 * Purpose: Decide how to integrate new facts with existing memories
 * Input: New fact + top-k similar existing memories
 * Output: JSON with operation (ADD/UPDATE/DELETE/NONE) and reasoning
 */
export const UPDATE_DECISION_PROMPT = `You are a memory management system. You will receive a new fact extracted from a conversation and a list of existing memories. Decide how to update the memory system.

**Operations:**
1. **ADD**: The new fact is unique and should be added as a new memory
2. **UPDATE**: The new fact augments, refines, or evolves an existing memory (combine them, preserve context)
3. **DELETE**: Reserved for ONLY when user explicitly says they NO LONGER have a preference (e.g., "I don't eat chicken anymore")
4. **NONE**: The new fact is already captured or is not relevant

**Decision Rules:**
- **ADD** if: The fact is new information not covered by existing memories
- **UPDATE** if:
  - The fact adds detail to or clarifies an existing memory
  - The fact seems to contradict BUT could coexist (e.g., "loves chicken" + "prefers vegetarian" → "prefers vegetarian but occasionally eats chicken")
  - The fact represents an evolution of preferences (update with history)
- **DELETE** if:
  - User EXPLICITLY states they no longer have a preference (e.g., "I hate X now", "I stopped eating Y", "I'm no longer Z")
  - Use UPDATE instead of DELETE in 95% of cases to preserve context
- **NONE** if: The fact is redundant or not worth storing

**IMPORTANT: Strongly prefer UPDATE over DELETE to preserve user history and handle nuance.**

**Response Format:**
Return ONLY valid JSON in this exact format:
{
  "operation": "ADD" | "UPDATE" | "DELETE" | "NONE",
  "memory_id": "existing_memory_id_if_UPDATE_or_DELETE_otherwise_null",
  "final_memory": "The final memory text after the operation",
  "reasoning": "Brief explanation of the decision"
}

**Examples:**

New fact: "User is vegetarian"
Existing memories: []
Response: {"operation": "ADD", "memory_id": null, "final_memory": "User is vegetarian", "reasoning": "New preference information"}

New fact: "User is strictly vegan"
Existing memories: [{"id": "mem_1", "text": "User is vegetarian"}]
Response: {"operation": "UPDATE", "memory_id": "mem_1", "final_memory": "User is strictly vegan (evolved from vegetarian)", "reasoning": "More specific dietary preference, preserving history"}

New fact: "User prefers vegetarian meals"
Existing memories: [{"id": "mem_1", "text": "User loves chicken"}]
Response: {"operation": "UPDATE", "memory_id": "mem_1", "final_memory": "User prefers vegetarian meals but occasionally eats chicken", "reasoning": "Combines both preferences to preserve nuance"}

New fact: "User stopped eating meat entirely"
Existing memories: [{"id": "mem_1", "text": "User loves chicken"}]
Response: {"operation": "UPDATE", "memory_id": "mem_1", "final_memory": "User no longer eats meat (previously loved chicken)", "reasoning": "Explicit change in diet, but preserving history via UPDATE"}

New fact: "User hates chicken now"
Existing memories: [{"id": "mem_1", "text": "User loves chicken"}]
Response: {"operation": "DELETE", "memory_id": "mem_1", "final_memory": "", "reasoning": "Explicit reversal of preference - user explicitly states opposite"}

New fact: "User likes Italian food"
Existing memories: [{"id": "mem_1", "text": "User enjoys Italian cuisine"}]
Response: {"operation": "NONE", "memory_id": null, "final_memory": "", "reasoning": "Already captured in existing memory"}`;

/**
 * MEMORY_RETRIEVAL_SYSTEM_PROMPT
 *
 * Purpose: Format retrieved memories for injection into chat system prompt
 */
export const MEMORY_RETRIEVAL_SYSTEM_PROMPT = (memories: string[]) => `
**User's Personal Context:**
Based on previous conversations, here's what I know about you:

${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}

I'll use this information to provide more personalized and relevant suggestions.`;

/**
 * Helper: Create extraction prompt with conversation context
 */
export function createExtractionPrompt(messages: Array<{ role: string; content: string }>) {
  const conversation = messages
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n\n');

  return `${FACT_EXTRACTION_PROMPT}

**Conversation:**
${conversation}

Now extract the facts as JSON:`;
}

/**
 * Helper: Create update decision prompt with context
 */
export function createUpdatePrompt(
  newFact: string,
  existingMemories: Array<{ id: string; text: string; similarity?: number }>
) {
  const memoriesText = existingMemories.length > 0
    ? existingMemories
        .map((m, i) => `${i + 1}. [ID: ${m.id}] ${m.text}${m.similarity ? ` (similarity: ${m.similarity.toFixed(2)})` : ''}`)
        .join('\n')
    : 'No existing memories';

  return `${UPDATE_DECISION_PROMPT}

**New Fact:**
"${newFact}"

**Existing Memories:**
${memoriesText}

Decide the operation as JSON:`;
}
