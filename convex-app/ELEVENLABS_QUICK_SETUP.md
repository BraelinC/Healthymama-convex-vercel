# ElevenLabs Quick Setup - Using Convex HTTP Endpoint

## What I've Set Up For You

I've created the ElevenLabs webhook endpoint directly in Convex (not Next.js), so you can use the faster Convex HTTP endpoint.

### Files Created/Modified:

1. **`convex/ai/elevenlabsTools.ts`** - New file with 3 tool handlers:
   - `searchRecipes` - Searches recipes using your existing vector search
   - `getSuggestions` - Gets personalized meal suggestions using AI
   - `searchMemory` - Searches user preferences and meal history

2. **`convex/http.ts`** - Added `/elevenlabs/tools` webhook endpoint
   - Routes tool calls to the appropriate handlers
   - Handles errors and CORS

---

## Your Convex Webhook URL

Use this URL in the ElevenLabs dashboard for **ALL 3 tools**:

```
https://fearless-goldfinch-827.convex.cloud/elevenlabs/tools
```

This is your **production** Convex deployment URL, so it will work immediately once you deploy.

---

## Step-by-Step Setup

### 1. Deploy to Convex

First, deploy your updated Convex functions:

```bash
cd /mnt/c/Healthymama-convex-vercel/convex-app
npx convex deploy
```

### 2. Get ElevenLabs API Key

1. Go to https://elevenlabs.io
2. Profile Settings → API Keys
3. Generate API Key and copy it

### 3. Create ElevenLabs Agent

1. Go to **Conversational AI** in ElevenLabs dashboard
2. Click **Create Agent**
3. Configure:
   - **Name**: HealthyMama Recipe Assistant
   - **Voice**: Charlotte or Rachel
   - **Model**: GPT-4o
   - **Temperature**: 0.7
   - **First Message**: "Hey! I'm your HealthyMama assistant. I can help you find recipes, get meal suggestions, or answer questions about your preferences. What are you in the mood for?"

### 4. Add System Prompt

Copy the entire system prompt from `ELEVENLABS_SETUP.md` lines 51-113.

### 5. Add 3 Server Tools

Add these tools in the ElevenLabs dashboard:

---

#### Tool 1: search_recipes

**Tool Name**: `search_recipes`

**Description**:
```
Search the recipe database for recipes matching a query. Use this when users ask for specific types of recipes, ingredients, or meal ideas.
```

**Tool Type**: Server Tool (webhook)

**Webhook URL**:
```
https://fearless-goldfinch-827.convex.cloud/elevenlabs/tools
```

**Parameters Schema** (paste this JSON):
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query (e.g., 'chicken recipes', 'quick breakfast', 'high protein')"
    },
    "userId": {
      "type": "string",
      "description": "The user's ID from Clerk authentication"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of recipes to return (default: 5)",
      "default": 5
    }
  },
  "required": ["query", "userId"]
}
```

---

#### Tool 2: get_suggestions

**Tool Name**: `get_suggestions`

**Description**:
```
Get personalized meal suggestions for the user based on their preferences, dietary restrictions, and meal history. Use this when users ask "what should I make?" or need inspiration.
```

**Tool Type**: Server Tool (webhook)

**Webhook URL**:
```
https://fearless-goldfinch-827.convex.cloud/elevenlabs/tools
```

**Parameters Schema**:
```json
{
  "type": "object",
  "properties": {
    "userId": {
      "type": "string",
      "description": "The user's ID from Clerk authentication"
    }
  },
  "required": ["userId"]
}
```

---

#### Tool 3: search_memory

**Tool Name**: `search_memory`

**Description**:
```
Search the user's memory for past preferences, conversations, and meal history. Use this when users ask about their preferences, dietary restrictions, or what they've cooked before.
```

**Tool Type**: Server Tool (webhook)

**Webhook URL**:
```
https://fearless-goldfinch-827.convex.cloud/elevenlabs/tools
```

**Parameters Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "What to search for in memory (e.g., 'dietary restrictions', 'favorite meals', 'last week')"
    },
    "userId": {
      "type": "string",
      "description": "The user's ID"
    },
    "timeRange": {
      "type": "string",
      "description": "Optional time range filter",
      "enum": ["last_week", "last_month", "all_time"]
    },
    "memoryType": {
      "type": "string",
      "description": "Type of memory to search",
      "enum": ["preference", "conversation", "all"],
      "default": "all"
    }
  },
  "required": ["query", "userId"]
}
```

---

### 6. Get Agent ID

After saving the agent, copy the **Agent ID** (looks like `ag_xxxxxxxxxx`)

### 7. Add Environment Variables

Add to `.env.local`:

```bash
# ElevenLabs Conversational AI
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=ag_your_agent_id_here
ELEVENLABS_API_KEY=your_api_key_here
```

Restart your dev server:
```bash
npm run dev
```

---

## Testing

### Test the Webhook

Open browser console and run:

```javascript
fetch('https://fearless-goldfinch-827.convex.cloud/elevenlabs/tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool_name: 'search_recipes',
    parameters: {
      query: 'chicken',
      userId: 'test-user-id',
      limit: 3
    }
  })
})
.then(r => r.json())
.then(console.log)
```

Expected response:
```json
{
  "success": true,
  "count": 3,
  "recipes": [...]
}
```

---

## Why Convex Instead of Vercel?

**Advantages:**
- ✅ Faster - Direct access to Convex database (no Next.js middle layer)
- ✅ More reliable - Convex has 99.9% uptime
- ✅ Lower latency - Colocated with your database
- ✅ Easier debugging - All logs in one place (Convex dashboard)
- ✅ Free tier - No serverless function invocation costs

**Webhook Flow:**
```
ElevenLabs Agent → Convex HTTP Endpoint → Convex Actions → Return Results
```

vs. old flow:
```
ElevenLabs Agent → Vercel API Route → Convex Actions → Return Results
```

---

## Troubleshooting

### "Tool not responding"
- Check Convex deployment: `npx convex dashboard` → Logs
- Verify webhook URL matches exactly: `https://fearless-goldfinch-827.convex.cloud/elevenlabs/tools`
- Test webhook directly with the fetch code above

### "No recipes returned"
- Check that your recipe database has recipes in it
- Try with a simple query like "chicken"
- Check userId is valid in your Convex users table

### "Memory search returns empty"
- Verify user has a profile set up in Convex
- Check `userProfile`, `learnedPreferences`, `recentMeals` tables

---

## Next Steps

1. Deploy to Convex: `npx convex deploy`
2. Set up ElevenLabs agent with the 3 tools
3. Add environment variables
4. Test with voice chat

Let me know when you're ready to test!
