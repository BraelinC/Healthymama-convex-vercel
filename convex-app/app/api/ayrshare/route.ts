import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;
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
 * - create-and-connect: Create profile and generate SSO URL in one call (optimized for popup blockers)
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
      case "create-and-connect":
        return await createProfileAndConnect(userId, redirectUrl);
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
 * Create profile and generate SSO URL in one call
 * Optimized to avoid popup blockers by returning URL immediately
 */
async function createProfileAndConnect(userId: string, redirectUrl: string) {
  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  // Step 1: Create profile
  const profileTitle = `healthymama_${userId.substring(0, 15)}_${Date.now()}`;
  console.log("[Ayrshare] Creating profile (create-and-connect):", profileTitle);

  const profileResponse = await fetch(`${AYRSHARE_BASE_URL}/profiles`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: profileTitle,
      messagingActive: true,
    }),
  });

  if (!profileResponse.ok) {
    const errorData = await profileResponse.json().catch(() => ({}));
    console.error("[Ayrshare Create Profile Error]:", errorData);
    return NextResponse.json(
      { error: "Failed to create Ayrshare profile", details: errorData },
      { status: profileResponse.status }
    );
  }

  const profileData = await profileResponse.json();
  console.log("[Ayrshare] Profile created:", profileData.profileKey);

  // Step 2: Generate JWT/SSO URL immediately
  const privateKey = getPrivateKey();
  if (!privateKey) {
    return NextResponse.json(
      { error: "Failed to load private key for JWT generation" },
      { status: 500 }
    );
  }

  console.log("[Ayrshare] Generating JWT for new profile");

  const jwtResponse = await fetch(`${AYRSHARE_BASE_URL}/profiles/generateJWT`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      domain: AYRSHARE_DOMAIN,
      privateKey: privateKey,
      profileKey: profileData.profileKey,
      allowedSocial: ["instagram"],
    }),
  });

  if (!jwtResponse.ok) {
    const errorData = await jwtResponse.json().catch(() => ({}));
    console.error("[Ayrshare Generate JWT Error]:", errorData);
    return NextResponse.json(
      { error: "Failed to generate connect URL", details: errorData },
      { status: jwtResponse.status }
    );
  }

  const jwtData = await jwtResponse.json();
  const baseUrl = jwtData.url || `https://profile.ayrshare.com/social-accounts?domain=${AYRSHARE_DOMAIN}&jwt=${jwtData.token}`;
  const ssoUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}logout=true`;

  console.log("[Ayrshare] SSO URL ready:", ssoUrl);

  // Step 3: Register webhook in background (non-blocking)
  try {
    console.log("[Ayrshare] Registering webhook for profile:", profileData.profileKey);

    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/webhook/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileKey: profileData.profileKey }),
    }).then(response => {
      if (response.ok) {
        console.log("[Ayrshare] ✅ Webhook registered successfully");
      } else {
        console.error("[Ayrshare] ❌ Webhook registration failed (non-fatal)");
      }
    }).catch(err => {
      console.error("[Ayrshare] ❌ Webhook registration exception (non-fatal):", err);
    });
  } catch (webhookError: any) {
    console.error("[Ayrshare] ❌ Webhook registration exception (non-fatal):", webhookError.message);
  }

  // Return everything needed for immediate popup
  return NextResponse.json({
    success: true,
    profileKey: profileData.profileKey,
    refId: profileData.refId,
    url: ssoUrl,
  });
}

/**
 * Create a new Ayrshare profile for a user
 * ALWAYS creates a fresh profile with unique timestamp
 */
async function createProfile(userId: string) {
  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  // Create unique profile title with timestamp to ensure fresh profile
  const profileTitle = `healthymama_${userId.substring(0, 15)}_${Date.now()}`;
  console.log("[Ayrshare] Creating profile:", profileTitle);

  const response = await fetch(`${AYRSHARE_BASE_URL}/profiles`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: profileTitle,
      messagingActive: true, // Enable messaging for this profile
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
  console.log("[Ayrshare] Profile created successfully:", data.profileKey);

  // Register webhook for instant DM notifications
  try {
    console.log("[Ayrshare] ========================================");
    console.log("[Ayrshare] REGISTERING WEBHOOK");
    console.log("[Ayrshare] Profile Key:", data.profileKey);
    console.log("[Ayrshare] App URL:", process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001');
    console.log("[Ayrshare] ========================================");

    const webhookResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/webhook/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileKey: data.profileKey }),
    });

    console.log("[Ayrshare] Webhook response status:", webhookResponse.status);

    if (webhookResponse.ok) {
      const webhookData = await webhookResponse.json();
      console.log("[Ayrshare] ✅ Webhook registered successfully:", JSON.stringify(webhookData, null, 2));
    } else {
      const errorText = await webhookResponse.text();
      console.error("[Ayrshare] ❌ Webhook registration failed (non-fatal):");
      console.error("[Ayrshare] Status:", webhookResponse.status);
      console.error("[Ayrshare] Error:", errorText);
      // Don't fail profile creation if webhook registration fails
    }
  } catch (webhookError: any) {
    console.error("[Ayrshare] ❌ Webhook registration exception (non-fatal):");
    console.error("[Ayrshare] Error:", webhookError.message);
    console.error("[Ayrshare] Stack:", webhookError.stack);
    // Don't fail profile creation if webhook registration fails
  }

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
      allowedSocial: ["instagram"], // Only show Instagram
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
  // Add logout=true to force logout of any cached profile session
  const baseUrl = data.url || `https://profile.ayrshare.com/social-accounts?domain=${AYRSHARE_DOMAIN}&jwt=${data.token}`;
  const ssoUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}logout=true`;

  console.log("[Ayrshare] SSO URL with logout=true:", ssoUrl);

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
