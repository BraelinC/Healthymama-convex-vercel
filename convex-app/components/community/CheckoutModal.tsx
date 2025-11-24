"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: Id<"communities">;
  communityName: string;
  monthlyPrice?: number; // Price in cents
  yearlyPrice?: number;
  lifetimePrice?: number;
  successUrl?: string; // Optional custom success URL
  cancelUrl?: string; // Optional custom cancel URL
}

export function CheckoutModal({
  open,
  onOpenChange,
  communityId,
  communityName,
  monthlyPrice,
  yearlyPrice,
  lifetimePrice,
  successUrl,
  cancelUrl,
}: CheckoutModalProps) {
  const { user } = useUser();
  const createCheckout = useAction(api.stripe.actions.createCheckoutSession);

  const [selectedTier, setSelectedTier] = useState<"monthly" | "yearly" | "lifetime" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!user?.id || !selectedTier) {
      setError("Please select a pricing tier");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await createCheckout({
        userId: user.id,
        communityId,
        tier: selectedTier,
        successUrl: successUrl || `${window.location.origin}/community/${communityId}?checkout=success`,
        cancelUrl: cancelUrl || `${window.location.origin}/community/${communityId}?checkout=cancel`,
      });

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      setError(err.message || "Failed to create checkout session");
      setIsLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const calculateYearlySavings = () => {
    if (!monthlyPrice || !yearlyPrice) return 0;
    const yearlyAsMonthly = monthlyPrice * 12;
    const savings = ((yearlyAsMonthly - yearlyPrice) / yearlyAsMonthly) * 100;
    return Math.round(savings);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Join {communityName}</DialogTitle>
          <DialogDescription>
            Select a pricing plan to get started
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Monthly Option */}
          {monthlyPrice && (
            <div
              onClick={() => setSelectedTier("monthly")}
              className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                selectedTier === "monthly"
                  ? "border-healthymama-logo-pink bg-pink-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Monthly</h3>
                  <p className="text-sm text-gray-600">Pay month-to-month, cancel anytime</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${formatPrice(monthlyPrice)}</p>
                  <p className="text-sm text-gray-500">/month</p>
                </div>
              </div>
              {selectedTier === "monthly" && (
                <div className="absolute top-3 right-3">
                  <div className="bg-healthymama-logo-pink rounded-full p-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Yearly Option */}
          {yearlyPrice && (
            <div
              onClick={() => setSelectedTier("yearly")}
              className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                selectedTier === "yearly"
                  ? "border-healthymama-logo-pink bg-pink-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {monthlyPrice && calculateYearlySavings() > 0 && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Save {calculateYearlySavings()}%
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Yearly</h3>
                  <p className="text-sm text-gray-600">Best value - pay annually</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${formatPrice(yearlyPrice)}</p>
                  <p className="text-sm text-gray-500">/year</p>
                  {monthlyPrice && (
                    <p className="text-xs text-gray-400">
                      ${formatPrice(Math.round(yearlyPrice / 12))}/mo
                    </p>
                  )}
                </div>
              </div>
              {selectedTier === "yearly" && (
                <div className="absolute top-3 right-3">
                  <div className="bg-healthymama-logo-pink rounded-full p-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lifetime Option */}
          {lifetimePrice && (
            <div
              onClick={() => setSelectedTier("lifetime")}
              className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                selectedTier === "lifetime"
                  ? "border-healthymama-logo-pink bg-pink-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <span className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Lifetime Access
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Lifetime</h3>
                  <p className="text-sm text-gray-600">One-time payment, access forever</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${formatPrice(lifetimePrice)}</p>
                  <p className="text-sm text-gray-500">one-time</p>
                </div>
              </div>
              {selectedTier === "lifetime" && (
                <div className="absolute top-3 right-3">
                  <div className="bg-healthymama-logo-pink rounded-full p-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            <p className="font-semibold text-sm mb-1">Unable to process checkout</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCheckout}
            disabled={!selectedTier || isLoading}
            className="flex-1 bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Continue to Payment"
            )}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Secure payment powered by Stripe
        </p>
      </DialogContent>
    </Dialog>
  );
}
