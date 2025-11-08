"""
Instagram Recipe Extractor Service (with Convex Account Rotation)

This Flask microservice extracts recipe data from Instagram reels using the instagrapi library.
It fetches the reel's caption, comments, video URL, and thumbnail to be parsed by AI into a recipe.

Architecture:
- Railway deployment (Python 3.10+)
- Flask web server with CORS enabled
- Instagram authentication via Convex account rotation (100+ videos/hour scaling)
- Round-robin rotation: automatically switches between multiple Instagram accounts
- Rate limiting built-in (1-2 second delays)

Environment Variables Required:
- CONVEX_URL: Convex deployment URL (e.g., https://your-deployment.convex.cloud)
- PORT: Server port (set automatically by Railway)

Removed Environment Variables (now managed in Convex):
- IG_USERNAME: (deprecated) Use Convex instagramAccounts table instead
- IG_PASSWORD: (deprecated) Use Convex instagramAccounts table instead

Account Rotation Strategy:
1. Before each Instagram request: call Convex to get next available account
2. Use account credentials to login and fetch Instagram data
3. After successful use: update account's lastUsedAt timestamp in Convex
4. On errors: update account status (rate_limited/banned/login_failed) in Convex
5. Convex automatically skips unhealthy accounts in future rotations

Scaling Benefits:
- With 1 account: ~50-100 videos/hour (safe)
- With 5 accounts: ~250-500 videos/hour
- With 10+ accounts: 500+ videos/hour

API Endpoints:
- GET /health: Health check for Railway monitoring
- POST /extract-instagram: Extract reel data from Instagram URL
"""

import os
import time
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError, ChallengeRequired, PleaseWaitFewMinutes

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js requests from any origin

# Convex configuration
CONVEX_URL = os.getenv('CONVEX_URL')

def convex_query(function_name, args=None):
    """
    Call a Convex query function

    Convex queries are read-only operations that fetch data from the database.
    They use the HTTP GET method with function name and arguments in the URL.

    Args:
        function_name (str): Convex function name (e.g., "instagramAccounts:getNextAccount")
        args (dict, optional): Query arguments (e.g., {"userId": "123"})

    Returns:
        Any: The query result (usually a dict or list)

    Raises:
        ValueError: If CONVEX_URL environment variable is missing
        requests.HTTPError: If Convex API returns an error
    """
    if not CONVEX_URL:
        raise ValueError("CONVEX_URL environment variable is required")

    url = f"{CONVEX_URL}/api/query"
    payload = {
        "path": function_name,
        "args": args or {},
        "format": "json"
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    data = response.json()
    return data.get("value")

def convex_mutation(function_name, args):
    """
    Call a Convex mutation function

    Convex mutations are write operations that modify data in the database.
    They use the HTTP POST method with function name and arguments.

    Args:
        function_name (str): Convex function name (e.g., "instagramAccounts:updateLastUsed")
        args (dict): Mutation arguments (e.g., {"accountId": "abc123"})

    Returns:
        Any: The mutation result

    Raises:
        ValueError: If CONVEX_URL environment variable is missing
        requests.HTTPError: If Convex API returns an error
    """
    if not CONVEX_URL:
        raise ValueError("CONVEX_URL environment variable is required")

    url = f"{CONVEX_URL}/api/mutation"
    payload = {
        "path": function_name,
        "args": args,
        "format": "json"
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    data = response.json()
    return data.get("value")

def get_instagram_account_from_convex():
    """
    Get next available Instagram account from Convex (Round-Robin Rotation)

    This function calls Convex to get the least-recently-used active account.
    Convex automatically skips unhealthy accounts (rate_limited, banned, login_failed).

    Returns:
        dict: Account info with keys: accountId, username, password, proxyUrl
        None: If no accounts are available

    Raises:
        ValueError: If CONVEX_URL is not configured
        Exception: If Convex API call fails

    Flow:
        1. Call Convex query: instagramAccounts:getNextAccount
        2. Convex finds active account with oldest lastUsedAt
        3. Return account credentials for Instagram login
        4. Caller must call update_instagram_account_usage() after successful use
    """
    try:
        account = convex_query("instagramAccounts:getNextAccount")

        if not account:
            print("⚠️ No Instagram accounts available in Convex")
            return None

        print(f"🔄 Using Instagram account: {account['username']}")
        return account
    except Exception as e:
        print(f"❌ Failed to get Instagram account from Convex: {str(e)}")
        raise

def update_instagram_account_usage(account_id):
    """
    Update account usage after successful Instagram data fetch

    This mutation updates the account's lastUsedAt timestamp and increments
    the usageCount. This ensures proper round-robin rotation in future requests.

    Args:
        account_id (str): Convex account ID from get_instagram_account_from_convex()

    Raises:
        Exception: If Convex mutation fails
    """
    try:
        convex_mutation("instagramAccounts:updateLastUsed", {
            "accountId": account_id
        })
        print(f"✅ Updated usage for account {account_id}")
    except Exception as e:
        print(f"⚠️ Failed to update account usage: {str(e)}")
        # Don't raise - this is not critical for the main flow

def update_instagram_account_status(account_id, status, is_active=None):
    """
    Update account status when errors occur

    This mutation marks accounts as unhealthy when they encounter errors.
    Convex will automatically skip unhealthy accounts in future rotations.

    Args:
        account_id (str): Convex account ID
        status (str): New status - "active", "rate_limited", "banned", "login_failed"
        is_active (bool, optional): Set to False to completely disable account

    Status Meanings:
        - rate_limited: Instagram rate limit detected (PleaseWaitFewMinutes exception)
        - banned: Account blocked by Instagram (ChallengeRequired exception)
        - login_failed: Invalid credentials (LoginRequired exception)
        - active: Account is healthy (use after fixing issues)

    Raises:
        Exception: If Convex mutation fails
    """
    try:
        args = {
            "accountId": account_id,
            "status": status
        }
        if is_active is not None:
            args["isActive"] = is_active

        convex_mutation("instagramAccounts:updateAccountStatus", args)
        print(f"🔧 Updated account {account_id} status: {status}")
    except Exception as e:
        print(f"⚠️ Failed to update account status: {str(e)}")
        # Don't raise - this is not critical for error handling

def get_instagram_client_with_rotation():
    """
    Get Instagram client using Convex account rotation

    This function replaces the old singleton pattern with dynamic account rotation.
    It fetches credentials from Convex, logs in to Instagram, and returns both
    the authenticated client and the account ID (for later usage tracking).

    Returns:
        tuple: (Client, account_id) - Authenticated Instagram client and Convex account ID

    Raises:
        ValueError: If no accounts are available in Convex
        LoginRequired: If Instagram login fails with provided credentials
        Exception: If Convex API fails or Instagram authentication fails

    Flow:
        1. Get next account from Convex (round-robin)
        2. Create new Instagram client
        3. Login with account credentials
        4. Configure proxy if account has proxyUrl
        5. Return client + account_id for usage tracking

    Error Handling:
        - LoginRequired: Updates account status to "login_failed"
        - ChallengeRequired: Updates account status to "banned"
        - PleaseWaitFewMinutes: Updates account status to "rate_limited"
        - All errors are re-raised after updating Convex
    """
    # Get next account from Convex
    account = get_instagram_account_from_convex()

    if not account:
        raise ValueError("No Instagram accounts available. Please add accounts to Convex.")

    account_id = account['accountId']
    username = account['username']
    password = account['password']
    proxy_url = account.get('proxyUrl')

    # Create new Instagram client
    client = Client()

    # Configure proxy if provided
    if proxy_url:
        client.set_proxy(proxy_url)
        print(f"🌐 Using proxy: {proxy_url}")

    try:
        # Login to Instagram
        client.login(username, password)
        print(f"✅ Logged in as @{username}")

        return client, account_id

    except LoginRequired as e:
        # Invalid credentials or account locked
        print(f"❌ Login failed for @{username}: {str(e)}")
        update_instagram_account_status(account_id, "login_failed", is_active=False)
        raise

    except ChallengeRequired as e:
        # Account banned or challenge required (2FA, verify email, etc.)
        print(f"❌ Account @{username} requires challenge or is banned: {str(e)}")
        update_instagram_account_status(account_id, "banned", is_active=False)
        raise

    except Exception as e:
        print(f"❌ Unexpected login error for @{username}: {str(e)}")
        raise

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

        # Get Instagram client with Convex account rotation
        try:
            client, account_id = get_instagram_client_with_rotation()
        except ValueError as e:
            # No accounts available in Convex
            return jsonify({
                "error": f"No Instagram accounts available: {str(e)}",
                "success": False,
                "hint": "Add Instagram accounts to Convex database using the instagramAccounts:addAccount mutation"
            }), 503
        except LoginRequired as e:
            # Login failed (account status already updated to "login_failed")
            return jsonify({"error": f"Instagram login failed: {str(e)}", "success": False}), 401
        except ChallengeRequired as e:
            # Account banned (account status already updated to "banned")
            return jsonify({"error": f"Instagram account requires verification: {str(e)}", "success": False}), 403
        except Exception as e:
            return jsonify({"error": f"Instagram authentication failed: {str(e)}", "success": False}), 500

        # Fetch media info
        try:
            # Convert shortcode to media_pk (required by instagrapi)
            media_pk = client.media_pk_from_code(media_shortcode)
            media = client.media_info(media_pk)

            print(f"📱 Fetched media: {media.code}")
        except PleaseWaitFewMinutes as e:
            # Rate limit detected - mark account as rate_limited
            print(f"⏳ Rate limit detected for account {account_id}")
            update_instagram_account_status(account_id, "rate_limited", is_active=False)
            return jsonify({
                "error": f"Instagram rate limit reached: {str(e)}",
                "success": False,
                "hint": "This account is rate limited. Rotation will automatically use a different account."
            }), 429
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

        # Step 9: Update account usage in Convex (for round-robin rotation)
        # This increments usageCount and updates lastUsedAt timestamp
        update_instagram_account_usage(account_id)

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
