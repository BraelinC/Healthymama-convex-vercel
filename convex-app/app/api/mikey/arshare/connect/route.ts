import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import fs from "fs";
import path from "path";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Read private key from file
function getPrivateKey(): string | null {
  try {
    const keyPath = path.join(process.cwd(), "keys", "id-fag98-private-key.key");
    return fs.readFileSync(keyPath, "utf8");
  } catch (error) {
    console.error("[Ayrshare Connect] Failed to load private key:", error);
    return null;
  }
}

/**
 * Initiate Ayrshare Profile Creation and SSO
 * GET /api/mikey/arshare/connect
 *
 * Flow:
 * 1. Create Ayrshare profile for Instagram account
 * 2. Generate JWT for SSO
 * 3. Redirect to Ayrshare SSO page to connect Instagram
 * 4. Webhook receives connected account info
 */
export async function GET(request: Request) {
  try {
    console.log("[Ayrshare Connect] === STARTING CONNECTION FLOW ===");

    // 1. Check if user is authenticated
    const { userId } = await auth();
    console.log(`[Ayrshare Connect] User ID: ${userId}`);

    if (!userId) {
      console.error("[Ayrshare Connect] ERROR: Unauthorized - no userId");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check if user is admin
    const user = await convex.query(api.users.queries.getUserById, { userId });
    console.log(`[Ayrshare Connect] User isAdmin: ${user?.isAdmin}`);

    if (!user?.isAdmin) {
      console.error("[Ayrshare Connect] ERROR: Access denied - user is not admin");
      return NextResponse.json({ error: "Access denied - admin only" }, { status: 403 });
    }

    // 3. Create Ayrshare profile (ALWAYS create new - no reuse)
    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

    console.log(`[Ayrshare Connect] API Key present: ${!!AYRSHARE_API_KEY}`);
    console.log(`[Ayrshare Connect] API Key prefix: ${AYRSHARE_API_KEY?.substring(0, 8)}...`);

    if (!AYRSHARE_API_KEY) {
      console.error("[Ayrshare Connect] ERROR: AYRSHARE_API_KEY not configured");
      return NextResponse.json({ error: "AYRSHARE_API_KEY not configured" }, { status: 500 });
    }

    // ALWAYS create a NEW profile with unique timestamp
    const profileTitle = `HealthyMama Bot - ${Date.now()}`;
    console.log(`[Ayrshare Connect] Creating profile with title: ${profileTitle}`);

    console.log(`[Ayrshare Connect] === CREATING AYRSHARE PROFILE ===`);
    console.log(`[Ayrshare Connect] URL: ${AYRSHARE_BASE_URL}/api/profiles`);

    const profileResponse = await fetch(`${AYRSHARE_BASE_URL}/api/profiles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AYRSHARE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: profileTitle }),
    });

    console.log(`[Ayrshare Connect] Profile creation response status: ${profileResponse.status} ${profileResponse.statusText}`);

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error("[Ayrshare Connect] Profile creation failed:", errorText);
      return NextResponse.json({ error: "Failed to create Ayrshare profile" }, { status: 500 });
    }

    const profileData = await profileResponse.json();
    console.log("[Ayrshare Connect] Profile created successfully:");
    console.log("[Ayrshare Connect] Profile data:", JSON.stringify(profileData, null, 2));

    if (profileData.status !== "success" || !profileData.profileKey) {
      console.error("[Ayrshare Connect] ERROR: Invalid profile response - missing profileKey");
      return NextResponse.json({ error: "Invalid profile response" }, { status: 500 });
    }

    const profileKey = profileData.profileKey;
    const refId = profileData.refId;

    console.log(`[Ayrshare Connect] Profile Key: ${profileKey}`);
    console.log(`[Ayrshare Connect] Ref ID: ${refId}`);

    // 4. Generate JWT for SSO
    console.log(`[Ayrshare Connect] === GENERATING JWT FOR SSO ===`);

    const AYRSHARE_DOMAIN = process.env.AYRSHARE_DOMAIN || "id-fag98";
    const AYRSHARE_PRIVATE_KEY = getPrivateKey();

    console.log(`[Ayrshare Connect] Domain: ${AYRSHARE_DOMAIN}`);
    console.log(`[Ayrshare Connect] Private key loaded: ${!!AYRSHARE_PRIVATE_KEY}`);
    console.log(`[Ayrshare Connect] Private key length: ${AYRSHARE_PRIVATE_KEY?.length || 0} chars`);

    if (!AYRSHARE_PRIVATE_KEY) {
      console.error("[Ayrshare Connect] ERROR: Failed to load private key");
      return NextResponse.json({ error: "Failed to load private key" }, { status: 500 });
    }

    console.log(`[Ayrshare Connect] Calling generateJWT API with allowedSocial: ["instagram"]...`);

    const jwtResponse = await fetch(`${AYRSHARE_BASE_URL}/api/profiles/generateJWT`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AYRSHARE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: AYRSHARE_DOMAIN,
        privateKey: AYRSHARE_PRIVATE_KEY,
        profileKey: profileKey,
        allowedSocial: ["instagram"], // Only show Instagram connection button
      }),
    });

    console.log(`[Ayrshare Connect] JWT response status: ${jwtResponse.status} ${jwtResponse.statusText}`);

    if (!jwtResponse.ok) {
      const errorText = await jwtResponse.text();
      console.error("[Ayrshare Connect] JWT generation failed:", errorText);
      return NextResponse.json({ error: "Failed to generate JWT" }, { status: 500 });
    }

    const jwtData = await jwtResponse.json();
    console.log("[Ayrshare Connect] JWT generated successfully");
    console.log("[Ayrshare Connect] JWT data:", JSON.stringify(jwtData, null, 2));
    console.log(`[Ayrshare Connect] JWT token length: ${jwtData.token?.length || 0} chars`);

    if (jwtData.status !== "success" || !jwtData.token) {
      console.error("[Ayrshare Connect] ERROR: Invalid JWT response - missing token");
      return NextResponse.json({ error: "Invalid JWT response" }, { status: 500 });
    }

    // 5. Save pending profile to database for later retrieval
    console.log(`[Ayrshare Connect] === SAVING PENDING PROFILE ===`);
    console.log(`[Ayrshare Connect] Saving for userId: ${userId}`);

    await convex.mutation(api.mikey.mutations.savePendingProfile, {
      userId,
      profileKey,
      refId,
    });

    console.log(`[Ayrshare Connect] Pending profile saved successfully`);

    // Use the URL provided by Ayrshare in the JWT response
    // CRITICAL: Add logout=true to force logout of any cached profile session
    // Without this, Instagram connects to the currently logged-in profile instead of the new bot profile
    const baseUrl = jwtData.url || `https://profile.ayrshare.com?domain=${AYRSHARE_DOMAIN}&jwt=${jwtData.token}`;
    const ssoUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}logout=true`;

    console.log(`[Ayrshare Connect] === REDIRECTING TO SSO ===`);
    console.log(`[Ayrshare Connect] Base URL: ${baseUrl}`);
    console.log(`[Ayrshare Connect] SSO URL with logout=true: ${ssoUrl}`);
    console.log(`[Ayrshare Connect] Using Ayrshare-provided URL: ${!!jwtData.url}`);
    console.log(`[Ayrshare Connect] Forcing logout to switch to bot profile`);

    // 6. Redirect to Ayrshare social linking page
    return NextResponse.redirect(ssoUrl);
  } catch (error: any) {
    console.error("[Ayrshare Connect] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
