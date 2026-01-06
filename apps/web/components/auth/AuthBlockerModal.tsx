"use client";

import { SignIn } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuthBlockerModalProps {
  isOpen: boolean;
}

export function AuthBlockerModal({ isOpen }: AuthBlockerModalProps) {
  return (
    <Dialog open={isOpen} modal>
      <DialogContent
        className="max-w-md bg-white border-none shadow-2xl"
        // Prevent closing by clicking outside
        onPointerDownOutside={(e) => e.preventDefault()}
        // Prevent closing with ESC key
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Hide the close button
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-healthymama-red to-healthymama-pink bg-clip-text text-transparent">
            Welcome to Healthy Mama
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            Sign in to access your personalized cookbook and meal plans
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-4">
          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none bg-transparent",
              }
            }}
            routing="hash"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
