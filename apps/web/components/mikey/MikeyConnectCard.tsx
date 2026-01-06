"use client";

import { useQuery } from "convex/react";
import { api } from "@healthymama/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Instagram, MessageCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MikeyConnectCardProps {
  userId: string;
}

export function MikeyConnectCard({ userId }: MikeyConnectCardProps) {
  const { toast } = useToast();

  // Use hardcoded username
  const instagramUsername = "healthymama1.0";

  const handleOpenInstagramDM = async () => {
    // Copy username to clipboard
    try {
      await navigator.clipboard.writeText(instagramUsername);
      toast({
        title: "Username copied!",
        description: `@${instagramUsername} copied to clipboard`,
        duration: 2000,
      });
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }

    // Detect if mobile or desktop
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Mobile: Try to open Instagram app
      window.location.href = `instagram://user?username=${instagramUsername}`;

      // Fallback to Instagram mobile web after short delay
      setTimeout(() => {
        window.open(`https://www.instagram.com/${instagramUsername}`, '_blank');
      }, 500);
    } else {
      // Desktop: Open Instagram web
      window.open(`https://www.instagram.com/${instagramUsername}`, '_blank');
    }
  };

  return (
    <Card className="rounded-3xl border border-purple-100/70 bg-gradient-to-br from-white via-pink-50/80 to-purple-50/80 shadow-2xl shadow-purple-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-center gap-2 text-purple-600">
          <Instagram className="h-6 w-6 text-pink-500" />
          Get Recipes from Reels
        </CardTitle>
      </CardHeader>
      <CardContent className="py-6 space-y-4">
        {/* Instagram Account Display */}
        <div className="flex items-center justify-center gap-3 p-4 bg-white/80 rounded-2xl border border-purple-100">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 flex items-center justify-center ring-4 ring-white shadow-lg">
            <Instagram className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Send a message to</p>
            <p className="text-lg font-bold text-gray-900">@{instagramUsername}</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
              1
            </div>
            <p className="text-sm text-gray-700">
              Send a message on Instagram to start the conversation
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
              2
            </div>
            <p className="text-sm text-gray-700">
              Share any Instagram reel with a recipe
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
              3
            </div>
            <p className="text-sm text-gray-700">
              Get a link to the recipe on HealthyMama instantly!
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleOpenInstagramDM}
          className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 hover:from-pink-600 hover:via-purple-600 hover:to-orange-600 text-white h-12 text-base font-semibold rounded-2xl shadow-lg"
        >
          <Send className="h-5 w-5 mr-2" />
          Message @{instagramUsername}
        </Button>
      </CardContent>
    </Card>
  );
}
