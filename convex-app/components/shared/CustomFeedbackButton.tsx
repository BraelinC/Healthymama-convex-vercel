"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIChatModal } from "./AIChatModal";

export function CustomFeedbackButton() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [showFeedbackInitial, setShowFeedbackInitial] = useState(true);
  const [showDualButtons, setShowDualButtons] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  // Touch gesture tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    setIsMounted(true);

    // Show "Give feedback" for 1 second, then transition to AI bot
    const timer = setTimeout(() => {
      setIsExpanded(false);
      setShowFeedbackInitial(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleFeedbackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("[CustomFeedbackButton] Opening UserJot widget");

    if (typeof window !== 'undefined' && window.uj) {
      try {
        window.uj.showWidget();
        console.log("[CustomFeedbackButton] UserJot widget opened successfully");
      } catch (error) {
        console.error("[CustomFeedbackButton] Error opening widget:", error);
      }
    } else {
      console.error("[CustomFeedbackButton] UserJot SDK not loaded yet");
    }
  };

  const handleAIClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[CustomFeedbackButton] Opening AI Chat Modal");
    setShowAIModal(true);
  };

  // Touch event handlers for swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchStartX.current - touchEndX;
    const deltaY = Math.abs(touchStartY.current - touchEndY);

    // Swipe left detection (swipe distance > 50px and mostly horizontal)
    if (deltaX > 50 && deltaY < 30) {
      console.log("[CustomFeedbackButton] Swipe left detected");
      setShowDualButtons(true);
    }
    // Swipe right to collapse
    else if (deltaX < -50 && deltaY < 30) {
      console.log("[CustomFeedbackButton] Swipe right detected");
      setShowDualButtons(false);
    }
  };

  // Don't render on server
  if (!isMounted) return null;

  return (
    <>
      {/* Main Button Container */}
      <div
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[9999]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {showDualButtons ? (
          // Expanded state: Show both AI (top) and Feedback (bottom)
          <div className="flex flex-col gap-2">
            {/* AI Button (Cyan) */}
            <Button
              onClick={handleAIClick}
              className={cn(
                "transition-all duration-300 shadow-lg bg-cyan-500 hover:bg-cyan-600 text-white",
                "rounded-l-lg rounded-r-none px-4 py-3 gap-2"
              )}
              aria-label="Chat with AI"
            >
              <span className="text-2xl">🤖</span>
              <span className="text-sm font-medium whitespace-nowrap">AI Assistant</span>
            </Button>

            {/* Feedback Button (Pink) */}
            <Button
              onClick={handleFeedbackClick}
              className={cn(
                "transition-all duration-300 shadow-lg bg-pink-500 hover:bg-pink-600 text-white",
                "rounded-l-lg rounded-r-none px-4 py-3 gap-2"
              )}
              aria-label="Give feedback"
            >
              <span className="text-2xl">📝</span>
              <span className="text-sm font-medium whitespace-nowrap">Give feedback</span>
            </Button>
          </div>
        ) : (
          // Collapsed state: Show based on initial timer
          <Button
            onClick={showFeedbackInitial ? handleFeedbackClick : handleAIClick}
            className={cn(
              "transition-all duration-300 shadow-lg text-white",
              "rounded-l-lg rounded-r-none",
              showFeedbackInitial
                ? "bg-pink-500 hover:bg-pink-600"
                : "bg-cyan-500 hover:bg-cyan-600",
              isExpanded ? "px-4 py-3 gap-2" : "px-2 py-3 w-auto"
            )}
            aria-label={showFeedbackInitial ? "Give feedback" : "Chat with AI"}
          >
            {showFeedbackInitial ? (
              // Initial feedback state (first 1 second)
              isExpanded ? (
                <>
                  <span className="text-2xl">📝</span>
                  <span className="text-sm font-medium whitespace-nowrap">Give feedback</span>
                </>
              ) : (
                <span className="text-2xl leading-none">📝</span>
              )
            ) : (
              // Collapsed AI bot state (after 1 second)
              <span className="text-2xl leading-none">🤖</span>
            )}
          </Button>
        )}
      </div>

      {/* AI Chat Modal */}
      <AIChatModal open={showAIModal} onOpenChange={setShowAIModal} />
    </>
  );
}
