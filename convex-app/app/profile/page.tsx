"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, ArrowLeft, AtSign, Check, X, Loader2 } from "lucide-react";
import { ProfileImageUploader } from "@/components/profile/ProfileImageUploader";
import { InstagramConnect } from "@/components/profile/InstagramConnect";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id || "";
  const router = useRouter();
  const { toast } = useToast();

  // Profile name state
  const [profileName, setProfileName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const userProfile = useQuery(
    api.userProfile.getUserProfileWithImage,
    userId ? { userId } : "skip"
  );

  // Check if profile name is available
  const isNameAvailable = useQuery(
    api.userProfile.checkProfileNameAvailable,
    userId && profileName.length >= 3
      ? { uniqueProfileName: profileName, currentUserId: userId }
      : "skip"
  );

  const updateProfileName = useMutation(api.userProfile.updateUniqueProfileName);

  // Initialize profile name from existing data
  useEffect(() => {
    if (userProfile?.uniqueProfileName) {
      setProfileName(userProfile.uniqueProfileName);
    }
  }, [userProfile?.uniqueProfileName]);

  // Track changes
  useEffect(() => {
    const originalName = userProfile?.uniqueProfileName || "";
    setHasChanges(profileName !== originalName && profileName.length >= 3);
  }, [profileName, userProfile?.uniqueProfileName]);

  // Validate profile name format
  const isValidFormat = /^[a-zA-Z0-9_]{3,20}$/.test(profileName);
  const showValidation = profileName.length > 0;

  const handleSaveProfileName = async () => {
    if (!userId || !isValidFormat || !isNameAvailable) return;

    setIsSaving(true);
    try {
      await updateProfileName({ userId, uniqueProfileName: profileName });
      toast({
        title: "Profile name saved!",
        description: `Your unique profile name is now @${profileName.toLowerCase()}`,
      });
      setHasChanges(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save profile name",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const userName = user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress?.split("@")[0] || "User";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50">
      <div className="container mx-auto p-4 max-w-xl">
        {/* Header with back button */}
        <div className="flex items-center mb-8 pt-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div className="flex-1 text-center pr-10">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">
              Your Profile
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile Image Upload Card */}
          <Card className="rounded-3xl border border-purple-100/70 bg-gradient-to-br from-white via-purple-50/80 to-emerald-50/80 shadow-2xl shadow-purple-200/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-center gap-2 text-purple-600">
                <User className="h-5 w-5 text-purple-500" />
                Profile Photo
              </CardTitle>
            </CardHeader>
            <CardContent className="py-8">
              <ProfileImageUploader
                userId={userId}
                currentImageUrl={userProfile?.profileImageUrl || null}
                userName={userName}
                onImageUpdated={() => {
                  // The query will auto-refetch due to Convex reactivity
                }}
              />
            </CardContent>
          </Card>

          {/* Unique Profile Name Card */}
          <Card className="rounded-3xl border border-purple-100/70 bg-gradient-to-br from-white via-purple-50/80 to-emerald-50/80 shadow-2xl shadow-purple-200/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-center gap-2 text-purple-600">
                <AtSign className="h-5 w-5 text-purple-500" />
                Unique Profile Name
              </CardTitle>
            </CardHeader>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500 text-center mb-4">
                Set a unique name so friends can find you
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                  <Input
                    type="text"
                    placeholder="your_unique_name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    className="pl-8 pr-10"
                    maxLength={20}
                  />
                  {showValidation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidFormat && isNameAvailable ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <X className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>

                {/* Validation messages */}
                {showValidation && (
                  <div className="text-xs space-y-1">
                    {profileName.length < 3 && (
                      <p className="text-amber-600">Must be at least 3 characters</p>
                    )}
                    {profileName.length > 20 && (
                      <p className="text-red-500">Must be 20 characters or less</p>
                    )}
                    {isValidFormat && isNameAvailable === false && (
                      <p className="text-red-500">This name is already taken</p>
                    )}
                    {isValidFormat && isNameAvailable === true && (
                      <p className="text-green-600">This name is available!</p>
                    )}
                  </div>
                )}

                {/* Save button */}
                {hasChanges && isValidFormat && isNameAvailable && (
                  <Button
                    onClick={handleSaveProfileName}
                    disabled={isSaving}
                    className="w-full bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Profile Name"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent"></div>
            <span className="text-sm text-gray-400">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent"></div>
          </div>

          {/* Instagram Connect Card */}
          <InstagramConnect
            userId={userId}
            onProfileImageSync={() => {
              // The query will auto-refetch due to Convex reactivity
            }}
          />
        </div>
      </div>
    </div>
  );
}
