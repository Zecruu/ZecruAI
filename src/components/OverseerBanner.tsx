"use client";

import { Brain } from "lucide-react";
import { OverseerDecision } from "@/types";

interface OverseerBannerProps {
  enabled: boolean;
  lastDecision: OverseerDecision | null;
  onToggle: (value: boolean) => void;
}

export default function OverseerBanner({ enabled, lastDecision, onToggle }: OverseerBannerProps) {
  if (!enabled) return null;

  return (
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
  );
}
