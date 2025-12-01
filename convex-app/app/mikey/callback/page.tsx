"use client";

import { useEffect } from "react";
import { Loader2, CheckCircle } from "lucide-react";

/**
 * Ayrshare Connection Callback Page
 * This page is shown after user connects Instagram via Ayrshare
 * It automatically closes the tab and refreshes the parent window
 */
export default function MikeyCallbackPage() {
  useEffect(() => {
    // Close this tab after a short delay
    const timer = setTimeout(() => {
      // Try to close the window
      window.close();

      // If window.close() doesn't work (some browsers block it),
      // redirect back to Mikey dashboard
      setTimeout(() => {
        window.location.href = "/mikey?success=account_added";
      }, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Instagram Account Connected!</h1>
        <p className="text-gray-600 mb-4">
          Your Instagram account has been successfully connected to Mikey.
        </p>
        <p className="text-sm text-gray-500">
          This window will close automatically...
        </p>
      </div>
    </div>
  );
}
