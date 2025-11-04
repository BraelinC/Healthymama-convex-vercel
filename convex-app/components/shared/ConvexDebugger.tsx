"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Eye, EyeOff } from "lucide-react";

export default function ConvexDebugger() {
  const [isVisible, setIsVisible] = useState(true);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const { user, isLoaded, isSignedIn } = useUser();

  // Listen for WebSocket events (simulated for now)
  useEffect(() => {
    // Check if WebSocket connection exists
    const checkWebSocket = () => {
      // Try to detect WebSocket connection status from window
      const wsConnected = typeof window !== "undefined" &&
        (window as any).__convexWebSocketConnected;

      if (wsConnected) {
        setWsStatus("connected");
      } else {
        setWsStatus("disconnected");
      }
    };

    const interval = setInterval(checkWebSocket, 2000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut to toggle visibility (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 z-50"
        size="sm"
      >
        <Eye className="w-4 h-4 mr-2" />
        Show Debug
      </Button>
    );
  }

  const envVars = {
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
    clerkKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 bg-gray-900 border-purple-600 border-2 z-50 shadow-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            🔍 Convex Debug Panel
          </CardTitle>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
          >
            <EyeOff className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Environment Variables */}
        <div>
          <p className="text-gray-400 font-semibold mb-1">Environment:</p>
          <div className="space-y-1 bg-gray-800 p-2 rounded">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Convex URL:</span>
              {envVars.convexUrl ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Clerk Key:</span>
              {envVars.clerkKey ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
            {envVars.convexUrl && (
              <p className="text-gray-500 text-xs truncate mt-1">
                {envVars.convexUrl}
              </p>
            )}
          </div>
        </div>

        {/* Clerk Authentication */}
        <div>
          <p className="text-gray-400 font-semibold mb-1">Clerk Auth:</p>
          <div className="space-y-1 bg-gray-800 p-2 rounded">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">isLoaded:</span>
              <Badge className={isLoaded ? "bg-green-600" : "bg-gray-600"}>
                {isLoaded ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">isSignedIn:</span>
              <Badge className={isSignedIn ? "bg-green-600" : "bg-red-600"}>
                {isSignedIn ? "Yes" : "No"}
              </Badge>
            </div>
            {isSignedIn && user && (
              <div className="mt-1 pt-1 border-t border-gray-700">
                <p className="text-gray-500">User ID: {user.id.substring(0, 20)}...</p>
                <p className="text-gray-500">
                  Email: {user.emailAddresses[0]?.emailAddress || "N/A"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* WebSocket Status */}
        <div>
          <p className="text-gray-400 font-semibold mb-1">WebSocket:</p>
          <div className="bg-gray-800 p-2 rounded">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Status:</span>
              {wsStatus === "connecting" && (
                <Badge className="bg-yellow-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Connecting
                </Badge>
              )}
              {wsStatus === "connected" && (
                <Badge className="bg-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </Badge>
              )}
              {wsStatus === "disconnected" && (
                <Badge className="bg-red-600 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Disconnected
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-800 p-2 rounded text-xs text-gray-400">
          <p>💡 Press <kbd className="bg-gray-700 px-1 rounded">Ctrl+Shift+D</kbd> to toggle</p>
          <p className="mt-1">Check browser console for detailed logs</p>
        </div>
      </CardContent>
    </Card>
  );
}
