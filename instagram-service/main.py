"""
Instagram Recipe Extractor Service

This Flask microservice extracts recipe data from Instagram reels using the instagrapi library.
It fetches the reel's caption, comments, video URL, and thumbnail to be parsed by AI into a recipe.

Architecture:
- Railway deployment (Python 3.10+)
- Flask web server with CORS enabled
- Instagram authentication via dedicated account
- Rate limiting built-in (1-2 second delays)

Environment Variables Required:
- IG_USERNAME: Instagram username for API access (use dedicated account, not personal)
- IG_PASSWORD: Instagram password
- PORT: Server port (set automatically by Railway)

API Endpoints:
- GET /health: Health check for Railway monitoring
- POST /extract-instagram: Extract reel data from Instagram URL
"""

import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js requests from any origin

# Instagram client (singleton pattern)
# We maintain a single authenticated Instagram session to avoid repeated logins
# This improves performance and reduces the risk of rate limiting
ig_client = None

def get_instagram_client():
    """
    Get or create Instagram client with authentication

    Uses singleton pattern to maintain one authenticated session throughout
    the application lifecycle. This prevents repeated login attempts which
    could trigger Instagram's rate limiting or security checks.

    Returns:
        Client: Authenticated instagrapi Client instance

    Raises:
        ValueError: If IG_USERNAME or IG_PASSWORD environment variables are missing
        Exception: If Instagram login fails (wrong credentials, account locked, etc.)

    Note:
        Instagram may require email/SMS verification for new accounts or
        flag accounts used for scraping. Use a dedicated account, not personal.
    """
    global ig_client

    if ig_client is None:
        username = os.getenv('IG_USERNAME')
        password = os.getenv('IG_PASSWORD')

        if not username or not password:
            raise ValueError("IG_USERNAME and IG_PASSWORD environment variables are required")

        ig_client = Client()

        try:
            # Try to login
            ig_client.login(username, password)
            print(f"✅ Logged in as @{username}")
        except Exception as e:
            print(f"❌ Login failed: {str(e)}")
            raise

    return ig_client

def extract_media_id_from_url(url: str) -> str:
    """
    Extract Instagram media ID (shortcode) from various URL formats

    Instagram URLs come in different formats but all contain a "shortcode"
    (media ID) that uniquely identifies the post/reel. This function extracts
    that shortcode from any valid Instagram URL format.

    Supported URL formats:
    - https://www.instagram.com/reel/ABC123/
    - https://www.instagram.com/p/ABC123/
    - https://www.instagram.com/tv/ABC123/
    - https://instagram.com/reel/ABC123/?igsh=xyz (with query params)

    Args:
        url (str): Instagram URL to parse

    Returns:
        str: Media shortcode (e.g., "ABC123")

    Raises:
        ValueError: If URL format is invalid or shortcode cannot be extracted

    Implementation:
        1. Remove query parameters (anything after ?)
        2. Split URL by /
        3. Find /reel/, /p/, or /tv/ segment
        4. Return the segment immediately after it
    """
    try:
        # Remove query parameters
        clean_url = url.split('?')[0]

        # Extract the shortcode (media ID)
        # Format: /reel/{SHORTCODE}/ or /p/{SHORTCODE}/
        parts = clean_url.rstrip('/').split('/')

        # Find the media ID (after /reel/ or /p/)
        for i, part in enumerate(parts):
            if part in ['reel', 'p', 'tv'] and i + 1 < len(parts):
                return parts[i + 1]

        raise ValueError("Could not extract media ID from URL")
    except Exception as e:
        raise ValueError(f"Invalid Instagram URL format: {str(e)}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Railway"""
    return jsonify({"status": "healthy", "service": "instagram-extractor"}), 200

@app.route('/extract-instagram', methods=['POST'])
def extract_instagram():
    """
    Main API endpoint: Extract Instagram reel data for recipe parsing

    This endpoint is called by the Next.js backend to fetch Instagram data.
    It authenticates with Instagram, fetches the reel's metadata, and returns
    all relevant information needed for AI recipe parsing.

    Request body (JSON):
    {
        "url": "https://www.instagram.com/reel/ABC123/"
    }

    Success Response (200):
    {
        "success": true,
        "caption": "Recipe caption text",
        "comments": ["comment 1", "comment 2", ...],  // Up to 50 comments
        "videoUrl": "https://...",  // Video download URL
        "thumbnailUrl": "https://...",  // Preview image URL
        "postUrl": "https://www.instagram.com/reel/ABC123/",  // Original URL
        "username": "creator_username",  // Post author
        "mediaType": "video" | "photo"  // Content type
    }

    Error Response (400/404/500):
    {
        "success": false,
        "error": "Error message describing what went wrong"
    }

    Process Flow:
        1. Validate Instagram URL
        2. Extract media shortcode from URL
        3. Authenticate with Instagram (or reuse existing session)
        4. Fetch media metadata (caption, video URL, thumbnail)
        5. Fetch comments (up to 50, with rate limiting)
        6. Return all data as JSON

    Rate Limiting:
        - 1 second delay before fetching comments to avoid Instagram rate limits
        - Comments fetch may fail for some accounts (non-critical, continues without)

    Common Errors:
        - 400: Missing or invalid Instagram URL
        - 404: Post not found (deleted, private account, wrong URL)
        - 500: Instagram auth failed or unexpected error

    Instagram API Notes:
        - Instagram may rate limit requests (~200-500/hour)
        - Private accounts will return 404
        - Deleted posts will return 404
        - Some accounts may have comments disabled
    """
    try:
        # Get URL from request
        data = request.get_json()
        url = data.get('url')

        if not url:
            return jsonify({"error": "Missing 'url' in request body", "success": False}), 400

        # Validate Instagram URL
        if 'instagram.com' not in url:
            return jsonify({"error": "Invalid Instagram URL", "success": False}), 400

        # Extract media ID
        try:
            media_shortcode = extract_media_id_from_url(url)
        except ValueError as e:
            return jsonify({"error": str(e), "success": False}), 400

        # Get Instagram client
        try:
            client = get_instagram_client()
        except Exception as e:
            return jsonify({"error": f"Instagram authentication failed: {str(e)}", "success": False}), 500

        # Fetch media info
        try:
            # Convert shortcode to media_pk (required by instagrapi)
            media_pk = client.media_pk_from_code(media_shortcode)
            media = client.media_info(media_pk)

            print(f"📱 Fetched media: {media.code}")
        except ClientError as e:
            return jsonify({"error": f"Failed to fetch Instagram post: {str(e)}", "success": False}), 404
        except Exception as e:
            return jsonify({"error": f"Unexpected error fetching post: {str(e)}", "success": False}), 500

        # Step 4: Extract caption
        # The caption usually contains the recipe text or instructions
        caption = media.caption_text or ""

        # Step 5: Extract comments (limit to first 50 to save time and bandwidth)
        # Comments often contain additional recipe details like ingredients or tips
        comments_data = []
        try:
            # Rate limiting: Instagram limits rapid requests
            # Wait 1 second before fetching comments to avoid rate limit errors
            time.sleep(1)

            # Fetch up to 50 comments (enough for most recipes)
            comments = client.media_comments(media_pk, amount=50)
            # Filter out empty comments (deleted or empty text)
            comments_data = [comment.text for comment in comments if comment.text]

            print(f"💬 Fetched {len(comments_data)} comments")
        except Exception as e:
            print(f"⚠️ Failed to fetch comments: {str(e)}")
            # Comments fetch may fail due to:
            # - Account permissions (comments disabled)
            # - Rate limiting
            # - Network issues
            # Continue without comments (not critical for recipe extraction)

        # Step 6: Extract video URL (if content is a video/reel)
        # media_type values: 1 = Photo, 2 = Video, 8 = Carousel
        video_url = None
        if media.media_type == 2:  # 2 = Video
            video_url = str(media.video_url) if media.video_url else None

        # Step 7: Extract thumbnail (preview image)
        # Used as recipe image in the frontend
        thumbnail_url = str(media.thumbnail_url) if media.thumbnail_url else None

        # Step 8: Get post author username
        username = media.user.username if media.user else "unknown"

        # Return extracted data
        return jsonify({
            "success": True,
            "caption": caption,
            "comments": comments_data,
            "videoUrl": video_url,
            "thumbnailUrl": thumbnail_url,
            "postUrl": url,
            "username": username,
            "mediaType": "video" if media.media_type == 2 else "photo"
        }), 200

    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}", "success": False}), 500

if __name__ == '__main__':
    # For local development
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
