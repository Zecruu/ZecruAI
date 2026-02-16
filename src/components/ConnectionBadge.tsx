"use client";

import { ConnectionStatus } from "@/types";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface ConnectionBadgeProps {
  status: ConnectionStatus;
}

export default function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const isDaemonConnected = status.daemon === "connected";
  const isConnecting =
    status.daemon === "connecting" || status.relay === "connecting";

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
        isDaemonConnected
          ? "bg-success/10 text-success"
          : isConnecting
          ? "bg-warning/10 text-warning"
          : "bg-danger/10 text-danger"
      }`}
    >
      {isDaemonConnected ? (
        <Wifi size={12} />
      ) : isConnecting ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <WifiOff size={12} />
      )}
      {isDaemonConnected
        ? "Connected"
        : isConnecting
        ? "Connecting..."
        : "Offline"}
    </div>
  );
}
