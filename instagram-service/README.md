# Instagram Recipe Extractor Service

Flask microservice that extracts Instagram reel data (captions, comments, video URLs) for recipe import.

## Features

- Extracts Instagram reel captions
- Fetches up to 50 comments per reel
- Returns video and thumbnail URLs
- Rate limiting and error handling
- Health check endpoint

## Local Development

### Prerequisites

- Python 3.10+
- Instagram account (create a dedicated account, don't use personal)

### Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

3. Add your Instagram credentials to `.env`:
   ```
   IG_USERNAME=your_username
   IG_PASSWORD=your_password
   ```

4. Run the server:
   ```bash
   python main.py
   ```

5. Test the endpoint:
   ```bash
   curl -X POST http://localhost:5000/extract-instagram \
     -H "Content-Type: application/json" \
     -d '{"url": "https://www.instagram.com/reel/ABC123/"}'
   ```

## Railway Deployment

### Deploy to Railway

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```bash
   railway login
   ```

3. Initialize project:
   ```bash
   railway init
   ```

4. Set environment variables:
   ```bash
   railway variables set IG_USERNAME=your_username
   railway variables set IG_PASSWORD=your_password
   ```

5. Deploy:
   ```bash
   railway up
   ```

6. Get your public URL:
   ```bash
   railway domain
   ```

### Alternative: Deploy via GitHub

1. Push `instagram-service/` to a GitHub repo
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Set root directory to `instagram-service/`
6. Add environment variables in Railway dashboard
7. Deploy!

## API Endpoints

### POST `/extract-instagram`

Extract Instagram reel data.

**Request:**
```json
{
  "url": "https://www.instagram.com/reel/ABC123/"
}
```

**Response:**
```json
{
  "success": true,
  "caption": "Recipe caption text",
  "comments": ["comment 1", "comment 2"],
  "videoUrl": "https://...",
  "thumbnailUrl": "https://...",
  "postUrl": "https://www.instagram.com/reel/ABC123/",
  "username": "creator_username",
  "mediaType": "video"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

### GET `/health`

Health check endpoint for Railway monitoring.

**Response:**
```json
{
  "status": "healthy",
  "service": "instagram-extractor"
}
```

## Security Notes

- Never commit `.env` file with real credentials
- Use a dedicated Instagram account (not your personal account)
- Instagram may rate limit or ban accounts used for scraping
- Consider rotating credentials periodically

## Troubleshooting

**Login Failed:**
- Verify credentials are correct
- Check if Instagram flagged the account (you may need to verify via email/SMS)
- Try logging in manually on instagram.com first

**Can't Fetch Comments:**
- Comments require additional permissions, may fail for some accounts
- The service will continue without comments (not critical)

**Rate Limiting:**
- Instagram limits requests per hour
- The service adds 1-2 second delays between requests
- Consider implementing request queuing for high volume
