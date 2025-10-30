# Recipe Vector Database Setup Guide

## Overview

This system enables AI-powered recipe search using vector embeddings and natural language queries. Recipes are automatically embedded after extraction and can be retrieved through the AI chat interface.

## Architecture

### Components Created

1. **`convex/recipeEmbeddings.ts`** - Embedding generation module
   - Generates embeddings using OpenAI's `text-embedding-3-small` (1536 dimensions)
   - Auto-detects dietary tags (vegan, vegetarian, gluten-free, etc.)
   - Batch embedding support
   - Background embedding after extraction

2. **`convex/recipeRetrieval.ts`** - Vector search module
   - Natural language recipe search
   - Cosine similarity scoring
   - Community-scoped filtering
   - Dietary tag filtering

3. **Modified `convex/extractor.ts`**
   - Automatically triggers embedding after recipe extraction
   - Non-blocking background embedding
   - Embeds all recipes in a job after completion

4. **Modified `app/api/chat/stream/route.ts`**
   - Added `search_recipes` tool for AI
   - Tool calling support in streaming
   - Formats and streams recipe results

## How It Works

### Recipe Extraction → Embedding Flow

```
1. User submits URL → Extract recipes → Save to extractedRecipes table
2. After extraction completes → Trigger embedJobRecipes action
3. For each recipe:
   - Create embedding text (title + description + ingredients + instructions)
   - Call OpenAI embeddings API
   - Infer dietary tags from ingredients
   - Store in recipes table with embedding vector
```

### Recipe Search Flow

```
1. User asks "Show me vegan pasta recipes"
2. AI decides to use search_recipes tool
3. System:
   - Generates embedding for query
   - Performs vector search in community's recipes
   - Calculates cosine similarity
   - Filters by dietary tags (if specified)
   - Returns top N matches
4. AI formats and streams recipes to user
```

## Environment Variables Required

```bash
OPENAI_API_KEY=sk-...          # For embeddings (text-embedding-3-small)
OPEN_ROUTER_API_KEY=sk-or-...  # For chat (Grok-4-fast or GPT-5-mini)
```

## Database Schema

The `recipes` table already has the required fields:
- `embedding`: vector(1536)
- `embeddingModel`: "text-embedding-3-small"
- `community`: string (for filtering)
- `dietTags`: string[] (for dietary filtering)

Vector index: `by_embedding` with community filter field.

## Testing the System

### 1. Extract Recipes

Use the recipe extractor in the "Extractor" tab:
```
1. Enter a recipe website URL (e.g., budgetbytes.com)
2. Wait for URL filtering
3. Confirm extraction count
4. Recipes will be extracted and automatically embedded
```

### 2. Test AI Recipe Search

In the "AI Chat" tab, try these queries:

**Basic Search:**
```
"Show me pasta recipes"
"Find me some desserts"
"What chicken dishes do you have?"
```

**Dietary Filtered Search:**
```
"Show me vegan recipes"
"Find gluten-free dinner ideas"
"I need dairy-free desserts"
```

**Natural Language:**
```
"I'm hungry for something Italian"
"Quick weeknight dinner ideas"
"Healthy breakfast recipes"
```

### 3. Verify Embeddings

Check that recipes have embeddings:
```typescript
// In Convex dashboard or via query:
const recipes = await ctx.db
  .query("recipes")
  .withIndex("by_community", (q) => q.eq("community", "community_1"))
  .take(5);

// Verify each recipe has:
// - embedding array (1536 numbers)
// - embeddingModel: "text-embedding-3-small"
// - dietTags array
```

## API Usage

### Manually Embed a Recipe

```typescript
// Call from frontend or server:
await convex.action(api.recipeEmbeddings.embedExtractedRecipe, {
  extractedRecipeId: "jd7f8x9z...",
});
```

### Manually Search Recipes

```typescript
await convex.action(api.recipeRetrieval.searchRecipesByQuery, {
  query: "pasta recipes",
  communityId: "community_1",
  limit: 5,
  dietaryTags: ["vegan"], // optional
});
```

### Batch Embed All Recipes from a Job

```typescript
await convex.action(api.recipeEmbeddings.embedJobRecipes, {
  jobId: "jd7f8x9z...",
});
```

## Key Features

✅ **Automatic Embedding** - Recipes are embedded immediately after extraction
✅ **Natural Language Search** - AI understands "show me vegan pasta" → searches with filters
✅ **Dietary Intelligence** - Auto-detects dietary tags from ingredients
✅ **Community Scoped** - Recipes are filtered by community
✅ **Streaming Results** - Recipes stream back to the user in real-time
✅ **Memory Integration** - Search queries and results are saved to user memory
✅ **Non-blocking** - Embedding runs in background, doesn't slow down extraction

## Troubleshooting

### No recipes found in search

1. Check if recipes have embeddings:
   ```typescript
   const recipe = await ctx.db.get(recipeId);
   console.log("Embedding length:", recipe.embedding?.length); // Should be 1536
   ```

2. Check community ID matches:
   ```typescript
   console.log("Community ID:", communityId);
   console.log("Recipe community:", recipe.community);
   ```

3. Verify OpenAI API key is set:
   ```bash
   echo $OPENAI_API_KEY
   ```

### Embeddings not generated

1. Check extractor logs for embedding errors
2. Manually trigger embedding:
   ```typescript
   await convex.action(api.recipeEmbeddings.embedJobRecipes, {
     jobId: "your_job_id",
   });
   ```

### Tool not being called by AI

1. Check that OpenRouter API key is valid
2. Verify the AI model supports tool calling (Grok-4-fast and GPT-5-mini do)
3. Try a more explicit prompt: "Search for pasta recipes"

## Performance

- **Embedding Generation**: ~0.5-1s per recipe
- **Vector Search**: ~50-100ms for 1000 recipes
- **Batch Embedding**: ~5-10s for 10 recipes
- **Tool Call Latency**: ~1-2s for search + formatting

## Next Steps

1. **Add more dietary tags**: Modify `inferDietTags()` to detect more diets
2. **Add recipe rating**: Track user recipe likes/dislikes
3. **Add ingredient filters**: "recipes without mushrooms"
4. **Add cooking time filters**: "quick recipes under 30 minutes"
5. **Add cuisine filters**: "Italian recipes only"

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Recipe Extractor                      │
│  (extracts from websites → extractedRecipes table)       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ After extraction completes
                  ↓
┌─────────────────────────────────────────────────────────┐
│              recipeEmbeddings.embedJobRecipes            │
│  • For each extracted recipe:                            │
│    - Generate embedding text                             │
│    - Call OpenAI API (text-embedding-3-small)            │
│    - Infer dietary tags                                  │
│    - Store in recipes table                              │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│                   recipes table                          │
│  • embedding: float64[1536]                              │
│  • embeddingModel: "text-embedding-3-small"              │
│  • dietTags: ["vegan", "gluten-free", ...]               │
│  • Vector index: by_embedding (with community filter)    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ AI Tool Call: search_recipes
                  ↓
┌─────────────────────────────────────────────────────────┐
│         recipeRetrieval.searchRecipesByQuery             │
│  1. Generate embedding for user query                    │
│  2. Vector search with cosine similarity                 │
│  3. Filter by community + dietary tags                   │
│  4. Return top N matches                                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Formatted recipes
                  ↓
┌─────────────────────────────────────────────────────────┐
│                    AI Chat Stream                        │
│  • Receives tool results                                 │
│  • Formats recipes with markdown                         │
│  • Streams to user                                       │
│  • Saves to memory                                       │
└─────────────────────────────────────────────────────────┘
```

## Credits

Built using:
- **Convex**: Serverless backend with vector search
- **OpenAI**: text-embedding-3-small for embeddings
- **OpenRouter**: Grok-4-fast / GPT-5-mini for chat
- **Next.js**: Edge runtime for streaming
- **TypeScript**: Type-safe implementation
