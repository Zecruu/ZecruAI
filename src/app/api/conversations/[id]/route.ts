import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const conversation = await db.collection("conversations").findOne({
    _id: new ObjectId(id),
    userId: user.id,
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({
    conversation: {
      id: conversation._id.toString(),
      title: conversation.title,
      summary: conversation.summary,
      mode: conversation.mode,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      sessionId: conversation.sessionId,
      projectId: conversation.projectId,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const updates = await req.json();
  const db = await getDb();

  const setFields: Record<string, unknown> = { updatedAt: Date.now() };
  if (updates.title !== undefined) setFields.title = updates.title;
  if (updates.summary !== undefined) setFields.summary = updates.summary;
  if (updates.messages !== undefined) setFields.messages = updates.messages;
  if (updates.sessionId !== undefined) setFields.sessionId = updates.sessionId;
  if (updates.mode !== undefined) setFields.mode = updates.mode;

  const result = await db.collection("conversations").updateOne(
    { _id: new ObjectId(id), userId: user.id },
    { $set: setFields }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  await db.collection("conversations").deleteOne({
    _id: new ObjectId(id),
    userId: user.id,
  });

  return NextResponse.json({ success: true });
}
