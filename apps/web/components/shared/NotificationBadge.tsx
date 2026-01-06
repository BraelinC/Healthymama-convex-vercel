"use client";

interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export function NotificationBadge({ count, className = "" }: NotificationBadgeProps) {
  if (count === 0) return null;

  return (
    <div
      className={`absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center ${className}`}
      aria-label={`${count} new notifications`}
    >
      {count > 9 ? (
        <span className="text-white text-[8px] font-bold">9+</span>
      ) : (
        <span className="text-white text-[10px] font-bold">{count}</span>
      )}
    </div>
  );
}
