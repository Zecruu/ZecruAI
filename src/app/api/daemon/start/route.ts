import { NextRequest, NextResponse } from "next/server";
import { fork, ChildProcess } from "child_process";
import path from "path";

// Store daemon processes keyed by projectId
declare global {
  var __zecruDaemons: Map<string, ChildProcess>;
}

if (!global.__zecruDaemons) {
  global.__zecruDaemons = new Map();
}

export async function POST(req: NextRequest) {
  const { pairingCode, workingDir, dangerousMode, projectId } = await req.json();

  if (!pairingCode || !workingDir || !projectId) {
    return NextResponse.json(
      { error: "pairingCode, workingDir, and projectId are required" },
      { status: 400 }
    );
  }

  // Kill existing daemon for this project if running
  const existing = global.__zecruDaemons.get(projectId);
  if (existing) {
    existing.kill("SIGTERM");
    global.__zecruDaemons.delete(projectId);
  }

  const daemonPath = path.resolve(process.cwd(), "daemon", "index.ts");

  try {
    const cleanEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (val === undefined) continue;
      if (key.startsWith("CLAUDE")) continue;
      if (key.startsWith("MCP")) continue;
      cleanEnv[key] = val;
    }
    cleanEnv.RELAY_URL = `http://localhost:${process.env.RELAY_PORT || 3001}`;

    // Room key = pairingCode-projectId for isolation
    const roomCode = `${pairingCode}-${projectId}`;
    const daemonArgs = ["--code", roomCode, "--dir", workingDir];
    if (dangerousMode) {
      daemonArgs.push("--dangerous");
    }

    const daemon = fork(daemonPath, daemonArgs, {
      cwd: process.cwd(),
      env: cleanEnv,
      execArgv: ["-r", "ts-node/register"],
      silent: true,
    });

    global.__zecruDaemons.set(projectId, daemon);

    daemon.stdout?.on("data", (data: Buffer) => {
      console.log(`  [daemon:${projectId}] ${data.toString().trim()}`);
    });

    daemon.stderr?.on("data", (data: Buffer) => {
      console.error(`  [daemon:${projectId}:err] ${data.toString().trim()}`);
    });

    daemon.on("close", (code) => {
      console.log(`  [daemon:${projectId}] Exited with code ${code}`);
      global.__zecruDaemons.delete(projectId);
    });

    daemon.on("error", (err) => {
      console.error(`  [daemon:${projectId}:error] ${err.message}`);
      global.__zecruDaemons.delete(projectId);
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    return NextResponse.json({
      success: true,
      pid: daemon.pid,
      projectId,
      message: "Daemon started",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to start daemon: ${err.message}` },
      { status: 500 }
    );
  }
}
