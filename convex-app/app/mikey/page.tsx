"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { redirect } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsOverview } from "@/components/mikey/StatsOverview";
import { AccountCard } from "@/components/mikey/AccountCard";
import { RecentActivity } from "@/components/mikey/RecentActivity";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * Mikey Admin Dashboard
 * Hidden page for managing Instagram DM automation
 * Only accessible to users with isAdmin flag
 */
export default function MikeyPage() {
  const { user, isLoaded } = useUser();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const { toast } = useToast();

  // Get current user from Convex
  const currentUser = useQuery(
    api.users.queries.getUserById,
    user?.id ? { userId: user.id } : "skip"
  );

  // Get Instagram accounts
  const accounts = useQuery(api.mikey.queries.getAllInstagramAccounts);

  // Get dashboard stats
  const stats = useQuery(api.mikey.queries.getDashboardStats);

  // Get recent activity
  const recentActivity = useQuery(api.mikey.queries.getRecentActivity, { limit: 10 });

  // Check for success message in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success");

    if (success === "account_added") {
      toast({
        title: "Instagram Account Connected!",
        description: "Your Instagram account has been successfully added to Mikey.",
      });

      // Clean up URL
      window.history.replaceState({}, "", "/mikey");
    }
  }, [toast]);

  // Loading state
  if (!isLoaded || currentUser === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-healthymama-pink" />
      </div>
    );
  }

  // Access denied - not admin
  if (!currentUser?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <Button onClick={() => (window.location.href = "/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Handle cleanup - delete all accounts
  const handleCleanup = async () => {
    if (!confirm("Are you sure you want to delete ALL Instagram accounts and pending profiles? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("/api/mikey/arshare/cleanup", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to cleanup");
      }

      const data = await response.json();

      toast({
        title: "Cleanup Complete",
        description: data.message,
      });

      // Refresh page
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Cleanup error:", error);
      toast({
        title: "Cleanup Failed",
        description: "Failed to delete accounts. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle register webhook globally
  const handleRegisterWebhookGlobal = async () => {
    toast({
      title: "Registering Webhook...",
      description: "Registering webhook at account level for ALL Instagram accounts",
    });

    try {
      const response = await fetch("/api/mikey/register-webhook-global", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Registration failed");
      }

      const data = await response.json();

      toast({
        title: data.success ? "Webhook Registered!" : "Registration Failed",
        description: data.message || data.error,
        variant: data.success ? "default" : "destructive",
        duration: 7000,
      });
    } catch (error) {
      console.error("Register webhook error:", error);
      toast({
        title: "Registration Failed",
        description: "Failed to register webhook. Check console for details.",
        variant: "destructive",
      });
    }
  };

  // Handle test webhook
  const handleTestWebhook = async () => {
    toast({
      title: "Testing Webhook...",
      description: "Sending a test message to verify webhook configuration",
    });

    try {
      const response = await fetch("/api/mikey/test-webhook", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Test failed");
      }

      const data = await response.json();

      toast({
        title: "Webhook Test Result",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Test webhook error:", error);
      toast({
        title: "Test Failed",
        description: "Failed to test webhook. Check console for details.",
        variant: "destructive",
      });
    }
  };

  // Handle add account
  const handleAddAccount = async () => {
    console.log("[Frontend] === STARTING INSTAGRAM CONNECTION ===");

    // Show instructions
    toast({
      title: "Connecting Instagram Account",
      description: "A new window will open. You'll see the Ayrshare page - click the Instagram icon, then authorize when Instagram asks for permissions.",
      duration: 8000,
    });

    // Open Ayrshare connection in new tab
    const connectUrl = "/api/mikey/arshare/connect";
    console.log(`[Frontend] Opening connection window: ${connectUrl}`);
    const connectionWindow = window.open(connectUrl, "_blank");

    console.log(`[Frontend] Connection window opened: ${!!connectionWindow}`);

    // Poll for window closure and refresh accounts
    if (connectionWindow) {
      console.log("[Frontend] Starting poll interval to detect window closure");

      const pollInterval = setInterval(async () => {
        if (connectionWindow.closed) {
          console.log("[Frontend] === CONNECTION WINDOW CLOSED ===");
          clearInterval(pollInterval);

          // Show toast that we're fetching the account
          toast({
            title: "Fetching account...",
            description: "Please wait while Ayrshare updates your profile. This may take 10-15 seconds...",
            duration: 20000,
          });

          try {
            // Wait 5 seconds for Ayrshare to update their API
            console.log("[Frontend] Waiting 5 seconds for Ayrshare to update...");
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Get pending profile info
            console.log("[Frontend] === FETCHING PENDING PROFILE ===");
            const pendingResponse = await fetch("/api/mikey/arshare/get-pending");
            console.log(`[Frontend] Pending response status: ${pendingResponse.status} ${pendingResponse.statusText}`);

            if (!pendingResponse.ok) {
              throw new Error("Failed to get pending profile");
            }

            const pendingData = await pendingResponse.json();
            console.log("[Frontend] Pending profile data:", pendingData);
            console.log(`[Frontend] Profile Key: ${pendingData.profileKey}`);
            console.log(`[Frontend] Ref ID: ${pendingData.refId}`);

            // Retry logic - try up to 3 times with delays
            console.log("[Frontend] === STARTING REFRESH STATUS ATTEMPTS ===");
            let refreshData = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
              attempts++;
              console.log(`[Frontend] === ATTEMPT ${attempts}/${maxAttempts} ===`);

              // Call refresh status to fetch and save Instagram accounts
              console.log("[Frontend] Calling refresh-status endpoint...");
              const refreshResponse = await fetch("/api/mikey/arshare/refresh-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  profileKey: pendingData.profileKey,
                  refId: pendingData.refId,
                }),
              });

              console.log(`[Frontend] Refresh response status: ${refreshResponse.status} ${refreshResponse.statusText}`);

              if (!refreshResponse.ok) {
                throw new Error("Failed to refresh status");
              }

              refreshData = await refreshResponse.json();
              console.log("[Frontend] Refresh data received:", refreshData);

              // If we found accounts, break out
              if (refreshData.success && refreshData.accounts && refreshData.accounts.length > 0) {
                console.log(`[Frontend] SUCCESS! Found ${refreshData.accounts.length} account(s)`);
                console.log("[Frontend] Accounts:", refreshData.accounts);
                break;
              } else {
                console.log("[Frontend] No accounts found in this attempt");
                console.log("[Frontend] Response success:", refreshData.success);
                console.log("[Frontend] Response error:", refreshData.error);
                console.log("[Frontend] Response message:", refreshData.message);
              }

              // If this wasn't the last attempt, wait before retrying
              if (attempts < maxAttempts) {
                console.log(`[Frontend] Waiting 5 seconds before attempt ${attempts + 1}...`);
                toast({
                  title: `Attempt ${attempts}/${maxAttempts}`,
                  description: "Still waiting for Ayrshare to update... Retrying in 5 seconds...",
                  duration: 5000,
                });
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            }

            if (refreshData.success && refreshData.accounts && refreshData.accounts.length > 0) {
              console.log("[Frontend] === CONNECTION SUCCESSFUL ===");
              console.log(`[Frontend] Connected ${refreshData.accounts.length} account(s)`);

              toast({
                title: "Instagram Account Connected!",
                description: `Successfully connected ${refreshData.accounts.length} account(s)`,
              });

              // Refresh page to show new accounts
              console.log("[Frontend] Reloading page in 1.5 seconds...");
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else if (refreshData.success === false && refreshData.error === "No social accounts connected") {
              console.log("[Frontend] === CONNECTION FAILED - NO ACCOUNTS ===");
              console.log("[Frontend] Error:", refreshData.error);
              console.log("[Frontend] Message:", refreshData.message);

              toast({
                title: "No Instagram Account Connected",
                description: refreshData.message || "Please make sure you clicked 'Connect Instagram' and logged into your Instagram account in the popup.",
                variant: "destructive",
                duration: 10000,
              });
            } else {
              console.log("[Frontend] === UNKNOWN FAILURE STATE ===");
              console.log("[Frontend] Response data:", refreshData);

              toast({
                title: "No accounts found",
                description: "Please make sure you connected an Instagram account in the popup window.",
                variant: "destructive",
              });
            }
          } catch (error) {
            console.error("[Frontend] === ERROR OCCURRED ===");
            console.error("[Frontend] Error details:", error);

            toast({
              title: "Error",
              description: "Failed to fetch Instagram account. Please try again.",
              variant: "destructive",
            });
          }
        }
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mikey</h1>
              <p className="text-sm text-gray-600">Instagram DM Automation Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleRegisterWebhookGlobal} variant="default" className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                Register Webhook
              </Button>
              <Button onClick={handleTestWebhook} variant="outline" className="flex items-center gap-2">
                Test Webhook
              </Button>
              <Button onClick={handleCleanup} variant="outline" className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Delete All
              </Button>
              <Button onClick={handleAddAccount} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Instagram Account
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="mb-8">
          {stats ? (
            <StatsOverview stats={stats} />
          ) : (
            <div className="animate-pulse bg-white rounded-lg h-40" />
          )}
        </div>

        {/* Instagram Accounts */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Instagram Accounts</h2>
          {accounts === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-white rounded-lg h-48" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-600 mb-4">No Instagram accounts connected yet.</p>
              <Button onClick={handleAddAccount} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Account
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <AccountCard key={account._id} account={account} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {recentActivity === undefined ? (
            <div className="animate-pulse bg-white rounded-lg h-96" />
          ) : (
            <RecentActivity activity={recentActivity} />
          )}
        </div>
      </main>
    </div>
  );
}
