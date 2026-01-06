"use client";

import { cn } from "@/lib/recipeai-utils";

type Props = {
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
};

export function HealthyMamaMessageBubble({ role, content, createdAt }: Props) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-3xl px-5 py-3 text-sm leading-relaxed shadow-lg md:max-w-[70%]",
          isUser
            ? "bg-recipeai-accent text-white shadow-glow"
            : "bg-slate-800/80 text-slate-100"
        )}
        dangerouslySetInnerHTML={{ __html: serializeMarkdown(content) }}
      />
      {createdAt && (
        <time className="px-2 text-[10px] uppercase tracking-wide text-slate-500">
          {new Date(createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      )}
    </div>
  );
}

function serializeMarkdown(raw: string) {
  return raw
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}
