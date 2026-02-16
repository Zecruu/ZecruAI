"use client";

import { Bot, FileText, Terminal, Search, Pencil, Globe, Loader2 } from "lucide-react";
import { ActivityEvent } from "@/types";

interface TypingIndicatorProps {
  activity?: ActivityEvent | null;
}

function getActivityIcon(activity?: ActivityEvent | null) {
  if (!activity?.tool) return null;

  switch (activity.tool) {
    case "Read":
      return <FileText size={12} className="text-blue-400" />;
    case "Write":
    case "Edit":
      return <Pencil size={12} className="text-amber-400" />;
    case "Bash":
      return <Terminal size={12} className="text-green-400" />;
    case "Glob":
    case "Grep":
      return <Search size={12} className="text-purple-400" />;
    case "WebSearch":
    case "WebFetch":
      return <Globe size={12} className="text-cyan-400" />;
    default:
      return <Loader2 size={12} className="text-accent animate-spin" />;
  }
}

export default function TypingIndicator({ activity }: TypingIndicatorProps) {
  const hasActivity = activity?.message;
  const icon = getActivityIcon(activity);

  return (
    <div className="flex gap-3 py-3 px-4 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
        <Bot size={16} className="text-accent" />
      </div>
      <div className="bg-ai-bubble border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex flex-col gap-1.5">
        {/* Activity message */}
        {hasActivity ? (
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs text-muted animate-pulse">
              {activity!.message}
            </span>
          </div>
        ) : null}

        {/* Bouncing dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-muted typing-dot" />
          <div className="w-2 h-2 rounded-full bg-muted typing-dot" />
          <div className="w-2 h-2 rounded-full bg-muted typing-dot" />
        </div>
      </div>
    </div>
  );
}
