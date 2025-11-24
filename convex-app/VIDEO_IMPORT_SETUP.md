# Universal Video Recipe Import Setup Guide

## Overview

The Universal Video Recipe Import feature allows users to import recipe videos from YouTube, Instagram, TikTok, and other platforms. The system:

1. Downloads the video
2. Uploads it to Mux for storage and streaming
3. Analyzes the video with Gemini AI to extract the recipe
4. Saves metadata to Convex database
5. Provides a video player with clickable timestamps

## Prerequisites

- Node.js 18+ installed
- Mux account (for video storage)
- Google AI API key (for Gemini)
- Convex account (already configured)

## Step 1: Install Dependencies

```bash
cd convex-app
npm install yt-dlp-wrap @mux/mux-node
```

### Dependencies Installed:
- **yt-dlp-wrap**: Downloads videos from YouTube, Instagram, TikTok, etc.
- **@mux/mux-node**: Mux SDK for video upload and streaming

## Step 2: Create Mux Account

1. Go to [https://mux.com](https://mux.com)
2. Sign up for a free account
3. Navigate to **Settings** → **Access Tokens**
4. Click **Generate New Token**
5. Select permissions:
   - ✅ Mux Video (Read/Write)
   - ✅ Mux Data (Read)
6. Copy the **Token ID** and **Token Secret**

### Mux Pricing (as of 2025):
- **Free Tier**: 100,000 delivery minutes/month, up to 10 videos
- **Encoding**: ~$0.02/minute (one-time, 720p)
- **Storage**: ~$0.003/minute/month
- **Delivery**: ~$0.001/minute streamed
- **Example**: 10-minute video = $0.20 encode + $0.03/month storage

## Step 3: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Mux Configuration
MUX_TOKEN_ID=your_mux_token_id_here
MUX_TOKEN_SECRET=your_mux_token_secret_here

# Google AI (Gemini) - Already configured
GOOGLE_AI_API_KEY=your_google_ai_key_here

# Convex - Already configured
NEXT_PUBLIC_CONVEX_URL=your_convex_url_here
```

### Getting Google AI API Key (if not already set):
1. Go to [https://ai.google.dev](https://ai.google.dev)
2. Click **Get API Key**
3. Create a new API key
4. Copy and paste into `.env.local`

## Step 4: Update Convex Schema

The schema has already been updated with the `videoRecipes` table. To deploy it:

```bash
npx convex dev
```

Or if already running, it will auto-deploy.

## Step 5: Test the Feature

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to your cookbook view
3. Click the **Plus (+)** button in the bottom right
4. Select **"Import from Anywhere"**
5. Paste a video URL:
   - YouTube: `https://www.youtube.com/watch?v=VIDEO_ID`
   - Instagram: `https://www.instagram.com/reel/REEL_ID/`
   - TikTok: `https://www.tiktok.com/@user/video/VIDEO_ID`

6. Click **Import Recipe**
7. Wait for processing (1-3 minutes):
   - ⏳ Downloading video
   - ⏳ Uploading to Mux
   - ⏳ Analyzing with Gemini AI
8. Preview the extracted recipe
9. Click **Save to Cookbook**

## File Structure

```
convex-app/
├── lib/
│   ├── videoDownloader.ts      # Downloads videos from any platform
│   ├── muxUploader.ts           # Uploads videos to Mux
│   ├── geminiVideoAnalyzer.ts  # Extracts recipes using Gemini AI
│   └── frameExtractor.ts        # Extracts frames at timestamps
├── app/api/video/import/
│   └── route.ts                 # Main API endpoint
├── components/
│   ├── video/
│   │   └── UniversalVideoImportModal.tsx  # Import UI
│   └── shared/
│       └── PlusButtonMenu.tsx   # Updated menu
├── convex/
│   ├── schema.ts                # Updated with videoRecipes table
│   └── videoRecipes.ts          # CRUD operations
└── VIDEO_IMPORT_SETUP.md        # This file
```

## Architecture Flow

```
User Input (URL)
    ↓
[1] Detect Platform (YouTube/Instagram/TikTok)
    ↓
[2] Download Video (yt-dlp)
    ↓
[3] Upload to Mux (720p, basic tier)
    ↓
[4] Analyze with Gemini 2.0 Flash
    ↓
[5] Extract Recipe Data:
    - Title, description
    - Ingredients (with quantities/units)
    - Instructions (with timestamps)
    - Key frames
    ↓
[6] Save to Convex (videoRecipes table)
    ↓
[7] Return Recipe + Mux Player URL
```

## Supported Platforms

- ✅ YouTube (videos, shorts)
- ✅ Instagram (reels)
- ✅ TikTok (videos)
- ✅ Vimeo
- ✅ Direct MP4 URLs
- ⚠️ Platform restrictions may apply

## Cost Optimization Tips

1. **Use 720p max resolution** (already configured)
   - Saves on Mux encoding costs
   - Adequate quality for recipe videos

2. **Enable cold storage** (automatic after 30 days)
   - 60% savings on storage costs

3. **Delete old videos** (optional)
   - Keep recipe metadata
   - Delete Mux asset to save costs
   - User can still watch on original platform

4. **Rate limiting**
   - Implement user limits (e.g., 10 imports/month for free tier)
   - Consider paid tiers for power users

## Troubleshooting

### Error: "Failed to download video"
- **Cause**: Private video, geo-restricted, or platform blocking
- **Solution**: Ensure video is public and accessible

### Error: "Mux upload timeout"
- **Cause**: Large video file (>500MB) or slow connection
- **Solution**: Video is automatically limited to 500MB in downloader

### Error: "Gemini analysis failed"
- **Cause**: Video too long, no speech/captions, or API quota exceeded
- **Solution**:
  - Keep videos under 10 minutes
  - Ensure video has clear cooking content
  - Check Google AI API quotas

### Error: "Recipe extraction incomplete"
- **Cause**: AI couldn't identify recipe in video
- **Solution**: Verify video contains clear recipe instructions

## Advanced Configuration

### Adjust Video Quality (Lower Costs)

Edit `lib/videoDownloader.ts`:

```typescript
// Change from 720p to 480p (cheaper)
'-f', 'bestvideo[ext=mp4][height<=480]+bestaudio[ext=m4a]/best[ext=mp4][height<=480]/best',
```

### Change Mux Video Quality

Edit `lib/muxUploader.ts`:

```typescript
new_asset_settings: {
  video_quality: 'basic', // or 'plus' for better quality (costs more)
  max_resolution_tier: '480p', // Lower = cheaper
}
```

### Customize Gemini Model

Edit `lib/geminiVideoAnalyzer.ts`:

```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp', // Fast & cheap
  // OR
  model: 'gemini-2.5-pro',       // More accurate, slower, more expensive
});
```

## Security Considerations

1. **Rate Limiting**: Implement rate limits to prevent abuse
2. **Content Validation**: Check for appropriate content before processing
3. **User Quotas**: Set limits per user tier
4. **API Key Protection**: Never commit `.env.local` to git
5. **DMCA Compliance**: Respect copyright, only use with permission

## Legal Notes

### YouTube Terms of Service
- Downloading videos may violate YouTube ToS
- Consider using YouTube embed API instead for playback
- Only process creator-owned content or with explicit permission

### Recommended Approach
- For public recipes: Use YouTube embed (no download)
- For creator-owned content: Get explicit permission
- Implement DMCA takedown process

## Next Steps

1. ✅ Feature is ready to use
2. 🔜 Create Mux Video Player component (for recipe detail view)
3. 🔜 Add video support to UniversalRecipeCard
4. 🔜 Implement timeline scrubbing with key frames
5. 🔜 Add batch processing for multiple videos

## Support

For issues or questions:
- Mux Docs: https://docs.mux.com
- Gemini AI Docs: https://ai.google.dev/docs
- yt-dlp Docs: https://github.com/yt-dlp/yt-dlp

## Cost Estimate Calculator

### Example: 100 videos/month, 5 minutes avg

**Mux Costs:**
- Encoding: 100 × 5 min × $0.02/min = $10.00 (one-time)
- Storage: 100 × 5 min × $0.003/min = $1.50/month
- Delivery (avg 50 views/video): 100 × 5 × 50 × $0.001 = $25.00/month

**Gemini Costs:**
- Analysis: 100 × 5 min × $0.05/min = $25.00/month

**Total First Month**: $61.50
**Monthly Recurring**: $51.50

**Cost Per Recipe**: ~$0.62 (amortized)

### Cost Savings Tips
- Use Gemini 2.0 Flash (10x cheaper than Pro)
- Limit video length to 5 minutes max
- Enable Mux cold storage
- Consider deleting videos after 90 days
