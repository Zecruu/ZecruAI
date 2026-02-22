import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { evaluateMessage, evaluateResult } from "@/lib/overseer";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, projectName, phase, result, originalMessage } = await req.json();

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
  const evaluation = await evaluateMessage(apiKey, message, projectName || "Unknown");
  return NextResponse.json(evaluation);
}
