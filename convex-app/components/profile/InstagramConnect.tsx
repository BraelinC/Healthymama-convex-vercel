"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Instagram, Link2, Unlink, RefreshCw, Loader2, Check, ExternalLink } from "lucide-react";

interface InstagramConnectProps {
  userId: string;
  onProfileImageSync?: (imageUrl: string) => void;
}

export function InstagramConnect({ userId, onProfileImageSync }: InstagramConnectProps) {
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get user profile from Convex
  const userProfile = useQuery(api.userProfile.getUserProfileWithImage, { userId });
  const saveAyrshareProfileKey = useMutation(api.userProfile.saveAyrshareProfileKey);
  const updateInstagramConnection = useMutation(api.userProfile.updateInstagramConnection);
  const generateUploadUrl = useMutation(api.userProfile.generateProfileImageUploadUrl);
  const updateProfileImage = useMutation(api.userProfile.updateProfileImage);

  const ayrshareProfileKey = userProfile?.ayrshareProfileKey;
  const instagramConnected = userProfile?.instagramConnected;
  const instagramUsername = userProfile?.instagramUsername;

  // Check connection status on mount and when returning from Instagram auth
  useEffect(() => {
    const checkConnectionOnReturn = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("connected") === "true" && ayrshareProfileKey) {
        // User just returned from Instagram auth
        await checkConnectionStatus();
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    };

    checkConnectionOnReturn();
  }, [ayrshareProfileKey]);

  // Auto-sync profile image when Instagram gets connected
  useEffect(() => {
    const autoSyncProfileImage = async () => {
      if (instagramConnected && ayrshareProfileKey && !userProfile?.profileImageStorageId) {
        // Instagram is connected but no profile image yet - auto sync
        await handleSyncProfileImage();
      }
    };

    autoSyncProfileImage();
  }, [instagramConnected, ayrshareProfileKey, userProfile?.profileImageStorageId]);

  const checkConnectionStatus = useCallback(async () => {
    if (!ayrshareProfileKey) return;

    setIsCheckingStatus(true);
    setError(null);

    try {
      const response = await fetch(`/api/ayrshare?profileKey=${ayrshareProfileKey}`);
      const data = await response.json();

      if (data.success && data.instagramConnected) {
        await updateInstagramConnection({
          userId,
          instagramConnected: true,
          instagramUsername: data.instagramUsername || undefined,
        });
        setSuccessMessage("Instagram connected successfully!");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error checking connection status:", err);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [ayrshareProfileKey, userId, updateInstagramConnection]);

  const handleCreateProfileAndConnect = async () => {
    setError(null);

    try {
      let profileKey = ayrshareProfileKey;

      // Step 1: Create Ayrshare profile if not exists
      if (!profileKey) {
        setIsCreatingProfile(true);

        const createResponse = await fetch("/api/ayrshare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create-profile",
            userId,
          }),
        });

        const createData = await createResponse.json();

        if (!createData.success) {
          throw new Error(createData.error || "Failed to create Ayrshare profile");
        }

        profileKey = createData.profileKey;

        // Save profile key to Convex
        await saveAyrshareProfileKey({
          userId,
          ayrshareProfileKey: profileKey,
        });

        setIsCreatingProfile(false);
      }

      // Step 2: Get connect URL and redirect
      setIsConnecting(true);

      const connectResponse = await fetch("/api/ayrshare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect-url",
          profileKey,
          redirectUrl: `${window.location.origin}/profile?connected=true`,
        }),
      });

      const connectData = await connectResponse.json();

      if (!connectData.success) {
        throw new Error(connectData.error || "Failed to get connect URL");
      }

      // Open Ayrshare in new tab (user stays on profile page)
      window.open(connectData.url, '_blank');

      setSuccessMessage("Connect your Instagram in the new tab, then click 'Refresh Status' when done");
      setIsConnecting(false);
    } catch (err) {
      console.error("Error connecting Instagram:", err);
      setError(err instanceof Error ? err.message : "Failed to connect Instagram");
      setIsCreatingProfile(false);
      setIsConnecting(false);
    }
  };

  const handleSyncProfileImage = async () => {
    if (!ayrshareProfileKey) return;

    setIsSyncing(true);
    setError(null);

    try {
      // Get Instagram profile image URL
      const response = await fetch("/api/ayrshare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-profile-image",
          profileKey: ayrshareProfileKey,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to get Instagram profile image");
      }

      if (data.profilePictureUrl) {
        // Download the image and upload to Convex storage
        const imageResponse = await fetch(data.profilePictureUrl);
        const imageBlob = await imageResponse.blob();

        // Get upload URL
        const uploadUrl = await generateUploadUrl();

        // Upload to Convex
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": imageBlob.type || "image/jpeg",
          },
          body: imageBlob,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image to storage");
        }

        const { storageId } = await uploadResponse.json();

        // Update profile with new image
        await updateProfileImage({
          userId,
          profileImageStorageId: storageId,
        });

        onProfileImageSync?.(data.profilePictureUrl);
        setSuccessMessage("Profile photo synced from Instagram!");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error syncing profile image:", err);
      setError(err instanceof Error ? err.message : "Failed to sync profile image");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    // For now, just clear the connection status locally
    // Full disconnect would require Ayrshare API call
    try {
      await updateInstagramConnection({
        userId,
        instagramConnected: false,
        instagramUsername: undefined,
      });
      setSuccessMessage("Instagram disconnected");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error disconnecting:", err);
      setError("Failed to disconnect Instagram");
    }
  };

  const isLoading = isCreatingProfile || isConnecting || isCheckingStatus;

  return (
    <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4">
          {/* Instagram Icon */}
          <div className="p-3 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500">
            <Instagram className="h-8 w-8 text-white" />
          </div>

          {/* Status display */}
          {instagramConnected ? (
            <>
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              {instagramUsername && (
                <p className="text-sm text-gray-600">@{instagramUsername}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600 text-center">
              Connect your Instagram to sync your profile photo
            </p>
          )}

          {/* Success message */}
          {successMessage && (
            <p className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
              {successMessage}
            </p>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500 text-center bg-red-50 px-3 py-1 rounded">
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {!instagramConnected ? (
              <>
                <Button
                  onClick={handleCreateProfileAndConnect}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 hover:from-pink-600 hover:via-purple-600 hover:to-orange-600 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isCreatingProfile ? "Setting up..." : "Connecting..."}
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Connect Instagram
                    </>
                  )}
                </Button>

                {/* Show refresh button if profile key exists (user may have connected in new tab) */}
                {ayrshareProfileKey && (
                  <Button
                    onClick={checkConnectionStatus}
                    disabled={isCheckingStatus}
                    variant="outline"
                    className="w-full border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    {isCheckingStatus ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                      </>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={handleSyncProfileImage}
                  disabled={isSyncing}
                  variant="outline"
                  className="w-full border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Profile Photo
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleDisconnect}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-red-500"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </>
            )}
          </div>

          {/* Note about Instagram requirements */}
          {!instagramConnected && (
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Requires an Instagram Business or Creator account
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
