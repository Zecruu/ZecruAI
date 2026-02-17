import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    pairingCode: user.pairingCode,
    dangerousMode: user.dangerousMode,
    email: user.email,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updates = await req.json();
  const db = await getDb();

  const setFields: Record<string, unknown> = {};
  if (updates.dangerousMode !== undefined) setFields.dangerousMode = updates.dangerousMode;

  if (Object.keys(setFields).length > 0) {
    await db.collection("users").updateOne(
      { _id: new ObjectId(user.id) },
      { $set: setFields }
    );
  }

  return NextResponse.json({ success: true });
}
