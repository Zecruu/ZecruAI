"use client";

import { useState, useEffect, useCallback } from "react";
import { Deployment, DeploymentProvider, Project } from "@/types";
import {
  X,
  Rocket,
  Key,
  ExternalLink,
  RefreshCw,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  Globe,
  Github,
} from "lucide-react";

interface DeploymentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: Project | null;
  deployment: Deployment | null;
  hasRailwayToken: boolean;
  hasVercelToken: boolean;
  onDeploymentChanged: () => void;
}

export default function DeploymentPanel({
  isOpen,
  onClose,
  activeProject,
  deployment,
  hasRailwayToken,
  hasVercelToken,
  onDeploymentChanged,
}: DeploymentPanelProps) {
  const [provider, setProvider] = useState<DeploymentProvider>(
    hasVercelToken ? "vercel" : hasRailwayToken ? "railway" : "vercel"
  );
  const [tokenInput, setTokenInput] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState(false);

  const [githubRepo, setGithubRepo] = useState(deployment?.githubRepo || "");
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  const [deleteLoading, setDeleteLoading] = useState(false);

  const hasToken = provider === "vercel" ? hasVercelToken : hasRailwayToken;
  const isBuilding = deployment && ["creating", "building", "deploying"].includes(deployment.status);

  // Poll for deployment status updates while building
  useEffect(() => {
    if (!deployment || !isBuilding) return;

    const interval = setInterval(async () => {
      try {
        await onDeploymentChanged();
      } catch {
        // ignore
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [deployment?.id, isBuilding, onDeploymentChanged]);

  // Reset state when provider changes
  useEffect(() => {
    setTokenInput("");
    setTokenError(null);
    setTokenSuccess(false);
    setDeployError(null);
  }, [provider]);

  const handleSaveToken = useCallback(async () => {
    if (!tokenInput.trim()) return;
    setTokenLoading(true);
    setTokenError(null);
    setTokenSuccess(false);

    try {
      const res = await fetch("/api/deploy/tokens", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token: tokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save token");

      setTokenSuccess(true);
      setTokenInput("");
      // Refresh parent to update hasToken flags
      window.location.reload();
    } catch (err: unknown) {
      setTokenError(err instanceof Error ? err.message : "Failed to save token");
    } finally {
      setTokenLoading(false);
    }
  }, [provider, tokenInput]);

  const handleRemoveToken = useCallback(async () => {
    try {
      await fetch("/api/deploy/tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      window.location.reload();
    } catch {
      // ignore
    }
  }, [provider]);

  const handleDeploy = useCallback(async () => {
    if (!activeProject) return;
    if (provider === "railway" && !githubRepo.trim()) {
      setDeployError("GitHub repository is required for Railway (e.g. username/repo)");
      return;
    }

    setDeployLoading(true);
    setDeployError(null);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          provider,
          githubRepo: provider === "railway" ? githubRepo.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deployment failed");

      onDeploymentChanged();
    } catch (err: unknown) {
      setDeployError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setDeployLoading(false);
    }
  }, [activeProject, provider, githubRepo, onDeploymentChanged]);

  const handleDelete = useCallback(async () => {
    if (!deployment) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/deploy/${deployment.id}`, { method: "DELETE" });
      onDeploymentChanged();
    } catch {
      // ignore
    } finally {
      setDeleteLoading(false);
    }
  }, [deployment, onDeploymentChanged]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md bg-background border border-border rounded-t-2xl sm:rounded-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Rocket size={20} className="text-accent" />
            Deploy
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* No project selected */}
          {!activeProject && (
            <div className="bg-surface border border-border rounded-xl px-4 py-6 text-center">
              <p className="text-sm text-muted">
                Select a project first to deploy it.
              </p>
            </div>
          )}

          {activeProject && (
            <>
              {/* Provider selector */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">Platform</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProvider("vercel")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      provider === "vercel"
                        ? "bg-foreground text-background border-foreground"
                        : "bg-surface text-muted border-border hover:text-foreground"
                    }`}
                  >
                    <Globe size={16} />
                    Vercel
                  </button>
                  <button
                    onClick={() => setProvider("railway")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      provider === "railway"
                        ? "bg-foreground text-background border-foreground"
                        : "bg-surface text-muted border-border hover:text-foreground"
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M.1 16.2c0-.1 0-.2.1-.3l7.6-12c.3-.5.6-.9 1-1.2C9.5 2 10.4 1.6 11.4 1.5h1.2c1 .1 1.9.5 2.6 1.2.4.3.7.7 1 1.2l7.6 12c.1.1.1.2.1.3s0 .2-.1.3c-.3.5-.7.6-1.2.6H1.3c-.5 0-.9-.1-1.2-.6 0-.1 0-.2 0-.3zm7.5 4.6c-.1-.3 0-.7.3-.9.2-.1.4-.2.6-.2h7c.2 0 .4.1.6.2.3.2.4.6.3.9-.1.2-.2.4-.4.5-.7.4-1.5.6-2.3.7H10.3c-.8-.1-1.6-.3-2.3-.7-.2-.1-.3-.3-.4-.5z" />
                    </svg>
                    Railway
                  </button>
                </div>
              </div>

              {/* Token setup */}
              {!hasToken ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Key size={16} className="text-accent" />
                    {provider === "vercel" ? "Vercel" : "Railway"} API Token
                  </h3>
                  <p className="text-xs text-muted">
                    Create a token at{" "}
                    <a
                      href={
                        provider === "vercel"
                          ? "https://vercel.com/account/tokens"
                          : "https://railway.com/account/tokens"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {provider === "vercel" ? "vercel.com/account/tokens" : "railway.com/account/tokens"}
                      <ExternalLink size={10} className="inline ml-0.5 -mt-0.5" />
                    </a>
                  </p>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={`Paste your ${provider} token...`}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
                  />
                  {tokenError && (
                    <p className="text-xs text-danger flex items-center gap-1">
                      <AlertCircle size={12} /> {tokenError}
                    </p>
                  )}
                  {tokenSuccess && (
                    <p className="text-xs text-success flex items-center gap-1">
                      <Check size={12} /> Token verified and saved
                    </p>
                  )}
                  <button
                    onClick={handleSaveToken}
                    disabled={tokenLoading || !tokenInput.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {tokenLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Key size={16} />
                    )}
                    {tokenLoading ? "Verifying..." : "Verify & Save Token"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-success/5 border border-success/20 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-success" />
                    <span className="text-sm text-success font-medium">
                      {provider === "vercel" ? "Vercel" : "Railway"} connected
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveToken}
                    className="text-xs text-muted hover:text-danger transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* GitHub repo input for Railway */}
              {hasToken && provider === "railway" && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Github size={16} />
                    GitHub Repository
                  </h3>
                  <p className="text-xs text-muted">
                    Railway deploys from GitHub. Push your project to GitHub and enter the repo.
                  </p>
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="username/repo-name"
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground font-mono placeholder:text-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {/* Deploy status */}
              {deployment && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Globe size={16} className="text-accent" />
                    Deployment Status
                  </h3>

                  {/* Status badge */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                      deployment.status === "ready"
                        ? "bg-success/5 border-success/20"
                        : deployment.status === "error"
                        ? "bg-danger/5 border-danger/20"
                        : "bg-accent/5 border-accent/20"
                    }`}
                  >
                    {isBuilding && <Loader2 size={18} className="text-accent animate-spin" />}
                    {deployment.status === "ready" && <Check size={18} className="text-success" />}
                    {deployment.status === "error" && <AlertCircle size={18} className="text-danger" />}
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          deployment.status === "ready"
                            ? "text-success"
                            : deployment.status === "error"
                            ? "text-danger"
                            : "text-accent"
                        }`}
                      >
                        {deployment.status === "ready" && "Live"}
                        {deployment.status === "building" && "Building..."}
                        {deployment.status === "deploying" && "Deploying..."}
                        {deployment.status === "creating" && "Creating..."}
                        {deployment.status === "error" && "Failed"}
                      </p>
                      {deployment.error && (
                        <p className="text-xs text-danger mt-0.5">{deployment.error}</p>
                      )}
                      {deployment.lastDeployedAt && (
                        <p className="text-[11px] text-muted mt-0.5">
                          Last deployed {new Date(deployment.lastDeployedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Live URL */}
                  {deployment.url && deployment.status === "ready" && (
                    <a
                      href={deployment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 bg-surface border border-border rounded-xl hover:border-accent transition-colors group"
                    >
                      <Globe size={16} className="text-accent" />
                      <span className="text-sm text-accent font-mono truncate flex-1">
                        {deployment.url.replace(/^https?:\/\//, "")}
                      </span>
                      <ExternalLink size={14} className="text-muted group-hover:text-accent transition-colors" />
                    </a>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeploy}
                      disabled={deployLoading || !!isBuilding}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {deployLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      {deployLoading ? "Deploying..." : "Redeploy"}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="w-11 flex items-center justify-center rounded-xl bg-surface border border-border text-muted hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Deploy button (no existing deployment) */}
              {!deployment && hasToken && (
                <div className="space-y-3">
                  {deployError && (
                    <p className="text-xs text-danger flex items-center gap-1">
                      <AlertCircle size={12} /> {deployError}
                    </p>
                  )}
                  <button
                    onClick={handleDeploy}
                    disabled={deployLoading || !activeProject}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {deployLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Rocket size={18} />
                    )}
                    {deployLoading
                      ? provider === "vercel"
                        ? "Uploading & Deploying..."
                        : "Creating & Deploying..."
                      : `Deploy to ${provider === "vercel" ? "Vercel" : "Railway"}`}
                  </button>
                  {provider === "vercel" && (
                    <p className="text-[11px] text-muted text-center">
                      Files from your project directory will be uploaded directly to Vercel.
                    </p>
                  )}
                  {provider === "railway" && (
                    <p className="text-[11px] text-muted text-center">
                      Railway will deploy from your GitHub repository.
                    </p>
                  )}
                </div>
              )}

              {/* Info */}
              <div className="bg-surface border border-border rounded-xl p-3">
                <p className="text-[11px] text-muted text-center">
                  {provider === "vercel"
                    ? "Vercel deploys your project files directly. Each deploy creates a unique preview URL."
                    : "Railway deploys from GitHub. Push changes to your repo, then redeploy here."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
