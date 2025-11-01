# Convex Community Chat - Deployment Instructions

## ✅ Implementation Complete

The serverless community AI chat has been fully implemented! All code is ready.

## 📋 What Was Built

- **Convex Schema**: Added `chatSessions`, enhanced `chatMessages`, and `aiSettings` tables
- **Convex Functions**: Complete backend with queries, mutations, and AI action
- **React Component**: `ConvexCommunityChat` with full UI (sessions, messages, AI settings)
- **Integration**: Connected to `/community` page AI Chat tab

## 🚀 Deployment Steps

### 1. Push Convex Schema (REQUIRED)

Since the Convex CLI requires interactive prompts, you need to run this manually:

```bash
cd convex-app
npx convex dev
```

When prompted:
- **"What would you like to configure?"** → Select "reinitialize" or "continue"
- **"Do you want to push your code to prod?"** → Answer "no" (we want dev deployment)

This will push the new schema (`chatSessions`, `chatMessages`, `aiSettings`) to your Convex dev deployment.

### 2. Add Environment Variables

Make sure these are set in your Convex dashboard (https://dashboard.convex.dev/d/fearless-goldfinch-827):

```
OPENAI_API_KEY=your_openai_api_key_here
XAI_API_KEY=your_xai_api_key_here  (for Grok support)
```

### 3. Run the App

```bash
cd convex-app
npm run dev
```

The app will run at `http://localhost:3000`

### 4. Test the Chat

1. Navigate to `http://localhost:3000/community`
2. Click the "AI Chat" tab
3. Click "Start New Chat"
4. Select a model (GPT-5 Mini or Grok-4 Fast)
5. Start chatting!

## 📁 Files Created/Modified

### Schema & Backend
- `convex/schema.ts` - Added 3 new tables
- `convex/communitychat.ts` - Complete chat backend (NEW)
- `convex/_generated/api.ts` - Added API bindings

### Components
- `components/ConvexCommunityChat.tsx` - Main chat UI (NEW)
- `components/ui/select.tsx` - Model selector component (NEW)

### Integration
- `app/community/page.tsx` - Integrated chat into AI Chat tab
- `convex.json` - Convex project configuration (NEW)

### Config
- `next.config.mjs` - Fixed deprecated warning
- `.env.local` - Added CONVEX_DEPLOYMENT

## 🎨 Features

✅ Session Management
- Create/delete chat sessions
- Session history sidebar
- Auto-update timestamps

✅ AI Integration
- GPT-5 Mini (OpenAI)
- Grok-4 Fast (xAI)
- Custom AI settings (name, persona, temperature)

✅ Chat Interface
- Real-time updates via Convex
- Message bubbles (user/assistant)
- Loading indicators
- Welcome screen

✅ UI/UX
- Dark theme with purple accents
- ChatGPT-style layout
- Model selector
- AI customization modal

## ⚠️ Known Issues

1. **Convex CLI in Non-Interactive Mode**: The `npx convex dev` command requires interactive terminal input, so it can't be run from this automated environment. You'll need to run it manually once.

2. **Deployments**:
   - Dev: `fearless-goldfinch-827` (currently configured in .env.local)
   - Prod: `zealous-sockeye-430` (use this for production traffic)

## 🔧 Troubleshooting

### Schema Not Pushed?

If you see errors about missing tables:
```bash
npx convex dev  # Push schema interactively
```

### Missing Environment Variables?

Check Convex dashboard → Settings → Environment Variables
- Add `OPENAI_API_KEY`
- Add `XAI_API_KEY` (optional, for Grok)

### Port Already in Use?

Kill the existing process or change the port:
```bash
npx next dev -p 3001
```

## 🎉 Next Steps

1. Run `npx convex dev` to push the schema
2. Test the chat functionality
3. Customize AI settings to your liking
4. Deploy to production when ready!

---

**Need Help?** Check the Convex docs at https://docs.convex.dev
