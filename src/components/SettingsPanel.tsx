"use client";

import { useState, useEffect } from "react";
import { Project } from "@/types";
import {
  X,
  Copy,
  Check,
  Monitor,
  RefreshCw,
  FolderOpen,
  Power,
  PowerOff,
  Loader2,
  Wifi,
  WifiOff,
  Terminal,
  AlertTriangle,
  Info,
} from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pairingCode: string;
  onRegenerateCode: () => void;
  activeProject: Project | null;
  daemonConnected?: boolean;
  onDaemonChanged?: () => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  pairingCode,
  onRegenerateCode,
  activeProject,
  daemonConnected,
  onDaemonChanged,
}: SettingsPanelProps) {
  const [copied, setCopied] = useState(false);
  const [daemonLoading, setDaemonLoading] = useState(false);
  const [daemonRunning, setDaemonRunning] = useState(false);
  const [daemonError, setDaemonError] = useState<string | null>(null);
  const [showAuthGuide, setShowAuthGuide] = useState(false);
  const [dangerousMode, setDangerousMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("zecru-dangerous-mode") === "true";
  });

  // Check daemon status for active project on open
  useEffect(() => {
    if (isOpen && activeProject) {
      fetch("/api/daemon/status")
        .then((r) => r.json())
        .then((data) => {
          setDaemonRunning(
            !!data.daemons?.[activeProject.id]?.running
          );
        })
        .catch(() => {});
    } else if (isOpen && !activeProject) {
      setDaemonRunning(false);
    }
  }, [isOpen, activeProject]);

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startDaemon = async () => {
    if (!activeProject) {
      setDaemonError("Select a project first (use the Projects sidebar)");
      return;
    }

    setDaemonLoading(true);
    setDaemonError(null);

    try {
      const res = await fetch("/api/daemon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingCode,
          workingDir: activeProject.workingDirectory,
          projectId: activeProject.id,
          dangerousMode,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setDaemonRunning(true);
        onDaemonChanged?.();
      } else {
        setDaemonError(data.error || "Failed to start daemon");
      }
    } catch (err: any) {
      setDaemonError(`Connection error: ${err.message}`);
    } finally {
      setDaemonLoading(false);
    }
  };

  const stopDaemon = async () => {
    setDaemonLoading(true);
    try {
      await fetch("/api/daemon/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject?.id,
        }),
      });
      setDaemonRunning(false);
      onDaemonChanged?.();
    } catch {
      // ignore
    } finally {
      setDaemonLoading(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = daemonConnected || daemonRunning;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md bg-background border border-border rounded-t-2xl sm:rounded-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-6">
          {/* Connection Status Banner */}
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
              isConnected
                ? "bg-success/5 border-success/20"
                : "bg-surface border-border"
            }`}
          >
            {isConnected ? (
              <Wifi size={20} className="text-success" />
            ) : (
              <WifiOff size={20} className="text-muted" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  isConnected ? "text-success" : "text-foreground"
                }`}
              >
                {isConnected ? "Claude Session Active" : "Not Connected"}
              </p>
              <p className="text-xs text-muted">
                {isConnected
                  ? "Claude Code is ready to receive commands"
                  : activeProject
                  ? "Activate the session below"
                  : "Select a project first, then activate"}
              </p>
            </div>
          </div>

          {/* Active Project Display */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
              <FolderOpen size={16} className="text-accent" />
              Active Project
            </h3>
            {activeProject ? (
              <div className="bg-surface border border-border rounded-xl px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">
                  {activeProject.name}
                </p>
                <p className="text-[11px] text-muted font-mono truncate mt-0.5">
                  {activeProject.workingDirectory}
                </p>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl px-3 py-3 text-center">
                <p className="text-xs text-muted">
                  No project selected. Use the{" "}
                  <span className="text-accent font-medium">Projects</span>{" "}
                  button to add and select a project.
                </p>
              </div>
            )}
          </div>

          {/* Activate Session */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Power size={16} className="text-accent" />
              Activate Session
            </h3>
            {isConnected ? (
              <button
                onClick={stopDaemon}
                disabled={daemonLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-danger/10 text-danger text-sm font-medium hover:bg-danger/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {daemonLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <PowerOff size={18} />
                )}
                {daemonLoading ? "Disconnecting..." : "Disconnect"}
              </button>
            ) : (
              <button
                onClick={startDaemon}
                disabled={daemonLoading || !activeProject}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {daemonLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Power size={18} />
                )}
                {daemonLoading
                  ? "Activating Claude Session..."
                  : "Activate Claude Session"}
              </button>
            )}

            {!activeProject && !isConnected && (
              <p className="text-xs text-warning mt-2 text-center">
                Select a project first
              </p>
            )}

            {daemonError && (
              <p className="text-xs text-danger mt-2 text-center">
                {daemonError}
              </p>
            )}
          </div>

          {/* Auto-Approve Mode */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning" />
                Auto-Approve All Actions
              </h3>
              <button
                onClick={() => {
                  const next = !dangerousMode;
                  setDangerousMode(next);
                  localStorage.setItem("zecru-dangerous-mode", String(next));
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  dangerousMode ? "bg-warning" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    dangerousMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-muted mt-2">
              Lets Claude edit files, run commands, and take any action without
              asking.
              {isConnected && " Restart session to apply changes."}
            </p>
          </div>

          {/* Auth Help */}
          <div>
            <button
              onClick={() => setShowAuthGuide(!showAuthGuide)}
              className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
            >
              <Info size={14} className="text-accent" />
              {showAuthGuide
                ? "Hide authentication guide"
                : "First time? Authentication required"}
            </button>

            {showAuthGuide && (
              <div className="bg-surface border border-border rounded-xl p-3 mt-2 text-xs space-y-2">
                <p className="text-foreground font-medium flex items-center gap-1.5">
                  <Terminal size={12} className="text-accent" />
                  One-time setup:
                </p>
                <p className="text-muted">
                  Claude Code needs to be authenticated on your computer. Open
                  any terminal and run:
                </p>
                <div className="bg-background rounded-lg px-3 py-2 font-mono text-[11px] text-accent">
                  claude
                </div>
                <p className="text-muted">
                  Follow the prompts to log in. You only need to do this once —
                  ZecruAI uses the same credentials automatically.
                </p>
                <p className="text-muted mt-2">
                  <span className="text-foreground">
                    Don&apos;t have Claude Code?
                  </span>{" "}
                  Install it first:
                </p>
                <div className="bg-background rounded-lg px-3 py-2 font-mono text-[11px] text-accent">
                  npm install -g @anthropic-ai/claude-code
                </div>
              </div>
            )}
          </div>

          {/* Pairing Code (advanced) */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
              <Monitor size={16} className="text-accent" />
              Pairing Code
            </h3>
            <p className="text-xs text-muted mb-3">
              Use this code to connect from another device.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 font-mono text-lg text-center tracking-[0.3em] text-accent">
                {pairingCode}
              </div>
              <button
                onClick={copyCode}
                className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
              >
                {copied ? (
                  <Check size={16} className="text-success" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
              <button
                onClick={onRegenerateCode}
                className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
                title="Generate new code"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-muted text-center mb-3 font-medium">
              How It Works
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px]">
              <span className="px-2 py-1 bg-accent/20 text-accent rounded-md">
                You type
              </span>
              <span className="text-muted">→</span>
              <span className="px-2 py-1 bg-accent/20 text-accent rounded-md">
                ZecruAI
              </span>
              <span className="text-muted">→</span>
              <span className="px-2 py-1 bg-accent/20 text-accent rounded-md">
                Claude Code
              </span>
              <span className="text-muted">→</span>
              <span className="px-2 py-1 bg-success/20 text-success rounded-md">
                Your Code
              </span>
            </div>
            <p className="text-[11px] text-muted text-center mt-3">
              Your messages go to Claude Code running on your computer. You see
              everything Claude does in real-time.
            </p>
          </div>

          {/* App info */}
          <div className="text-center pt-2 pb-4">
            <p className="text-xs text-muted">ZecruAI v0.1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
