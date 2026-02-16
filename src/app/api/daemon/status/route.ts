import { NextResponse } from "next/server";

export async function GET() {
  const daemons: Record<string, { running: boolean; pid: number | null }> = {};

  if (global.__zecruDaemons) {
    global.__zecruDaemons.forEach((d, projectId) => {
      daemons[projectId] = { running: !d.killed, pid: d.pid ?? null };
    });
  }

  return NextResponse.json({
    running: Object.keys(daemons).length > 0,
    daemons,
  });
}
