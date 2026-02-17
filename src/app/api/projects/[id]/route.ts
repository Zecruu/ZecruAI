import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const updates = await req.json();
  const db = await getDb();

  const result = await db.collection("projects").updateOne(
    { _id: new ObjectId(id), userId: user.id },
    { $set: { name: updates.name, workingDirectory: updates.workingDirectory } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  // Delete project and its conversations
  await db.collection("conversations").deleteMany({ projectId: id, userId: user.id });
  await db.collection("projects").deleteOne({ _id: new ObjectId(id), userId: user.id });

  return NextResponse.json({ success: true });
}
