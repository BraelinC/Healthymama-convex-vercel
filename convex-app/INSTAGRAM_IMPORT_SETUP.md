# Instagram Recipe Import - Setup Guide

Complete guide to deploying and using the Instagram recipe import feature.

## Overview

The Instagram import feature allows users to extract recipes from Instagram reels by pasting a URL. The system:

1. Fetches Instagram data (caption, comments, video) via Railway Python service
2. Parses the content with AI (OpenRouter/Gemini) to extract recipe structure
3. Saves to user's "Instagram" cookbook in Convex

## Architecture

```
User → Next.js Frontend → Next.js API Route → Railway Python Service (Instagram)
                              ↓
                        OpenRouter AI (Parse Recipe)
                              ↓
                        Convex (Store Recipe)
```

---

## Step 1: Deploy Railway Python Service

### Option A: Deploy from GitHub (Recommended)

1. **Push instagram-service to GitHub:**
   ```bash
   cd instagram-service
   git init
   git add .
   git commit -m "Initial commit: Instagram extraction service"
   git remote add origin https://github.com/your-username/healthymama-instagram-service.git
   git push -u origin main
   ```

2. **Deploy to Railway:**
   - Go to [railway.app](https://railway.app) and sign in
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `healthymama-instagram-service` repo
   - Railway will auto-detect Python and deploy

3. **Set Environment Variables in Railway Dashboard:**
   - `IG_USERNAME` - Your Instagram username (create dedicated account)
   - `IG_PASSWORD` - Your Instagram password

4. **Get Public URL:**
   - Railway automatically assigns a public URL
   - Copy it (e.g., `https://your-app.up.railway.app`)

### Option B: Deploy with Railway CLI

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and deploy:**
   ```bash
   cd instagram-service
   railway login
   railway init
   railway variables set IG_USERNAME=your_instagram_username
   railway variables set IG_PASSWORD=your_instagram_password
   railway up
   ```

3. **Generate public domain:**
   ```bash
   railway domain
   ```

### Test the Railway Service

```bash
curl -X POST https://your-railway-app.railway.app/extract-instagram \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/ABC123/"}'
```

Expected response:
```json
{
  "success": true,
  "caption": "Recipe caption...",
  "comments": ["comment 1", "comment 2"],
  "videoUrl": "https://...",
  "thumbnailUrl": "https://...",
  "username": "creator_username"
}
```

---

## Step 2: Configure Next.js Environment

1. **Add Railway URL to .env.local:**
   ```bash
   # .env.local
   NEXT_PUBLIC_RAILWAY_INSTAGRAM_URL=https://your-railway-app.railway.app
   ```

2. **Verify OpenRouter API key is set:**
   ```bash
   # Should already be in .env.local
   OPEN_ROUTER_API_KEY=sk-or-v1-...
   ```

3. **Restart Next.js dev server:**
   ```bash
   npm run dev
   ```

---

## Step 3: Test the Feature

1. **Open your app:** `http://localhost:3000`

2. **Click the pink Plus (+) button** (bottom right)

3. **Select "Import from Instagram"**

4. **Paste an Instagram reel URL:**
   - Example: `https://www.instagram.com/reel/ABC123/`
   - The reel should have a recipe in the caption or comments

5. **Click "Extract Recipe"**
   - Wait 5-15 seconds for extraction and AI parsing
   - You'll see a preview of the parsed recipe

6. **Click "Save to Cookbook"**
   - Recipe is saved to "Instagram" cookbook
   - Check the cookbooks page to view it

---

## Troubleshooting

### Railway Service Issues

**Problem: Login failed**
- **Solution:** Create a dedicated Instagram account (don't use personal)
- Try logging in manually on instagram.com first to verify credentials
- Instagram may require email/SMS verification for new accounts

**Problem: Can't fetch comments**
- **Solution:** This is normal - comments require additional permissions
- The service will continue without comments (not critical)

**Problem: Railway service is down**
- **Solution:** Check Railway dashboard logs
- Restart the service in Railway dashboard
- Verify environment variables are set correctly

### Next.js Issues

**Problem: API route returns "Railway service URL not configured"**
- **Solution:** Add `NEXT_PUBLIC_RAILWAY_INSTAGRAM_URL` to `.env.local`
- Restart Next.js dev server

**Problem: "OpenRouter API key not configured"**
- **Solution:** Verify `OPEN_ROUTER_API_KEY` is in `.env.local`
- Make sure the key starts with `sk-or-`

### Import Issues

**Problem: Extraction takes too long (>30 seconds)**
- **Cause:** Railway cold start (first request after inactivity)
- **Solution:** Wait for completion - subsequent requests will be faster

**Problem: AI parsing fails**
- **Cause:** Recipe not clearly formatted in caption/comments
- **Solution:** Try a different reel with clearer recipe text
- Check OpenRouter API logs for errors

**Problem: Recipe already imported error**
- **Cause:** Duplicate detection (same title + Instagram cookbook)
- **Solution:** This is expected behavior to prevent duplicates

---

## Instagram Account Best Practices

### Create a Dedicated Account

**DO NOT use your personal Instagram account!**

1. Create a new Instagram account specifically for this service
2. Use a disposable email address
3. Use a strong, unique password
4. Complete email/SMS verification

### Rate Limiting

Instagram limits API requests:
- **~200-500 requests per hour** (varies by account age)
- Railway service adds 1-2 second delays between requests
- For production, consider implementing request queuing

### Account Safety

- Instagram may flag accounts used for scraping
- Rotate credentials periodically (every 3-6 months)
- Monitor Railway logs for login failures
- Keep backup credentials ready

---

## Cost Estimation

### Railway (Python Service)
- **Free Tier:** 500 hours/month ($0/month)
- **Paid:** ~$5-10/month for 24/7 uptime
- **Per-request cost:** Negligible

### OpenRouter (AI Parsing)
- **Model:** Gemini 2.0 Flash
- **Cost:** ~$0.02 per 1000 tokens
- **Per recipe:** ~$0.001-0.003 (very cheap)
- **100 imports:** ~$0.10-0.30

### Total Monthly Cost
- **Light usage (10-50 imports):** $0-5/month
- **Medium usage (100-500 imports):** $5-15/month

---

## Advanced Configuration

### Custom AI Model

Edit `app/api/instagram/import/route.ts` to use a different model:

```typescript
body: JSON.stringify({
  model: 'openai/gpt-4o-mini', // Instead of gemini-2.0-flash-001
  messages: [...],
  temperature: 0.2,
})
```

### Webhook Integration

Add a webhook to notify when imports complete (future enhancement).

### Batch Import

Extend the feature to support multiple URLs at once (future enhancement).

---

## Support

For issues or questions:
1. Check Railway service logs
2. Check Next.js console logs
3. Check browser network tab for API errors
4. Review this guide's troubleshooting section

---

## Security Notes

- Never commit `.env` files with real credentials
- Railway service has access to Instagram credentials
- OpenRouter API key should be kept secret
- Instagram account could be banned for scraping

---

## Next Steps

1. Deploy Railway service
2. Configure environment variables
3. Test with a few Instagram reels
4. Monitor costs and usage
5. Consider implementing rate limiting for production
6. Set up monitoring/alerting for service health
