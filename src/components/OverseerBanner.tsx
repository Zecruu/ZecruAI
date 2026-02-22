"use client";

import { Brain, AlertTriangle, X } from "lucide-react";
import { OverseerDecision, PrerequisiteItem } from "@/types";

interface OverseerBannerProps {
  enabled: boolean;
  lastDecision: OverseerDecision | null;
  onToggle: (value: boolean) => void;
  prerequisites?: PrerequisiteItem[];
  onDismissPrerequisites?: () => void;
}

export default function OverseerBanner({
  enabled,
  lastDecision,
  onToggle,
  prerequisites = [],
  onDismissPrerequisites,
}: OverseerBannerProps) {
  if (!enabled) return null;

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-accent/5 border-b border-accent/10 text-xs">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-accent" />
          <span className="font-medium text-accent">Overseer: Active</span>
          {lastDecision && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                lastDecision.autoApprove
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {lastDecision.autoApprove ? "Auto-approved" : "Manual review"}
            </span>
          )}
        </div>
        <button
          onClick={() => onToggle(false)}
          className="text-muted hover:text-foreground transition-colors text-[11px]"
        >
          Disable
        </button>
      </div>

      {/* Prerequisite warnings */}
      {prerequisites.length > 0 && (
        <div className="px-4 py-3 bg-warning/5 border-b border-warning/20">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-warning" />
              <span className="text-xs font-medium text-warning">
                Missing Prerequisites ({prerequisites.length})
              </span>
            </div>
            {onDismissPrerequisites && (
              <button
                onClick={onDismissPrerequisites}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {prerequisites.map((prereq, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[10px] font-mono shrink-0">
                  {prereq.type === "env_var" ? "ENV" :
                   prereq.type === "dependency" ? "PKG" :
                   prereq.type === "config_file" ? "CFG" : "REQ"}
                </span>
                <div>
                  <span className="font-medium text-foreground">{prereq.name}</span>
                  <span className="text-muted ml-1">— {prereq.reason}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2">
            Resolve these before re-sending your message. Dismiss to send anyway.
          </p>
        </div>
      )}
    </div>
  );
}
