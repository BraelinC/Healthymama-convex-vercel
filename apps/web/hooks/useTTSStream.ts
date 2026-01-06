import { useRef, useCallback, useState } from "react";

interface TTSStreamOptions {
  voiceId: string;
  apiKey: string;
  modelId?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
}

export function useTTSStream(options: TTSStreamOptions) {
  const {
    voiceId,
    apiKey,
    modelId = "eleven_flash_v2_5",
    onStart,
    onEnd,
    onError,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize audio context
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 22050 });
    }
    return audioContextRef.current;
  }, []);

  // Play audio buffer from queue
  const playNextBuffer = useCallback(async () => {
    if (isPlayingRef.current) return;

    const buffer = audioQueueRef.current.shift();
    if (!buffer) {
      setIsSpeaking(false);
      onEnd?.();
      return;
    }

    const audioContext = getAudioContext();

    // Resume AudioContext if suspended (browsers auto-suspend until user interaction)
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
        console.log("[TTS] AudioContext resumed");
      } catch (err) {
        console.error("[TTS] Failed to resume AudioContext:", err);
      }
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    isPlayingRef.current = true;
    setIsSpeaking(true);

    source.onended = () => {
      isPlayingRef.current = false;
      playNextBuffer(); // Play next in queue
    };

    source.start();
  }, [getAudioContext, onEnd]);

  // Convert base64 PCM audio to AudioBuffer
  const decodeAudioChunk = useCallback(async (base64Audio: string) => {
    try {
      const audioContext = getAudioContext();

      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (PCM is 16-bit signed integers)
      const int16Array = new Int16Array(bytes.buffer);

      // Create AudioBuffer manually
      const audioBuffer = audioContext.createBuffer(
        1, // mono channel
        int16Array.length,
        22050 // sample rate matches output_format
      );

      // Convert Int16 to Float32 and copy to AudioBuffer
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16Array.length; i++) {
        // Normalize from Int16 range (-32768 to 32767) to Float32 range (-1.0 to 1.0)
        channelData[i] = int16Array[i] / 32768.0;
      }

      return audioBuffer;
    } catch (error) {
      console.error("[TTS] Failed to decode PCM audio chunk:", error);
      console.error("[TTS] Buffer size:", base64Audio.length, "base64 chars");
      return null;
    }
  }, [getAudioContext]);

  // Connect to TTS WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[TTS] Already connected");
      return;
    }

    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}&output_format=pcm_22050`;

    console.log("[TTS] Connecting to WebSocket... (v2 - with debug logs)");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[TTS] WebSocket connected");
      setIsConnected(true);

      // Send initial configuration (space character per official docs)
      const configMessage = {
        text: " ", // Space character required by ElevenLabs API spec
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290],
        },
        xi_api_key: apiKey, // API key in message body (browsers can't set WS headers)
      };
      console.log("[TTS] Sending initial config:", JSON.stringify(configMessage, null, 2));
      ws.send(JSON.stringify(configMessage));

      // Note: Keep-alive not needed for ElevenLabs WebSocket - connection stays open
    };

    let audioChunksReceived = 0;

    ws.onmessage = async (event) => {
      console.log("[TTS] ===== RAW MESSAGE RECEIVED =====");
      console.log("[TTS] Raw data:", event.data);

      try {
        const data = JSON.parse(event.data);
        console.log("[TTS] Parsed message:", JSON.stringify(data, null, 2));

        if (data.audio) {
          audioChunksReceived++;
          console.log("[TTS] ✓ Audio chunk #" + audioChunksReceived + ":", data.audio.length, "base64 chars");
          const audioBuffer = await decodeAudioChunk(data.audio);
          if (audioBuffer) {
            console.log("[TTS] ✓ Audio buffer created:", audioBuffer.duration.toFixed(2), "seconds");
            audioQueueRef.current.push(audioBuffer);
            playNextBuffer();
          } else {
            console.error("[TTS] ✗ Failed to create audio buffer from chunk");
          }
        }

        if (data.isFinal) {
          console.log("[TTS] Stream complete - isFinal received");
          console.log("[TTS] Sending EOS (empty string) to close stream");

          // Send end-of-stream signal to prevent timeout
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ text: "" }));
          }
        }

        if (data.error) {
          console.error("[TTS] ✗ ERROR from server:", data.error);
        }

        if (data.message) {
          console.log("[TTS] Server message:", data.message);
        }

        if (data.normalizedAlignment) {
          console.log("[TTS] Alignment:", data.normalizedAlignment);
        }
      } catch (error) {
        console.error("[TTS] ✗ Failed to parse WebSocket message:", error);
        console.error("[TTS] Raw data that failed:", event.data);
      }
    };

    ws.onerror = (error) => {
      console.error("[TTS] ===== WEBSOCKET ERROR =====");
      console.error("[TTS] Error:", error);
      console.error("[TTS] Error type:", error.type);
      console.error("[TTS] Error target:", error.target);
      setIsConnected(false);
      onError?.(new Error("TTS WebSocket error"));
    };

    ws.onclose = (event) => {
      console.log("[TTS] ===== WEBSOCKET CLOSED =====");
      console.log("[TTS] Close code:", event.code);
      console.log("[TTS] Close reason:", event.reason || "(no reason provided)");
      console.log("[TTS] Was clean:", event.wasClean);
      console.log("[TTS] Total audio chunks received:", audioChunksReceived);
      setIsConnected(false);
    };
  }, [voiceId, modelId, apiKey, decodeAudioChunk, playNextBuffer, onError]);

  // Speak text via TTS
  const speak = useCallback((text: string, voiceSettings?: VoiceSettings) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[TTS] WebSocket not connected");
      connect();
      // Wait for connection then retry
      setTimeout(() => speak(text, voiceSettings), 500);
      return;
    }

    const speakMessage = {
      text,
      voice_settings: voiceSettings || {
        stability: 0.5,
        similarity_boost: 0.8,
      },
      flush: true, // Force immediate generation
    };

    console.log("[TTS] Speaking:", text.substring(0, 50) + "...");
    console.log("[TTS] Speak message:", JSON.stringify(speakMessage, null, 2));
    onStart?.();

    wsRef.current.send(JSON.stringify(speakMessage));
  }, [connect, onStart]);

  // Stream text incrementally (for sentence-by-sentence streaming)
  const streamText = useCallback((text: string, options?: { flush?: boolean; voiceSettings?: VoiceSettings }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[TTS] WebSocket not connected for streaming");
      connect();
      setTimeout(() => streamText(text, options), 500);
      return;
    }

    const streamMessage = {
      text,
      voice_settings: options?.voiceSettings || {
        stability: 0.5,
        similarity_boost: 0.8,
      },
      flush: options?.flush ?? false, // Only flush on last chunk
    };

    console.log("[TTS] Streaming text chunk:", text.substring(0, 30) + "...");
    console.log("[TTS] Stream message:", JSON.stringify(streamMessage, null, 2));

    wsRef.current.send(JSON.stringify(streamMessage));
  }, [connect]);

  // Stop current speech and clear queue
  const stop = useCallback(() => {
    console.log("[TTS] Stopping speech");
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    stop();
  }, [stop]);

  return {
    connect,
    disconnect,
    speak,
    streamText,
    stop,
    isSpeaking,
    isConnected,
  };
}
