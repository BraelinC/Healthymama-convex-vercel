"use client";

import { Users, MessageSquare, CheckCircle2, TrendingUp } from "lucide-react";

interface StatsOverviewProps {
  stats: {
    accounts: {
      total: number;
      active: number;
      full: number;
      inactive: number;
    };
    messages: {
      today: number;
      week: number;
      month: number;
      total: number;
    };
    successRate: {
      completed: number;
      failed: number;
      percentage: number;
    };
    conversations: {
      total: number;
    };
  };
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const statCards = [
    {
      title: "Instagram Accounts",
      value: stats.accounts.total,
      subtitle: `${stats.accounts.active} active`,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Messages Today",
      value: stats.messages.today,
      subtitle: `${stats.messages.week} this week`,
      icon: MessageSquare,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Success Rate",
      value: `${stats.successRate.percentage}%`,
      subtitle: `${stats.successRate.completed} completed`,
      icon: CheckCircle2,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Total Conversations",
      value: stats.conversations.total,
      subtitle: `${stats.messages.total} messages`,
      icon: TrendingUp,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            <p className="text-sm font-medium text-gray-700 mt-1">{stat.title}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
}
