"use client";

import { Deployment } from "@/types";
import { Loader2, ExternalLink } from "lucide-react";

interface DeploymentBadgeProps {
  deployment: Deployment | null;
  onClick: () => void;
}

export default function DeploymentBadge({ deployment, onClick }: DeploymentBadgeProps) {
  if (!deployment) return null;

  const isBuilding = ["creating", "building", "deploying"].includes(deployment.status);
  const isReady = deployment.status === "ready";
  const isError = deployment.status === "error";

  const truncatedUrl = deployment.url
    ? deployment.url.replace(/^https?:\/\//, "").slice(0, 28) + (deployment.url.length > 36 ? "..." : "")
    : "";

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
        isReady
          ? "bg-success/10 text-success hover:bg-success/20"
          : isError
          ? "bg-danger/10 text-danger hover:bg-danger/20"
          : "bg-accent/10 text-accent hover:bg-accent/20"
      }`}
    >
      {isBuilding && <Loader2 size={10} className="animate-spin" />}
      {isReady && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
      {isError && <span className="w-1.5 h-1.5 rounded-full bg-danger" />}

      {isBuilding && "Deploying..."}
      {isReady && (
        <>
          Live
          {truncatedUrl && (
            <>
              <span className="text-muted mx-0.5">|</span>
              <span className="font-mono opacity-75">{truncatedUrl}</span>
              <ExternalLink size={8} />
            </>
          )}
        </>
      )}
      {isError && "Deploy Failed"}
    </button>
  );
}
