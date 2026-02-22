"use client";

import { ConnectionStatus, Deployment, TabMode } from "@/types";
import ConnectionBadge from "./ConnectionBadge";
import DeploymentBadge from "./DeploymentBadge";
import { Settings, MessageSquarePlus, FolderOpen, History, LogOut, Paintbrush, Rocket } from "lucide-react";

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
  activeTab: TabMode;
  onTabChange: (tab: TabMode) => void;
  onDeploy?: () => void;
  activeDeployment?: Deployment | null;
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
  activeTab,
  onTabChange,
  onDeploy,
  activeDeployment,
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

        {/* Tab switcher - centered */}
        <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5">
          <button
            onClick={() => onTabChange("developer")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "developer"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => onTabChange("ui")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "ui"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Paintbrush size={12} />
            Zecru UI
          </button>
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
          {onDeploy && (
            <button
              onClick={onDeploy}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
              title="Deploy"
            >
              <Rocket size={18} />
            </button>
          )}
          {activeTab === "developer" && (
            <>
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
            </>
          )}
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
          {activeDeployment && onDeploy && (
            <DeploymentBadge deployment={activeDeployment} onClick={onDeploy} />
          )}
        </div>
      )}
    </header>
  );
}
