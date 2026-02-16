"use client";

import { useState } from "react";
import { Message } from "@/types";
import { ShieldCheck, ShieldX, FileCode, ChevronDown, ChevronUp } from "lucide-react";

interface PermissionCardProps {
  message: Message;
  onPermission: (id: string, approved: boolean) => void;
}

export default function PermissionCard({ message, onPermission }: PermissionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [responded, setResponded] = useState(false);
  const [choice, setChoice] = useState<"approved" | "denied" | null>(null);

  // Parse the permission data from message content
  let permissionData: { action: string; description: string; files?: string[] };
  try {
    permissionData = JSON.parse(message.content);
  } catch {
    permissionData = {
      action: "Permission Required",
      description: message.content,
    };
  }

  const handleResponse = (approved: boolean) => {
    setResponded(true);
    setChoice(approved ? "approved" : "denied");
    onPermission(message.id, approved);
  };

  return (
    <div className="mx-4 my-2 rounded-xl border border-warning/30 bg-warning/5 overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-warning/20">
        <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
          <ShieldCheck size={16} className="text-warning" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {permissionData.action}
          </p>
          <p className="text-xs text-muted">Claude needs your approval</p>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-3">
        <p className="text-sm text-foreground/80">{permissionData.description}</p>

        {/* Files list */}
        {permissionData.files && permissionData.files.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              <FileCode size={12} />
              {permissionData.files.length} file(s)
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1">
                {permissionData.files.map((file, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono text-muted bg-surface rounded px-2 py-1"
                  >
                    {file}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-warning/20">
        {responded ? (
          <div
            className={`flex items-center gap-2 text-sm font-medium ${
              choice === "approved" ? "text-success" : "text-danger"
            }`}
          >
            {choice === "approved" ? (
              <>
                <ShieldCheck size={16} /> Approved
              </>
            ) : (
              <>
                <ShieldX size={16} /> Denied
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleResponse(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-success/20 text-success text-sm font-medium hover:bg-success/30 active:scale-[0.98] transition-all"
            >
              <ShieldCheck size={16} />
              Approve
            </button>
            <button
              onClick={() => handleResponse(false)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-danger/20 text-danger text-sm font-medium hover:bg-danger/30 active:scale-[0.98] transition-all"
            >
              <ShieldX size={16} />
              Deny
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
