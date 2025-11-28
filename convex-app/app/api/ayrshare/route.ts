import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const AYRSHARE_API_KEY = process.env.AYRSHARE_API;
const AYRSHARE_DOMAIN = process.env.AYRSHARE_DOMAIN || "id-fag98";
const AYRSHARE_BASE_URL = "https://api.ayrshare.com/api";

// Read private key from file
function getPrivateKey(): string | null {
  try {
    const keyPath = path.join(process.cwd(), "keys", "id-fag98-private-key.key");
    return fs.readFileSync(keyPath, "utf8");
  } catch (error) {
    console.error("[Ayrshare] Failed to load private key:", error);
    return null;
  }
}

/**
 * POST /api/ayrshare - Handle various Ayrshare operations
 *
 * Actions:
 * - create-profile: Create a new Ayrshare profile for a user
 * - connect-url: Generate JWT connect URL for Instagram linking
 * - status: Check Instagram connection status
 * - sync-profile-image: Fetch Instagram profile image URL
 * - get-upload-url: Get presigned URL for media upload
 * - post-to-instagram: Post content to Instagram Stories
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, profileKey, redirectUrl, mediaUrl, caption, isStory, fileName, contentType } = body;

    if (!AYRSHARE_API_KEY) {
      return NextResponse.json(
        { error: "Ayrshare API key not configured" },
        { status: 500 }
      );
    }

    switch (action) {
      case "create-profile":
        return await createProfile(userId);
      case "connect-url":
        return await getConnectUrl(profileKey, redirectUrl);
      case "status":
        return await getConnectionStatus(profileKey);
      case "sync-profile-image":
        return await syncProfileImage(profileKey);
      case "get-upload-url":
        return await getMediaUploadUrl(profileKey, fileName, contentType);
      case "post-to-instagram":
        return await postToInstagram(profileKey, mediaUrl, caption, isStory);
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Ayrshare API Error]:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Create a new Ayrshare profile for a user
 */
async function createProfile(userId: string) {
  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const response = await fetch(`${AYRSHARE_BASE_URL}/profiles`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: `healthymama_${userId.substring(0, 20)}`,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[Ayrshare Create Profile Error]:", errorData);
    return NextResponse.json(
      { error: "Failed to create Ayrshare profile", details: errorData },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    success: true,
    profileKey: data.profileKey,
    refId: data.refId,
  });
}

/**
 * Generate JWT connect URL for Instagram linking
 * Uses /profiles/generateJWT endpoint with RSA private key
 */
async function getConnectUrl(profileKey: string, redirectUrl: string) {
  if (!profileKey) {
    return NextResponse.json(
      { error: "profileKey is required" },
      { status: 400 }
    );
  }

  // Load RSA private key
  const privateKey = getPrivateKey();
  if (!privateKey) {
    return NextResponse.json(
      { error: "Failed to load private key for JWT generation" },
      { status: 500 }
    );
  }

  console.log("[Ayrshare] Generating JWT with domain:", AYRSHARE_DOMAIN);
  console.log("[Ayrshare] Profile key:", profileKey);

  const response = await fetch(`${AYRSHARE_BASE_URL}/profiles/generateJWT`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      domain: AYRSHARE_DOMAIN,
      privateKey: privateKey,
      profileKey: profileKey,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[Ayrshare Generate JWT Error]:", errorData);
    return NextResponse.json(
      { error: "Failed to generate connect URL", details: errorData },
      { status: response.status }
    );
  }

  const data = await response.json();
  console.log("[Ayrshare] JWT Response:", data);

  // Use the URL provided by Ayrshare API or construct it
  const ssoUrl = data.url || `https://profile.ayrshare.com/social-accounts?domain=${AYRSHARE_DOMAIN}&jwt=${data.token}`;

  return NextResponse.json({
    success: true,
    url: ssoUrl,
    token: data.token,
    expiresIn: data.expiresIn || "5m",
  });
}

/**
 * Check Instagram connection status for a profile
 */
async function getConnectionStatus(profileKey: string) {
  if (!profileKey) {
    return NextResponse.json(
      { error: "profileKey is required" },
      { status: 400 }
    );
  }

  const response = await fetch(`${AYRSHARE_BASE_URL}/user`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      "Content-Type": "application/json",
      "Profile-Key": profileKey,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[Ayrshare Status Error]:", errorData);
    return NextResponse.json(
      { error: "Failed to get connection status", details: errorData },
      { status: response.status }
    );
  }

  const data = await response.json();
  console.log("[Ayrshare Status Response]:", JSON.stringify(data, null, 2));

  // Check if Instagram is in the connected platforms
  // API returns activeSocialAccounts array and displayNames array
  const instagramConnected = data.activeSocialAccounts?.includes("instagram") || false;
  const instagramInfo = data.displayNames?.find((d: any) => d.platform === "instagram");

  return NextResponse.json({
    success: true,
    instagramConnected,
    instagramUsername: instagramInfo?.username || instagramInfo?.displayName || null,
    instagramProfilePicture: instagramInfo?.userImage || null,
    connectedPlatforms: data.activeSocialAccounts || [],
    displayNames: data.displayNames || [],
  });
}

/**
 * Sync Instagram profile image
 */
async function syncProfileImage(profileKey: string) {
  if (!profileKey) {
    return NextResponse.json(
      { error: "profileKey is required" },
      { status: 400 }
    );
  }

  // First get the user data to fetch Instagram profile picture
  const response = await fetch(`${AYRSHARE_BASE_URL}/user`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      "Content-Type": "application/json",
      "Profile-Key": profileKey,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[Ayrshare Sync Image Error]:", errorData);
    return NextResponse.json(
      { error: "Failed to fetch Instagram data", details: errorData },
      { status: response.status }
    );
  }

  const data = await response.json();
  console.log("[Ayrshare Sync Image Response]:", JSON.stringify(data, null, 2));

  // Find Instagram in displayNames array
  const instagramInfo = data.displayNames?.find((d: any) => d.platform === "instagram");

  if (!instagramInfo?.userImage) {
    return NextResponse.json(
      { error: "No Instagram profile picture available", data: data },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    profilePictureUrl: instagramInfo.userImage,
    username: instagramInfo.username || instagramInfo.displayName,
  });
}

/**
 * Get presigned URL for media upload to Ayrshare
 */
async function getMediaUploadUrl(profileKey: string, fileName: string, contentType: string) {
  if (!profileKey) {
    return NextResponse.json(
      { error: "profileKey is required" },
      { status: 400 }
    );
  }

  if (!fileName || !contentType) {
    return NextResponse.json(
      { error: "fileName and contentType are required" },
      { status: 400 }
    );
  }

  console.log("[Ayrshare] Getting upload URL for:", fileName, contentType);

  const response = await fetch(
    `${AYRSHARE_BASE_URL}/media/uploadUrl?fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
        "Profile-Key": profileKey,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[Ayrshare Upload URL Error]:", errorData);
    return NextResponse.json(
      { error: "Failed to get upload URL", details: errorData },
      { status: response.status }
    );
  }

  const data = await response.json();
  console.log("[Ayrshare] Upload URL Response:", data);

  return NextResponse.json({
    success: true,
    uploadUrl: data.uploadUrl,    // PUT media here
    accessUrl: data.accessUrl,    // Use this URL in post request
  });
}

/**
 * Post content to Instagram Stories
 */
async function postToInstagram(profileKey: string, mediaUrl: string, caption: string, isStory: boolean = true) {
  if (!profileKey) {
    return NextResponse.json(
      { error: "profileKey is required" },
      { status: 400 }
    );
  }

  if (!mediaUrl) {
    return NextResponse.json(
      { error: "mediaUrl is required" },
      { status: 400 }
    );
  }

  console.log("[Ayrshare] Posting to Instagram:", { mediaUrl, caption, isStory });

  const postBody: any = {
    post: caption || "",
    platforms: ["instagram"],
    mediaUrls: [mediaUrl],
  };

  // Add Instagram-specific options for Stories
  if (isStory) {
    postBody.instagramOptions = {
      isStory: true,
    };
  }

  const response = await fetch(`${AYRSHARE_BASE_URL}/post`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      "Content-Type": "application/json",
      "Profile-Key": profileKey,
    },
    body: JSON.stringify(postBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[Ayrshare Post Error]:", errorData);
    return NextResponse.json(
      { error: "Failed to post to Instagram", details: errorData },
      { status: response.status }
    );
  }

  const data = await response.json();
  console.log("[Ayrshare] Post Response:", JSON.stringify(data, null, 2));

  return NextResponse.json({
    success: true,
    postId: data.id,
    postIds: data.postIds,
    status: data.status,
  });
}

/**
 * GET /api/ayrshare - Get connection status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileKey = searchParams.get("profileKey");

  if (!profileKey) {
    return NextResponse.json(
      { error: "profileKey is required" },
      { status: 400 }
    );
  }

  return getConnectionStatus(profileKey);
}
