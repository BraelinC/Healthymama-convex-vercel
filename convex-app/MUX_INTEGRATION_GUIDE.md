# Mux Video Integration for Instagram Recipes - MVP Guide

Complete setup guide for Mux video hosting with Instagram recipe imports.

## What Is This?

Your Instagram recipe imports now automatically upload videos to **Mux** for:
- ✅ Professional video hosting
- ✅ Auto-encoding for all devices
- ✅ Adaptive streaming (HD → SD based on connection)
- ✅ Global CDN (fast playback worldwide)
- ✅ Beautiful Mux player with controls

---

## How It Works

```
User pastes Instagram URL
    ↓
DigitalOcean extracts video URL
    ↓
Mux downloads & encodes video
    ↓
Recipe saved with Mux playback ID
    ↓
UniversalRecipeCard plays video
```

**Total time: ~15 seconds** (10 extra for Mux encoding)

---

## Step 1: Create Mux Account (5 minutes)

### 1.1: Sign Up

1. Go to https://dashboard.mux.com
2. Click "Get Started"
3. Sign up with Google or email
4. Verify your email

### 1.2: Get API Credentials

1. After login, go to **Settings** → **Access Tokens**
2. Click **Generate New Token**
3. Name it: "HealthyMama Production"
4. Permissions: Select **Full Access** (or at minimum: `video:write`, `video:read`)
5. Click **Generate Token**
6. Copy both:
   - `MUX_TOKEN_ID` (starts with your account ID)
   - `MUX_TOKEN_SECRET` (long random string)

⚠️ **Save the secret now** - you won't be able to see it again!

---

## Step 2: Add to Your .env.local (1 minute)

Open `.env.local` and add:

```env
# Mux Video Hosting
MUX_TOKEN_ID=your_token_id_here
MUX_TOKEN_SECRET=your_token_secret_here
```

Replace with the actual values from Step 1.

---

## Step 3: Test the Integration (5 minutes)

### 3.1: Start Your App

```bash
npm run dev
```

### 3.2: Import an Instagram Recipe

1. Go to http://localhost:3000
2. Click the pink **"+"** button (bottom right)
3. Select **"Import from Instagram"**
4. Paste an Instagram reel URL (example: `https://www.instagram.com/reel/ABC123/`)
5. Wait ~15 seconds (includes Mux upload)
6. Review the recipe preview
7. Click **"Save to Cookbook"**

### 3.3: View the Video

1. Open your **Instagram cookbook**
2. Click on the imported recipe
3. You should see a **Mux video player** instead of a static image
4. Click play - video should stream smoothly!

---

## Step 4: Verify in Mux Dashboard (Optional)

1. Go to https://dashboard.mux.com
2. Click **"Video"** → **"Assets"**
3. You should see your uploaded Instagram video
4. Click on it to see:
   - Encoding status (should be "Ready")
   - Playback ID
   - Video duration, resolution
   - Analytics (views, buffering, etc.)

---

## Architecture

### File Changes Made

| File | Changes |
|------|---------|
| `lib/mux.ts` | Mux upload utilities |
| `app/api/instagram/import/route.ts` | Added Mux upload step |
| `convex/schema.ts` | Added `muxPlaybackId`, `muxAssetId` fields |
| `convex/recipes/userRecipes.ts` | Pass Mux data to database |
| `convex/instagram.ts` | Accept Mux fields in mutation |
| `components/recipe/UniversalRecipeCard.tsx` | Display Mux player |
| `.env.example` | Added Mux env vars |

### How Instagram Import Works Now

```
1. User pastes Instagram URL
2. DigitalOcean service extracts video URL
   → Returns: videoUrl, caption, thumbnail
3. Next.js API uploads video to Mux
   → uploadVideoFromUrl(videoUrl)
   → Mux downloads, encodes, returns playbackId
4. Gemini 2.0 Flash parses caption to recipe
   → Returns: title, ingredients[], instructions[]
5. Convex saves recipe with Mux playback ID
   → muxPlaybackId, muxAssetId
6. UniversalRecipeCard displays Mux player
   → <MuxPlayer playbackId={...} />
```

---

## Cost Breakdown

### Mux Pricing (Pay As You Go)

| Resource | Cost | Example |
|----------|------|---------|
| Video encoding | $0.005/minute | 3-min video = $0.015 |
| Video storage | $0.015/GB/month | 100 videos (~10GB) = $0.15/month |
| Video delivery | $0.01/GB | 100 plays = $0.50 |

**Example: 100 Instagram imports/month**
- Encoding: 100 × 3 min × $0.005 = **$1.50**
- Storage: 10 GB × $0.015 = **$0.15**
- Delivery: 100 plays × 50 MB × $0.01 = **$0.50**
- **Total: ~$2.15/month**

### Free Tier
- Mux offers **$20 free credit** when you sign up
- That's ~1,000 video imports for free!
- No credit card required initially

---

## Troubleshooting

### Video Not Uploading to Mux

Check your logs:
```bash
# Look for Mux-related errors
npm run dev

# You should see:
[Instagram Import] Uploading video to Mux...
[Instagram Import] ✅ Mux upload complete: abc123xyz
```

If you see errors:
1. Check `.env.local` has correct `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`
2. Restart your dev server: `npm run dev`
3. Check Mux dashboard for API errors

### Video Player Not Showing

1. Check if `muxPlaybackId` is saved in recipe:
   - Open Convex dashboard
   - Go to `userRecipes` table
   - Find your recipe
   - Verify `muxPlaybackId` field exists

2. Check browser console for errors:
   - Right-click → Inspect → Console
   - Look for Mux player errors

3. Verify the playback ID works:
   - Copy your `muxPlaybackId`
   - Visit: `https://stream.mux.com/{playbackId}.m3u8`
   - Should download/play video

### Encoding Taking Too Long

Mux encoding usually takes 10-30 seconds for a 3-minute video.

If it's taking longer:
1. Check Mux dashboard → Assets
2. Find your video
3. Check encoding status
4. If "errored", check error message

### Video Won't Play

1. Check if the original Instagram video is still available (not deleted)
2. Verify Mux playback ID is valid
3. Try opening directly: `https://stream.mux.com/{playbackId}.m3u8`
4. Check Mux dashboard for asset status

---

## Advanced: Video Analytics

Mux provides built-in analytics for every video:

1. Go to https://dashboard.mux.com
2. Click **"Data"** → **"Video Views"**
3. See:
   - Total views
   - Playback time
   - Buffering ratio
   - Quality metrics
   - Geographic distribution

Perfect for understanding which recipes are most watched!

---

## Optional: Enable Thumbnails

Mux automatically generates thumbnails for videos. You can use them as recipe images:

```typescript
import { getThumbnailUrl } from '@/lib/mux';

const thumbnailUrl = getThumbnailUrl(muxPlaybackId, {
  time: 3, // Get frame at 3 seconds
  width: 640 // Resize to 640px wide
});
```

---

## Security Notes

### API Keys

- **Never commit** `.env.local` to git
- Mux tokens are secret - treat like passwords
- Tokens have full account access - keep them safe

### Video Privacy

- All videos are set to **`playback_policy: 'public'`**
- Anyone with the playback ID can watch
- Perfect for sharing recipes
- If you need private videos, change policy to `'signed'`

---

## Next Steps (Optional Enhancements)

### 1. Video Thumbnails Auto-Generated
Use Mux thumbnails instead of Instagram thumbnails:
- Update `importInstagramRecipe` to use `getThumbnailUrl()`
- Set as `imageUrl` in recipe

### 2. Gemini Video Analysis (Advanced)
Analyze the video content (not just caption):
- Send Mux playback URL to Gemini 2.0 Flash
- Extract recipe steps from video
- More accurate ingredient detection

### 3. Clip Videos
Let users create short clips from imported videos:
- Use Mux Clips API
- Save favorite moments
- Share specific steps

---

## Summary

✅ **Mux is now integrated!**

Your Instagram recipe imports now:
1. Extract video from Instagram
2. Upload to Mux for professional hosting
3. Play beautifully in your app
4. Work on all devices (mobile, desktop, tablet)
5. Stream adaptively (HD when fast, SD when slow)

**Total cost: ~$2-5/month for 100+ recipes**

---

## Support

- **Mux Docs**: https://docs.mux.com
- **Mux Dashboard**: https://dashboard.mux.com
- **Mux Support**: support@mux.com

---

**Built by:** HealthyMama Team
**Last updated:** 2025-01-19
