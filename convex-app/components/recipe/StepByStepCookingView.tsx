"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MuxPlayer from "@mux/mux-player-react";
import type MuxPlayerElement from "@mux/mux-player";

interface VideoSegment {
  stepNumber: number;
  instruction: string;
  startTime: number;
  endTime: number;
}

interface StepByStepCookingViewProps {
  muxPlaybackId: string;
  instructions: string[];
  videoSegments?: VideoSegment[];
  onClose: () => void;
}

/**
 * Step-by-Step Cooking Mode Component
 *
 * Displays recipe instructions one at a time with synchronized video clips.
 * Uses Mux Instant Clipping to show the exact video segment for each step.
 *
 * Features:
 * - Video clips automatically play for current step
 * - Video auto-pauses when segment ends (user must click "Next" to continue)
 * - Seeking restricted to current segment only (can't skip ahead)
 * - Step counter shows progress (e.g., "2 of 6")
 * - Previous/Next navigation
 * - Keyboard shortcuts (← → arrows, Escape to exit)
 * - Falls back to full video if no segments available
 *
 * Playback Restrictions (for step-by-step learning):
 * - Cannot seek past end of current segment
 * - Cannot seek before start of current segment
 * - Video resets to segment start when reaching end
 * - Forces users to complete each step before advancing
 *
 * Props:
 * @param muxPlaybackId - Mux video playback ID
 * @param instructions - Array of instruction strings
 * @param videoSegments - AI-analyzed timestamps for each step (optional)
 * @param onClose - Callback to exit cooking mode
 */
export function StepByStepCookingView({
  muxPlaybackId,
  instructions,
  videoSegments,
  onClose,
}: StepByStepCookingViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const playerRef = useRef<MuxPlayerElement>(null);

  // Generate Mux instant clip URL for current step
  const getVideoUrl = (stepIndex: number): string => {
    const baseUrl = `https://stream.mux.com/${muxPlaybackId}.m3u8`;

    // If we have video segments, use Mux instant clipping
    if (videoSegments && videoSegments[stepIndex]) {
      const segment = videoSegments[stepIndex];
      return `${baseUrl}?asset_start_time=${segment.startTime}&asset_end_time=${segment.endTime}`;
    }

    // Fallback: show full video
    return baseUrl;
  };

  // Restrict video playback to current segment only
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoSegments || !videoSegments[currentStep]) return;

    const segment = videoSegments[currentStep];
    const { startTime, endTime } = segment;

    // Handle timeupdate: pause when reaching end of segment
    const handleTimeUpdate = () => {
      const currentTime = player.currentTime || 0;

      // If user seeks past the end, snap back to start
      if (currentTime > endTime) {
        player.currentTime = startTime;
        player.pause();
      }

      // If user seeks before the start, snap to start
      if (currentTime < startTime) {
        player.currentTime = startTime;
      }

      // Auto-pause when reaching end of segment
      if (currentTime >= endTime - 0.1) { // 0.1s buffer for smoother UX
        player.currentTime = startTime; // Reset to start
        player.pause();
      }
    };

    // Handle seeking: prevent seeking outside the segment
    const handleSeeking = () => {
      const currentTime = player.currentTime || 0;

      if (currentTime < startTime) {
        player.currentTime = startTime;
      } else if (currentTime > endTime) {
        player.currentTime = endTime;
      }
    };

    player.addEventListener('timeupdate', handleTimeUpdate);
    player.addEventListener('seeking', handleSeeking);

    return () => {
      player.removeEventListener('timeupdate', handleTimeUpdate);
      player.removeEventListener('seeking', handleSeeking);
    };
  }, [currentStep, videoSegments]);

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStep < instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goToNextStep();
      if (e.key === "ArrowLeft") goToPreviousStep();
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentStep, instructions.length]);

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header: Step Counter */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          ← Back
        </Button>

        <div className="text-2xl font-bold">
          {currentStep + 1} of {instructions.length}
        </div>

        <div className="w-16" /> {/* Spacer for alignment */}
      </div>

      {/* Video Player */}
      <div className="flex-1 flex items-center justify-center bg-black">
        <MuxPlayer
          ref={playerRef}
          key={`step-${currentStep}`} // Force re-render on step change
          playbackId={muxPlaybackId}
          streamType="on-demand"
          autoPlay
          loop={false} // Don't loop - pause at end of segment
          playsInline
          muted={false}
          style={{
            width: "100%",
            height: "100%",
            maxHeight: "70vh",
          }}
          // Use Mux instant clipping via startTime
          startTime={videoSegments?.[currentStep]?.startTime}
          src={getVideoUrl(currentStep)}
        />
      </div>

      {/* Footer: Instruction + Navigation */}
      <div className="px-6 py-8 bg-gradient-to-t from-black to-transparent">
        {/* Instruction Text */}
        <div className="mb-6 text-center">
          <p className="text-lg leading-relaxed max-w-2xl mx-auto">
            {instructions[currentStep]}
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={goToPreviousStep}
            disabled={currentStep === 0}
            variant="secondary"
            size="lg"
            className="min-w-[120px]"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Previous
          </Button>

          {currentStep === instructions.length - 1 ? (
            <Button
              onClick={onClose}
              size="lg"
              className="min-w-[120px] bg-green-600 hover:bg-green-700"
            >
              Finish
            </Button>
          ) : (
            <Button
              onClick={goToNextStep}
              size="lg"
              className="min-w-[120px] bg-gradient-to-br from-[#dc2626] to-[#ec4899] hover:shadow-red-glow"
            >
              Next
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {instructions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? "w-8 bg-white"
                  : "w-2 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
