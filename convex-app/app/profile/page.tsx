"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, ArrowLeft } from "lucide-react";
import { ProfileImageUploader } from "@/components/profile/ProfileImageUploader";
import { InstagramConnect } from "@/components/profile/InstagramConnect";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id || "";
  const router = useRouter();

  const userProfile = useQuery(
    api.userProfile.getUserProfileWithImage,
    userId ? { userId } : "skip"
  );

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
