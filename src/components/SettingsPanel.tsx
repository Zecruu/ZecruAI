"use client";

import { useState, useEffect, useMemo } from "react";
import { Project } from "@/types";
import {
  X,
  Copy,
  Check,
  Monitor,
  FolderOpen,
  Power,
  PowerOff,
  Loader2,
  Wifi,
  WifiOff,
  Terminal,
  AlertTriangle,
  Info,
  Laptop,
  LogOut,
  User,
} from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pairingCode: string;
  activeProject: Project | null;
  daemonConnected?: boolean;
  onDaemonChanged?: () => void;
  dangerousMode: boolean;
  onDangerousModeChange: (value: boolean) => void;
  userEmail?: string;
  onLogout?: () => void;
}

function isLocalhost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export default function SettingsPanel({
  isOpen,
  onClose,
  pairingCode,
  activeProject,
  daemonConnected,
  onDaemonChanged,
  dangerousMode,
  onDangerousModeChange,
  userEmail,
  onLogout,
}: SettingsPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [daemonLoading, setDaemonLoading] = useState(false);
  const [daemonRunning, setDaemonRunning] = useState(false);
  const [daemonError, setDaemonError] = useState<string | null>(null);
  const [showAuthGuide, setShowAuthGuide] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const isLocal = isLocalhost();

  const connectCommand = useMemo(() => {
    const dangerousFlag = dangerousMode ? " --dangerous" : "";
    return `zecru connect ${pairingCode}${dangerousFlag}`;
  }, [pairingCode, dangerousMode]);

  const installCommand = "npm install -g zecru-ai";

  const [copiedInstall, setCopiedInstall] = useState(false);

  const copyConnect = () => {
    navigator.clipboard.writeText(connectCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const copyInstall = () => {
    navigator.clipboard.writeText(installCommand);
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  // Check daemon status for active project on open
  useEffect(() => {
    if (isOpen && activeProject && isLocal) {
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
  }, [isOpen, activeProject, isLocal]);

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
    } catch (err: unknown) {
      setDaemonError(`Connection error: ${err instanceof Error ? err.message : "Unknown error"}`);
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
          {/* Account Info */}
          {userEmail && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                  <User size={16} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{userEmail}</p>
                  <p className="text-[11px] text-muted">Signed in</p>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-danger hover:bg-surface transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              )}
            </div>
          )}

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
                  ? "Connect your computer below"
                  : "Select a project first, then connect"}
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

          {/* Connect Session — LOCAL MODE */}
          {isLocal && (
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
          )}

          {/* Connect Session — REMOTE MODE */}
          {!isLocal && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Laptop size={16} className="text-accent" />
                Connect Your Computer
              </h3>

              {isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success/10 border border-success/20">
                    <Check size={16} className="text-success" />
                    <p className="text-sm text-success font-medium">
                      Computer connected
                    </p>
                  </div>
                  <p className="text-xs text-muted text-center">
                    To disconnect, press Ctrl+C in the terminal on your computer.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Step 1 — Install */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[11px] flex items-center justify-center font-bold">
                        1
                      </span>
                      Install ZecruAI CLI
                      <span className="text-muted font-normal">(one-time)</span>
                    </p>
                    <div className="relative">
                      <div className="bg-surface border border-border rounded-xl px-3 py-2.5 pr-11 font-mono text-[11px] text-accent">
                        {installCommand}
                      </div>
                      <button
                        onClick={copyInstall}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
                      >
                        {copiedInstall ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Step 2 — Connect */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[11px] flex items-center justify-center font-bold">
                        2
                      </span>
                      Open terminal in your project folder and run
                    </p>
                    <div className="relative">
                      <div className="bg-surface border border-border rounded-xl px-3 py-2.5 pr-11 font-mono text-[11px] text-accent">
                        {connectCommand}
                      </div>
                      <button
                        onClick={copyConnect}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
                      >
                        {copiedCmd ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Big copy button for the connect command */}
                  <button
                    onClick={copyConnect}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-all"
                  >
                    {copiedCmd ? (
                      <Check size={18} />
                    ) : (
                      <Copy size={18} />
                    )}
                    {copiedCmd ? "Copied!" : "Copy Connect Command"}
                  </button>

                  {!activeProject && (
                    <p className="text-xs text-warning text-center">
                      Select a project first to generate your connect command
                    </p>
                  )}

                  {/* First time help */}
                  <button
                    onClick={() => setShowSetup(!showSetup)}
                    className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
                  >
                    <Info size={14} className="text-accent" />
                    {showSetup ? "Hide details" : "New to Claude Code? Read this first"}
                  </button>

                  {showSetup && (
                    <div className="bg-surface border border-border rounded-xl p-3 text-xs space-y-2">
                      <p className="text-foreground font-medium flex items-center gap-1.5">
                        <Terminal size={12} className="text-accent" />
                        Prerequisites
                      </p>
                      <p className="text-muted">
                        You need{" "}
                        <span className="text-foreground">Node.js 18+</span>{" "}
                        installed on your computer. Download it from{" "}
                        <span className="text-accent">nodejs.org</span> if you
                        don&apos;t have it.
                      </p>
                      <p className="text-muted mt-2">
                        After installing ZecruAI CLI, you&apos;ll need to
                        authenticate Claude Code once. Open a terminal and run:
                      </p>
                      <div className="bg-background rounded-lg px-3 py-2 font-mono text-[11px] text-accent">
                        claude
                      </div>
                      <p className="text-muted">
                        Follow the prompts to log in. You only need to do this
                        once — ZecruAI uses the same credentials automatically.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Auto-Approve Mode */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning" />
                Auto-Approve All Actions
              </h3>
              <button
                onClick={() => onDangerousModeChange(!dangerousMode)}
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

          {/* Auth Help — only show in local mode */}
          {isLocal && (
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
                    Follow the prompts to log in. You only need to do this once
                    — ZecruAI uses the same credentials automatically.
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
          )}

          {/* Pairing Code */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
              <Monitor size={16} className="text-accent" />
              Pairing Code
            </h3>
            <p className="text-xs text-muted mb-3">
              Your unique pairing code. Use it to connect the CLI daemon.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 font-mono text-lg text-center tracking-[0.3em] text-accent">
                {pairingCode || "---"}
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
            </div>
          </div>

          {/* How it works */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-muted text-center mb-3 font-medium">
              How It Works
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px]">
              <span className="px-2 py-1 bg-accent/20 text-accent rounded-md">
                {isLocal ? "You type" : "Phone"}
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
              {isLocal
                ? "Your messages go to Claude Code running on your computer. You see everything Claude does in real-time."
                : "Your messages are routed through ZecruAI to Claude Code running on your computer. You see everything in real-time from any device."}
            </p>
          </div>

          {/* App info */}
          <div className="text-center pt-2 pb-4">
            <p className="text-xs text-muted">ZecruAI v0.1.1</p>
          </div>
        </div>
      </div>
    </div>
  );
}
