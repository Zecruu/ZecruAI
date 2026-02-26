import { NextResponse } from "next/server";
import { ChildProcess } from "child_process";

export async function GET() {
  const daemon = (global as Record<string, unknown>).__zecruRobotDaemon as ChildProcess | null;

  return NextResponse.json({
    running: !!daemon && !daemon.killed,
    pid: daemon?.pid || null,
    mode: "robot",
  });
}
