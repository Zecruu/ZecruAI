import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { validateApiKey } from "@/lib/overseer";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ hasKey: user.hasAnthropicKey || false });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey } = await req.json();
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey required" }, { status: 400 });
  }

  // Validate the key by making a test call
  const valid = await validateApiKey(apiKey);
  if (!valid) {
    return NextResponse.json({ error: "Invalid API key — verification call failed" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(user.id) },
    { $set: { anthropicApiKey: apiKey } }
  );

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(user.id) },
    { $unset: { anthropicApiKey: "" } }
  );

  return NextResponse.json({ success: true });
}
