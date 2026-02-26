import { NextResponse } from "next/server";

export async function POST() {
  const daemon = (global as Record<string, unknown>).__zecruRobotDaemon as { kill: (signal: string) => void } | null;

  if (daemon) {
    daemon.kill("SIGTERM");
    (global as Record<string, unknown>).__zecruRobotDaemon = null;
    return NextResponse.json({ success: true, message: "Robot daemon stopped" });
  }

  return NextResponse.json({ success: true, message: "No robot daemon running" });
}
