"use client";

import { useState, useEffect, cloneElement, isValidElement } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Users, MessageSquare } from "lucide-react";

interface ProfileDropdownMenuProps {
  children: React.ReactNode;
}

export function ProfileDropdownMenu({ children }: ProfileDropdownMenuProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/hydration, render just the children without Radix wrapper
  // to avoid ID mismatch issues
  if (!mounted) {
    // Clone the child and add a key to help React reconcile
    if (isValidElement(children)) {
      return cloneElement(children as React.ReactElement<any>, {
        "aria-haspopup": "menu",
        "aria-expanded": false,
      });
    }
    return <>{children}</>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => router.push("/profile")}
          className="cursor-pointer"
        >
          <User className="w-4 h-4 mr-2" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/social")}
          className="cursor-pointer"
        >
          <Users className="w-4 h-4 mr-2" />
          Social
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (typeof window !== 'undefined' && window.uj) {
              try {
                window.uj.showWidget();
              } catch (error) {
                console.error("Error opening UserJot widget:", error);
              }
            }
          }}
          className="cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Feedback
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
