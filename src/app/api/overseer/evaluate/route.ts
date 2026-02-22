import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { evaluateMessage, evaluateResult } from "@/lib/overseer";
import type { ProjectContext } from "@/types";

interface RoomState {
  daemon: { emit: (event: string, data: unknown, callback?: (response: Record<string, unknown>) => void) => void } | null;
  clients: Set<string>;
  workingDir?: string;
}

async function queryDaemonContext(pairingCode: string, projectId: string): Promise<ProjectContext | null> {
  const rooms = (global as Record<string, unknown>).__zecruRooms as Map<string, RoomState> | undefined;
  if (!rooms) return null;

  // Try project-specific room first (local mode), then base room (remote mode)
  const roomKeys = [`${pairingCode}-${projectId}`, pairingCode];
  let daemonSocket: RoomState["daemon"] = null;

  for (const key of roomKeys) {
    const room = rooms.get(key);
    if (room?.daemon) {
      daemonSocket = room.daemon;
      break;
    }
  }

  if (!daemonSocket) return null;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 5000);

    daemonSocket!.emit("daemon:query-context", {}, (response: Record<string, unknown>) => {
      clearTimeout(timeout);
      resolve(response as unknown as ProjectContext);
    });
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, projectName, phase, result, originalMessage, pairingCode, projectId } = await req.json();

  // Get the user's Anthropic API key from DB
  const db = await getDb();
  const dbUser = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
  const apiKey = dbUser?.anthropicApiKey;

  if (!apiKey) {
    return NextResponse.json({ error: "No Anthropic API key configured" }, { status: 400 });
  }

  if (phase === "post") {
    // Post-result evaluation
    if (!result || !originalMessage) {
      return NextResponse.json({ error: "result and originalMessage required for post phase" }, { status: 400 });
    }
    const evaluation = await evaluateResult(apiKey, result, projectName || "Unknown", originalMessage);
    return NextResponse.json(evaluation);
  }

  // Pre-message evaluation (default)
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // Query daemon for project context (gracefully degrade if unavailable)
  let projectContext: ProjectContext | null = null;
  if (pairingCode && projectId) {
    try {
      projectContext = await queryDaemonContext(pairingCode, projectId);
    } catch {
      // Daemon unreachable, proceed without context
    }
  }

  const evaluation = await evaluateMessage(apiKey, message, projectName || "Unknown", projectContext);
  return NextResponse.json(evaluation);
}
