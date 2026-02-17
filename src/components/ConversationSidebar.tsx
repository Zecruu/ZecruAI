"use client";

import { Conversation } from "@/types";
import { X, MessageSquare, Plus, Trash2, Clock } from "lucide-react";

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function ConversationSidebar({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  if (!isOpen) return null;

  // Sort by most recent first
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sidebar panel — slides from left */}
      <div className="relative w-72 max-w-[80vw] bg-background border-r border-border h-full flex flex-col animate-slide-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Conversations
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onNew}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-accent hover:bg-surface transition-colors"
              title="New conversation"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sorted.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare size={24} className="text-muted mx-auto mb-2" />
              <p className="text-xs text-muted">No conversations yet</p>
            </div>
          ) : (
            sorted.map((conv, index) => {
              const isActive = conv.id === activeConversationId;
              const number = sorted.length - index;
              const messageCount = conv.messages.filter(
                (m) => m.role === "user"
              ).length;
              const timeStr = new Date(conv.updatedAt).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" }
              );

              return (
                <div
                  key={conv.id}
                  className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isActive
                      ? "bg-accent/10 border-r-2 border-accent"
                      : "hover:bg-surface"
                  }`}
                  onClick={() => {
                    onSelect(conv.id);
                    onClose();
                  }}
                >
                  <span className="text-[11px] text-muted font-mono mt-0.5 min-w-[20px]">
                    {number}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm truncate ${
                        isActive
                          ? "text-accent font-medium"
                          : "text-foreground"
                      }`}
                    >
                      {conv.title}
                    </p>
                    {conv.summary && (
                      <p className="text-[11px] text-muted/70 mt-0.5 truncate italic">
                        {conv.summary}
                      </p>
                    )}
                    <p className="text-[11px] text-muted mt-0.5">
                      {messageCount} message{messageCount !== 1 ? "s" : ""} ·{" "}
                      {timeStr}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-muted hover:text-danger transition-all mt-0.5"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* 7-day notice */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[11px] text-muted flex items-center gap-1.5">
            <Clock size={11} className="flex-shrink-0" />
            Conversations auto-delete after 7 days
          </p>
        </div>
      </div>
    </div>
  );
}
