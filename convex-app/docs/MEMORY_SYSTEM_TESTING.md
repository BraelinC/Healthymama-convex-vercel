# Memory System Testing Guide

## 🎯 Overview

The Mem0-style memory system has been fully integrated with your chat application. This guide will help you test all features.

## 📋 What Was Built

### 1. **Database Schema** (`convex/schema.ts`)
- `userMemories` table - Stores user facts with vector embeddings
- `memoryHistory` table - Audit trail for all memory operations

### 2. **Core System** (`convex/memory/`)
- **prompts.ts** - LLM prompts for fact extraction and update decisions
- **mutations.ts** - Database CRUD operations (queries & mutations)
- **operations.ts** - LLM-powered actions (fact extraction, embedding, orchestration)

### 3. **Chat Integration** (`app/api/chat/stream/route.ts`)
- **Memory Retrieval** - Fetches relevant memories before each response
- **Context Injection** - Adds memories to system prompt
- **Background Processing** - Extracts facts after each conversation

### 4. **Management APIs**
- `GET /api/memory/list?userId=xxx` - View all memories
- `GET /api/memory/search?userId=xxx&query=xxx` - Search memories
- `POST /api/memory/reset` - Clear all memories
- `GET /api/memory/history?userId=xxx` - View operation history

---

## 🧪 Testing Steps

### Test 1: Basic Memory Creation

**Goal**: Verify facts are extracted from conversation

1. Open http://localhost:3006
2. Go to "AI Chat" tab
3. Send a message with personal information:
   ```
   Hi! I'm allergic to peanuts and I follow a vegetarian diet.
   I'm planning to start meal prepping on weekends.
   ```

4. Wait for AI response
5. Check Convex logs for memory processing:
   ```
   [Memory] Processing update for user...
   [Memory] Extracted X facts
   [Memory] Decision for "User is allergic to peanuts": ADD
   ```

6. Verify memories were created:
   ```bash
   curl "http://localhost:3006/api/memory/list?userId=YOUR_USER_ID"
   ```

**Expected Result**: Should see 3 memories extracted:
- "User is allergic to peanuts"
- "User follows a vegetarian diet"
- "User is planning to start meal prepping on weekends"

---

### Test 2: Memory Retrieval & Context Injection

**Goal**: Verify memories are used in subsequent conversations

1. Start a new message (same session):
   ```
   Can you suggest a recipe for me?
   ```

2. Check the AI response - it should reference your allergies and dietary preferences WITHOUT you mentioning them again

3. Look for context injection in system prompt:
   ```
   **User's Personal Context:**
   Based on previous conversations, here's what I know about you:
   1. User is allergic to peanuts
   2. User follows a vegetarian diet
   3. User is planning to start meal prepping on weekends
   ```

**Expected Result**: AI suggests vegetarian, peanut-free recipes

---

### Test 3: Memory Updates

**Goal**: Verify UPDATE operation when information changes

1. Send a message that adds detail to existing memory:
   ```
   Actually, I'm strictly vegan now, not just vegetarian.
   ```

2. Wait for processing
3. Check memory list:
   ```bash
   curl "http://localhost:3006/api/memory/list?userId=YOUR_USER_ID"
   ```

**Expected Result**:
- Old memory "User follows a vegetarian diet" → UPDATED to "User is strictly vegan (previously vegetarian)"
- Version number incremented
- History shows UPDATE operation

---

### Test 4: Memory Deletion (Contradictions)

**Goal**: Verify DELETE operation when information contradicts

1. Send a message that contradicts previous info:
   ```
   I love eating meat now and don't follow any dietary restrictions.
   ```

2. Check memory list after processing

**Expected Result**:
- Vegan memory → DELETED
- History shows DELETE operation
- New memory added about no dietary restrictions

---

### Test 5: Memory Search

**Goal**: Test semantic search for relevant memories

```bash
curl "http://localhost:3006/api/memory/search?userId=YOUR_USER_ID&query=What%20food%20should%20I%20avoid"
```

**Expected Result**: Returns memories about peanut allergy (even though query doesn't mention "peanuts" - semantic search!)

---

### Test 6: Memory History Audit

**Goal**: View all operations performed on memories

```bash
curl "http://localhost:3006/api/memory/history?userId=YOUR_USER_ID&limit=20"
```

**Expected Result**: JSON with operation history:
```json
{
  "history": [
    {
      "operation": "ADD",
      "beforeState": null,
      "afterState": {"text": "User is allergic to peanuts"},
      "timestamp": 1234567890
    },
    {
      "operation": "UPDATE",
      "beforeState": {"text": "User follows a vegetarian diet"},
      "afterState": {"text": "User is strictly vegan"},
      "timestamp": 1234567895
    }
  ]
}
```

---

### Test 7: Memory Reset

**Goal**: Clear all memories for a user

```bash
curl -X POST http://localhost:3006/api/memory/reset \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_USER_ID"}'
```

**Expected Result**:
```json
{
  "success": true,
  "deletedCount": 5,
  "message": "Successfully deleted 5 memories"
}
```

---

## 🔍 Debugging Tips

### Check Convex Logs

Watch the Convex dev console for memory processing logs:
```
[Memory] Processing update for user abc123
[Memory] Extracted 3 facts
[Memory] Decision for "User likes Italian food": ADD
```

### Verify Embeddings

Memories should have 1536-dimensional vectors:
```bash
# In Convex dashboard, inspect a memory document
embedding: [0.123, -0.456, 0.789, ..., 0.234]  // 1536 floats
```

### Check API Keys

Ensure environment variables are set:
```bash
# .env.local
OPENAI_API_KEY=sk-...
OPEN_ROUTER_API_KEY=sk-or-...
```

### Monitor Background Processing

Memory processing runs asynchronously after chat responses. Check for errors:
```
[Memory] Background processing failed: <error>
```

---

## 🎨 Advanced Testing Scenarios

### Scenario 1: Complex Preferences
```
User: I'm training for a marathon, so I need high-protein meals.
      I don't like spicy food, and I'm lactose intolerant.
```

**Expected**: 3-4 memories extracted, all used in future recipe suggestions

### Scenario 2: Changing Goals
```
User: I finished my marathon! Now I want to focus on weight loss.
```

**Expected**: UPDATE operation on fitness goal memory

### Scenario 3: Multi-Turn Learning
Have a 5-message conversation about cooking preferences. Check that memories accumulate and inform responses.

---

## 📊 Performance Benchmarks

### Expected Metrics (from Mem0 research)
- **Fact Extraction**: ~2-3s (GPT-4o-mini)
- **Embedding Generation**: ~0.5s per fact
- **Vector Search**: <200ms (p95: 150ms)
- **Total Processing**: 5-10s for 3-5 facts (background, non-blocking)

### Monitor Token Usage
Memory system uses:
- ~500 tokens for extraction prompt
- ~300 tokens for each update decision
- Average: 1000-1500 tokens per conversation

---

## 🐛 Common Issues & Fixes

### Issue 1: No memories extracted
**Cause**: Conversation doesn't contain personal information
**Fix**: Use explicit personal statements in test messages

### Issue 2: Duplicate memories
**Cause**: Hash collision or similar phrasing
**Fix**: Check `contentHash` deduplication logic in mutations.ts

### Issue 3: Memory processing timeout
**Cause**: OpenAI API slow or rate limited
**Fix**: Add retry logic or increase timeout

### Issue 4: Context not injected
**Cause**: Memory retrieval failed silently
**Fix**: Check error logs for retrieval failures

---

## 🚀 Next Steps

After successful testing:

1. **Monitor Production**: Watch memory growth per user
2. **Optimize Prompts**: Refine extraction/update prompts based on quality
3. **Add Graph Storage**: Implement optional Neo4j for entity relationships
4. **Tune Thresholds**: Adjust similarity thresholds for better accuracy
5. **Add UI**: Build memory management interface in the app

---

## 📝 API Reference

### List Memories
```bash
GET /api/memory/list?userId=xxx&limit=50
```

Response:
```json
{
  "memories": [
    {
      "id": "mem_123",
      "text": "User is allergic to peanuts",
      "category": null,
      "createdAt": 1234567890,
      "version": 1
    }
  ],
  "count": 1
}
```

### Search Memories
```bash
GET /api/memory/search?userId=xxx&query=allergies&topK=5
```

### Reset Memories
```bash
POST /api/memory/reset
Content-Type: application/json

{"userId": "xxx"}
```

### View History
```bash
GET /api/memory/history?userId=xxx&limit=20
```

---

## ✅ Success Criteria

Your memory system is working correctly if:

1. ✅ Facts are extracted from natural conversation
2. ✅ Memories are retrieved and injected into AI context
3. ✅ AI references past information without being told again
4. ✅ UPDATE operations merge new information
5. ✅ DELETE operations remove contradictions
6. ✅ NONE operations avoid redundant storage
7. ✅ Semantic search finds relevant memories
8. ✅ History audit trail is complete
9. ✅ Background processing doesn't block chat
10. ✅ System works on Vercel Edge Runtime

Happy testing! 🎉
