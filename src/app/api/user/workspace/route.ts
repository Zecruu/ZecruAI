import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const dbUser = await db.collection("users").findOne({ _id: new ObjectId(user.id) });

  return NextResponse.json({
    workspaceRoot: dbUser?.workspaceRoot || null,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceRoot } = await req.json();
  const db = await getDb();

  await db.collection("users").updateOne(
    { _id: new ObjectId(user.id) },
    { $set: { workspaceRoot: workspaceRoot || null } }
  );

  return NextResponse.json({ success: true, workspaceRoot });
}
