"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Agent state types
export type AgentState = "connecting" | "initializing" | "listening" | "speaking" | "thinking";
type AnimationState = AgentState | "idle";

// Audio analyser configuration
export interface AudioAnalyserOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
}

// Multi-band volume configuration
export interface MultiBandVolumeOptions extends AudioAnalyserOptions {
  bands?: number;
  loPass?: number;
  hiPass?: number;
  updateInterval?: number;
}

// Bar visualizer props
export interface BarVisualizerProps extends React.HTMLAttributes<HTMLDivElement> {
  state: AgentState;
  barCount?: number;
  mediaStream?: MediaStream | null;
  minHeight?: number;
  maxHeight?: number;
  demo?: boolean;
  centerAlign?: boolean;
}

/**
 * Hook: Get overall volume level from audio stream
 */
export function useAudioVolume(
  mediaStream: MediaStream | null,
  options: AudioAnalyserOptions = {}
): number {
  const [volume, setVolume] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!mediaStream) {
      setVolume(0);
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(mediaStream);

    analyser.fftSize = options.fftSize || 32;
    analyser.smoothingTimeConstant = options.smoothingTimeConstant ?? 0;
    analyser.minDecibels = options.minDecibels ?? -90;
    analyser.maxDecibels = options.maxDecibels ?? -10;

    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setVolume(average / 255);
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [mediaStream, options.fftSize, options.smoothingTimeConstant, options.minDecibels, options.maxDecibels]);

  return volume;
}

/**
 * Hook: Track volume across multiple frequency bands
 */
export function useMultibandVolume(
  mediaStream: MediaStream | null,
  options: MultiBandVolumeOptions = {}
): number[] {
  const [frequencyBands, setFrequencyBands] = useState<number[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const bands = options.bands || 15;
  const loPass = options.loPass || 100;
  const hiPass = options.hiPass || 8000;
  const updateInterval = options.updateInterval || 32;

  useEffect(() => {
    if (!mediaStream) {
      setFrequencyBands(Array(bands).fill(0));
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(mediaStream);

    analyser.fftSize = options.fftSize || 2048;
    analyser.smoothingTimeConstant = options.smoothingTimeConstant ?? 0.5;
    analyser.minDecibels = options.minDecibels ?? -90;
    analyser.maxDecibels = options.maxDecibels ?? -10;

    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const sampleRate = audioContext.sampleRate;
    const nyquist = sampleRate / 2;

    const updateBands = () => {
      analyser.getByteFrequencyData(dataArray);

      const bandValues: number[] = [];

      for (let i = 0; i < bands; i++) {
        // Logarithmic frequency distribution
        const freqStart = loPass * Math.pow(hiPass / loPass, i / bands);
        const freqEnd = loPass * Math.pow(hiPass / loPass, (i + 1) / bands);

        const binStart = Math.floor((freqStart / nyquist) * analyser.frequencyBinCount);
        const binEnd = Math.floor((freqEnd / nyquist) * analyser.frequencyBinCount);

        let sum = 0;
        for (let j = binStart; j < binEnd; j++) {
          sum += dataArray[j];
        }

        const average = sum / (binEnd - binStart) / 255;
        bandValues.push(average);
      }

      setFrequencyBands(bandValues);
    };

    intervalRef.current = setInterval(updateBands, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [mediaStream, bands, loPass, hiPass, updateInterval, options.fftSize, options.smoothingTimeConstant, options.minDecibels, options.maxDecibels]);

  return frequencyBands.length > 0 ? frequencyBands : Array(bands).fill(0);
}

/**
 * Hook: Create animation sequences for different states
 */
export function useBarAnimator(
  state: AnimationState,
  columns: number,
  interval: number = 100
): Set<number> {
  const [highlightedIndices, setHighlightedIndices] = useState<Set<number>>(new Set());
  const animationRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (state === "idle") {
      setHighlightedIndices(new Set());
      return;
    }

    let currentIndex = 0;

    const animate = () => {
      if (state === "connecting") {
        // Wave animation: sweep left to right
        setHighlightedIndices(new Set([currentIndex % columns]));
        currentIndex++;
      } else if (state === "initializing") {
        // Pulse animation: random bars
        const randomBars = new Set<number>();
        for (let i = 0; i < Math.floor(columns / 3); i++) {
          randomBars.add(Math.floor(Math.random() * columns));
        }
        setHighlightedIndices(randomBars);
      } else if (state === "thinking") {
        // Breathing animation: expand from center
        const center = Math.floor(columns / 2);
        const radius = (currentIndex % 5) + 1;
        const bars = new Set<number>();
        for (let i = center - radius; i <= center + radius; i++) {
          if (i >= 0 && i < columns) bars.add(i);
        }
        setHighlightedIndices(bars);
        currentIndex++;
      }
    };

    animationRef.current = setInterval(animate, interval);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [state, columns, interval]);

  return highlightedIndices;
}

/**
 * Main Bar Visualizer Component
 */
export function BarVisualizer({
  state,
  barCount = 15,
  mediaStream = null,
  minHeight = 20,
  maxHeight = 100,
  demo = false,
  centerAlign = false,
  className,
  ...props
}: BarVisualizerProps) {
  const [demoValues, setDemoValues] = useState<number[]>(Array(barCount).fill(0));

  // Get real audio data if mediaStream is provided
  const frequencyBands = useMultibandVolume(mediaStream, {
    bands: barCount,
    updateInterval: 32,
  });

  // Get animation highlights for states without audio
  const highlightedIndices = useBarAnimator(
    state === "listening" || state === "speaking" ? "idle" : state,
    barCount,
    100
  );

  // Demo mode: generate fake audio data
  useEffect(() => {
    if (!demo) return;

    const interval = setInterval(() => {
      setDemoValues(Array.from({ length: barCount }, () => Math.random()));
    }, 50);

    return () => clearInterval(interval);
  }, [demo, barCount]);

  // Determine bar heights based on state
  const getBarHeight = (index: number): number => {
    if (demo) {
      return minHeight + demoValues[index] * (maxHeight - minHeight);
    }

    if (state === "listening" || state === "speaking") {
      // Use real audio data
      return minHeight + frequencyBands[index] * (maxHeight - minHeight);
    }

    // Use animation highlights for other states
    if (highlightedIndices.has(index)) {
      return maxHeight * 0.7;
    }

    return minHeight;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        centerAlign ? "items-center justify-center" : "items-end",
        className
      )}
      {...props}
    >
      {Array.from({ length: barCount }).map((_, index) => {
        const height = getBarHeight(index);

        return (
          <div
            key={index}
            className="flex-1 min-w-[2px] bg-primary rounded-full transition-all duration-100 ease-out"
            style={{
              height: `${height}%`,
              opacity: height > minHeight ? 1 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}
