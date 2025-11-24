"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConvexCommunityChat from "@/components/chat/ConvexCommunityChat";
import { VoiceInputView } from "@/components/chat/VoiceInputView";

interface AIChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIChatModal({ open, onOpenChange }: AIChatModalProps) {
  const { user } = useUser();
  const userId = user?.id || "";
  const communityId = "mn714r42da03y0xrdz87m3h6ts7tz302"; // Default community ID

  const [showVoiceView, setShowVoiceView] = useState(true);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);

  // Reset voice view when modal opens
  useEffect(() => {
    if (open) {
      setShowVoiceView(true);
      setInitialMessage(null);
    }
  }, [open]);

  const handleVoiceMessageSubmit = (message: string) => {
    console.log("[AI MODAL] Voice message submitted:", message);
    setInitialMessage(message);
    setShowVoiceView(false);
  };

  const handleBackToVoice = () => {
    setShowVoiceView(true);
    setInitialMessage(null);
  };

  if (!user || !userId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0" hideCloseButton={true}>
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <DialogTitle>AI Assistant</DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-muted-foreground">Please sign in to use AI chat</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0 gap-0" hideCloseButton={true}>
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!showVoiceView && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToVoice}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <span className="text-2xl">🤖</span>
              <DialogTitle>AI Assistant</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {showVoiceView ? (
            <VoiceInputView
              userId={userId}
              onMessageSubmit={handleVoiceMessageSubmit}
            />
          ) : (
            <ConvexCommunityChat userId={userId} communityId={communityId} />
          )}
        </div>

        {/* Show initial message hint */}
        {initialMessage && !showVoiceView && (
          <div className="px-6 py-2 bg-primary/10 border-t border-primary/20 text-sm text-center">
            <span className="text-muted-foreground">Suggested: </span>
            <span className="font-medium">{initialMessage}</span>
            <span className="text-muted-foreground"> - Type your message below</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
