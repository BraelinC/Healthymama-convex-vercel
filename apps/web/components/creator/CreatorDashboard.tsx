"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@healthymama/convex";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, TrendingUp, ExternalLink, Loader2, AlertCircle } from "lucide-react";

export function CreatorDashboard() {
  const { user } = useUser();
  const createConnectAccount = useAction(api.stripe.actions.createConnectAccount);

  // Get creator's Stripe account
  const creatorAccount = useQuery(
    api.stripe.queries.getCreatorAccount,
    user?.id ? { creatorId: user.id } : "skip"
  );

  // Get user's communities (assuming there's a query for this)
  // const communities = useQuery(api.communities.getByCreator, user?.id ? { creatorId: user.id } : "skip");

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectStripe = async () => {
    if (!user?.id || !user.emailAddresses[0]?.emailAddress) {
      setError("User email not found");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await createConnectAccount({
        creatorId: user.id,
        email: user.emailAddresses[0].emailAddress,
      });

      // Redirect to Stripe onboarding
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl;
      }
    } catch (err: any) {
      setError(err.message || "Failed to create Stripe account");
      setIsConnecting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Please sign in to view your creator dashboard</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Creator Dashboard</h1>
          <p className="text-gray-600">Manage your communities and earnings</p>
        </div>
      </div>

      {/* Stripe Connect Status */}
      <Card>
        <CardHeader>
          <CardTitle>Stripe Connect</CardTitle>
          <CardDescription>Manage your payment account</CardDescription>
        </CardHeader>
        <CardContent>
          {creatorAccount === undefined ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-gray-500">Loading account status...</span>
            </div>
          ) : !creatorAccount ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">Set up payments</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Connect your Stripe account to receive payments from your paid communities
                  </p>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              <Button
                onClick={handleConnectStripe}
                disabled={isConnecting}
                className="bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Stripe Account
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Account Status:</span>
                    <Badge
                      className={
                        creatorAccount.accountStatus === "active"
                          ? "bg-green-500"
                          : creatorAccount.accountStatus === "pending"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }
                    >
                      {creatorAccount.accountStatus}
                    </Badge>
                  </div>
                  {creatorAccount.accountStatus === "pending" && (
                    <p className="text-sm text-gray-500 mt-1">
                      Complete your onboarding to start receiving payments
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleConnectStripe}
                  variant="outline"
                  size="sm"
                  disabled={isConnecting}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {creatorAccount.accountStatus === "pending" ? "Complete Setup" : "Manage Account"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      creatorAccount.chargesEnabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-sm text-gray-600">Charges Enabled</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      creatorAccount.payoutsEnabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-sm text-gray-600">Payouts Enabled</span>
                </div>
              </div>

              {/* Platform Fee Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Platform Fee:</span>{" "}
                  {creatorAccount.feeType === "custom" && creatorAccount.customPlatformFeePercent
                    ? `${creatorAccount.customPlatformFeePercent}% (Custom)`
                    : "25% (Default)"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  You receive{" "}
                  {creatorAccount.feeType === "custom" && creatorAccount.customPlatformFeePercent
                    ? 100 - creatorAccount.customPlatformFeePercent
                    : 75}
                  % of subscription revenue
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-muted-foreground">All-time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-muted-foreground">Across all communities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Coming Soon</div>
            <p className="text-xs text-muted-foreground">New subscribers this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Help Text */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600">
            1. Connect your Stripe account to enable payments
          </p>
          <p className="text-sm text-gray-600">
            2. Create paid communities with monthly, yearly, or lifetime pricing
          </p>
          <p className="text-sm text-gray-600">
            3. Receive automatic payouts directly to your bank account
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
