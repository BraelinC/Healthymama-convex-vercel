"use client";

import { MessageSquare, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ActivityItem {
  _id: string;
  direction: "inbound" | "outbound";
  messageText: string;
  recipeUrl?: string;
  status: "received" | "processing" | "completed" | "failed";
  createdAt: number;
  instagramUsername?: string;
  accountUsername?: string;
}

interface RecentActivityProps {
  activity: ActivityItem[];
}

export function RecentActivity({ activity }: RecentActivityProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "processing":
        return <Clock className="w-4 h-4 text-yellow-600 animate-spin" />;
      default:
        return <MessageSquare className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (activity.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No activity yet</p>
        <p className="text-sm text-gray-500 mt-1">Messages will appear here as they come in</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="divide-y divide-gray-200">
        {activity.map((item) => (
          <div key={item._id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-gray-100 rounded-lg">{getStatusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-900">
                      {item.direction === "inbound" ? "From" : "To"} @{item.instagramUsername}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {item.accountUsername}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{item.messageText}</p>
                  {item.recipeUrl && (
                    <p className="text-xs text-blue-600 mt-1 truncate">{item.recipeUrl}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 ml-4">
                <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                <p className="text-xs text-gray-500">
                  {new Date(item.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
