"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Users, Shield, FileText } from "lucide-react";

interface ProfileDropdownMenuProps {
  children: React.ReactNode;
}

export function ProfileDropdownMenu({ children }: ProfileDropdownMenuProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render children without dropdown wrapper during SSR to avoid hydration mismatch
  if (!mounted) {
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

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push("/privacy")}
          className="cursor-pointer"
        >
          <Shield className="w-4 h-4 mr-2" />
          Privacy Policy
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/terms")}
          className="cursor-pointer"
        >
          <FileText className="w-4 h-4 mr-2" />
          Terms of Service
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
