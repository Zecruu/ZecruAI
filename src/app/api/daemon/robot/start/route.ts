import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "path";

declare global {
  var __zecruRobotDaemon: ChildProcess | null;
}

if (!global.__zecruRobotDaemon) {
  global.__zecruRobotDaemon = null;
}

export async function POST(req: NextRequest) {
  const { pairingCode, dangerousMode } = await req.json();

  if (!pairingCode) {
    return NextResponse.json({ error: "pairingCode is required" }, { status: 400 });
  }

  // Kill existing robot daemon if running
  if (global.__zecruRobotDaemon) {
    global.__zecruRobotDaemon.kill("SIGTERM");
    global.__zecruRobotDaemon = null;
  }

  // Resolve daemon path — Electron uses compiled JS, web uses ts-node
  const appRoot = process.env.ELECTRON_APP_ROOT || process.cwd();
  const isElectron = !!process.env.ELECTRON_APP_ROOT;
  const daemonPath = isElectron
    ? path.join(appRoot, "dist-daemon", "robot.js")
    : [appRoot, "daemon", "robot.ts"].join(path.sep);

  try {
    const cleanEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (val === undefined) continue;
      if (key.startsWith("CLAUDE")) continue;
      if (key.startsWith("MCP")) continue;
      cleanEnv[key] = val;
    }
    cleanEnv.RELAY_URL = process.env.RELAY_URL || `http://localhost:${process.env.PORT || 3000}`;

    const daemonArgs = ["--code", pairingCode];
    if (dangerousMode) {
      daemonArgs.push("--dangerous");
    }

    const spawnArgs = isElectron
      ? [daemonPath, ...daemonArgs]
      : ["-r", "ts-node/register", daemonPath, ...daemonArgs];

    const daemon = spawn(
      process.execPath,
      spawnArgs,
      {
        cwd: appRoot,
        env: cleanEnv as NodeJS.ProcessEnv,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      }
    );

    global.__zecruRobotDaemon = daemon;

    daemon.stdout?.on("data", (data: Buffer) => {
      console.log(`  [robot] ${data.toString().trim()}`);
    });

    daemon.stderr?.on("data", (data: Buffer) => {
      console.error(`  [robot:err] ${data.toString().trim()}`);
    });

    daemon.on("close", (code) => {
      console.log(`  [robot] Exited with code ${code}`);
      global.__zecruRobotDaemon = null;
    });

    daemon.on("error", (err) => {
      console.error(`  [robot:error] ${err.message}`);
      global.__zecruRobotDaemon = null;
    });

    // Wait for daemon to connect to relay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return NextResponse.json({
      success: true,
      pid: daemon.pid,
      mode: "robot",
      message: "Robot daemon started",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Failed to start robot daemon: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
