import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let projectId: string | undefined;
  try {
    const body = await req.json();
    projectId = body.projectId;
  } catch {
    // no body = stop all
  }

  if (!global.__zecruDaemons) {
    return NextResponse.json({ success: true, message: "No daemons running" });
  }

  if (projectId) {
    const daemon = global.__zecruDaemons.get(projectId);
    if (daemon) {
      daemon.kill("SIGTERM");
      global.__zecruDaemons.delete(projectId);
      return NextResponse.json({ success: true, message: `Daemon ${projectId} stopped` });
    }
    return NextResponse.json({ success: true, message: "No daemon for that project" });
  }

  // Stop all daemons
  global.__zecruDaemons.forEach((d) => d.kill("SIGTERM"));
  global.__zecruDaemons.clear();
  return NextResponse.json({ success: true, message: "All daemons stopped" });
}
