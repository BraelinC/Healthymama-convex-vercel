"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Instagram, Users, Pause, Play, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccountCardProps {
  account: {
    _id: Id<"instagramAccounts">;
    username: string;
    status: "active" | "inactive" | "full";
    currentUserCount: number;
    maxUsers: number;
    createdAt: number;
  };
}

export function AccountCard({ account }: AccountCardProps) {
  const { toast } = useToast();
  const updateStatus = useMutation(api.mikey.mutations.updateAccountStatus);
  const deleteAccount = useMutation(api.mikey.mutations.deleteInstagramAccount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "full":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = account.status === "active" ? "inactive" : "active";
    try {
      await updateStatus({
        accountId: account._id,
        status: newStatus,
      });
      toast({
        title: "Status updated",
        description: `Account is now ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete @${account.username}? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteAccount({ accountId: account._id });
      toast({
        title: "Account deleted",
        description: `@${account.username} has been removed`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const percentFull = Math.round((account.currentUserCount / account.maxUsers) * 100);

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-50 rounded-lg">
            <Instagram className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">@{account.username}</h3>
            <Badge className={getStatusColor(account.status)}>{account.status}</Badge>
          </div>
        </div>
      </div>

      {/* Capacity */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600 flex items-center gap-1">
            <Users className="w-4 h-4" />
            Capacity
          </span>
          <span className="font-medium text-gray-900">
            {account.currentUserCount} / {account.maxUsers}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              percentFull >= 90 ? "bg-red-500" : percentFull >= 70 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${percentFull}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{percentFull}% full</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleStatus}
          className="flex-1 flex items-center justify-center gap-2"
        >
          {account.status === "active" ? (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Activate
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Metadata */}
      <p className="text-xs text-gray-500 mt-4">
        Added {new Date(account.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}
