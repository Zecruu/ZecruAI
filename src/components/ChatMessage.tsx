"use client";

import { Message } from "@/types";
import {
  Bot,
  User,
  AlertCircle,
  FileText,
  Pencil,
  Terminal,
  Search,
  Globe,
  Cog,
} from "lucide-react";
import PermissionCard from "./PermissionCard";

function getActivityIcon(content: string) {
  if (content.startsWith("Reading")) return <FileText size={10} className="text-blue-400" />;
  if (content.startsWith("Writing") || content.startsWith("Editing")) return <Pencil size={10} className="text-amber-400" />;
  if (content.startsWith("Running")) return <Terminal size={10} className="text-green-400" />;
  if (content.startsWith("Searching")) return <Search size={10} className="text-purple-400" />;
  if (content.startsWith("Fetching") || content.startsWith("Searching web")) return <Globe size={10} className="text-cyan-400" />;
  return <Cog size={10} className="text-muted" />;
}

interface ChatMessageProps {
  message: Message;
  onPermission?: (id: string, approved: boolean) => void;
}

export default function ChatMessage({ message, onPermission }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isPermission = message.type === "permission";
  const isError = message.type === "error";
  const isStatus = message.type === "status";
  const isActivity = message.type === "activity";

  if (isStatus) {
    return (
      <div className="flex justify-center py-2 animate-fade-in">
        <span className="text-xs text-muted px-3 py-1 bg-surface rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  if (isActivity) {
    return (
      <div className="flex items-center gap-2 py-0.5 px-4 pl-16 animate-fade-in">
        {getActivityIcon(message.content)}
        <span className="text-[11px] text-muted truncate">
          {message.content}
        </span>
      </div>
    );
  }

  if (isPermission && onPermission) {
    return (
      <div className="animate-fade-in">
        <PermissionCard message={message} onPermission={onPermission} />
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 py-3 px-4 animate-fade-in ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-accent"
            : isError
            ? "bg-danger/20"
            : "bg-surface border border-border"
        }`}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : isError ? (
          <AlertCircle size={16} className="text-danger" />
        ) : (
          <Bot size={16} className="text-accent" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-user-bubble text-white rounded-br-sm"
            : isError
            ? "bg-danger/10 text-danger border border-danger/20 rounded-bl-sm"
            : "bg-ai-bubble text-foreground border border-border rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <span
          className={`text-[10px] mt-1 block ${
            isUser ? "text-white/50 text-right" : "text-muted"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
