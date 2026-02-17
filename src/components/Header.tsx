"use client";

import { ConnectionStatus } from "@/types";
import ConnectionBadge from "./ConnectionBadge";
import { Settings, MessageSquarePlus, FolderOpen, History, LogOut } from "lucide-react";

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  onNewChat: () => void;
  onSettings: () => void;
  onHistory: () => void;
  onProjects: () => void;
  activeProjectName?: string;
  sessionActive?: boolean;
  dangerousMode?: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

export default function Header({
  connectionStatus,
  onNewChat,
  onSettings,
  onHistory,
  onProjects,
  activeProjectName,
  sessionActive,
  dangerousMode,
  userEmail,
  onLogout,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo + Status badges */}
        <div className="flex items-center gap-2">
          <button
            onClick={onHistory}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Conversation history"
          >
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">Z</span>
            </div>
            <span className="font-semibold text-foreground hidden sm:block">
              ZecruAI
            </span>
          </button>
          {sessionActive && (
            <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              Active
            </span>
          )}
          {sessionActive && dangerousMode && (
            <span className="text-[10px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
              Auto-Approve
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <ConnectionBadge status={connectionStatus} />
          <button
            onClick={onProjects}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
            title="Projects"
          >
            <FolderOpen size={18} />
          </button>
          <button
            onClick={onHistory}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
            title="History"
          >
            <History size={18} />
          </button>
          <button
            onClick={onNewChat}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
            title="New chat"
          >
            <MessageSquarePlus size={18} />
          </button>
          <button
            onClick={onSettings}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-surface transition-colors"
              title={userEmail ? `Sign out (${userEmail})` : "Sign out"}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Active project bar */}
      {activeProjectName && (
        <div className="flex items-center gap-2 px-4 pb-2 text-xs text-muted">
          <FolderOpen size={12} className="text-accent" />
          <button
            onClick={onProjects}
            className="truncate hover:text-foreground transition-colors"
          >
            {activeProjectName}
          </button>
        </div>
      )}
    </header>
  );
}
