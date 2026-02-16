"use client";

import { TabMode, ConnectionStatus } from "@/types";
import TabSwitcher from "./TabSwitcher";
import ConnectionBadge from "./ConnectionBadge";
import { Settings, MessageSquarePlus, FolderOpen, History } from "lucide-react";

interface HeaderProps {
  activeTab: TabMode;
  onTabChange: (tab: TabMode) => void;
  connectionStatus: ConnectionStatus;
  onNewChat: () => void;
  onSettings: () => void;
  onHistory: () => void;
  onProjects: () => void;
  activeProjectName?: string;
  sessionActive?: boolean;
  dangerousMode?: boolean;
}

export default function Header({
  activeTab,
  onTabChange,
  connectionStatus,
  onNewChat,
  onSettings,
  onHistory,
  onProjects,
  activeProjectName,
  sessionActive,
  dangerousMode,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo + History */}
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
              <span className="text-[10px] font-normal text-muted ml-1">v0.1.0</span>
            </span>
          </button>
          {activeTab === "developer" && sessionActive && (
            <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
              Session Active
            </span>
          )}
          {activeTab === "developer" && sessionActive && dangerousMode && (
            <span className="text-[10px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
              Auto-Approve
            </span>
          )}
        </div>

        {/* Tab switcher (center) */}
        <TabSwitcher active={activeTab} onChange={onTabChange} />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {activeTab === "developer" && (
            <ConnectionBadge status={connectionStatus} />
          )}
          <button
            onClick={onProjects}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
            title="Projects"
          >
            <FolderOpen size={18} />
          </button>
          <button
            onClick={onHistory}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors sm:hidden"
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
        </div>
      </div>

      {/* Active project bar — only in developer mode when a project is selected */}
      {activeTab === "developer" && activeProjectName && (
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
