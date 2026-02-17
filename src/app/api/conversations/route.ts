import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const db = await getDb();

  const filter: Record<string, string> = { userId: user.id };
  if (projectId) filter.projectId = projectId;

  const conversations = await db
    .collection("conversations")
    .find(filter)
    .sort({ updatedAt: -1 })
    .toArray();

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      summary: c.summary,
      mode: c.mode,
      messages: c.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      sessionId: c.sessionId,
      projectId: c.projectId,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = await getDb();

  const now = Date.now();
  const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000); // 7 days
  const conversation = {
    _id: new ObjectId(),
    userId: user.id,
    projectId: body.projectId || null,
    title: body.title || "New Conversation",
    summary: body.summary || "",
    mode: body.mode || "developer",
    messages: body.messages || [],
    sessionId: body.sessionId || null,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  await db.collection("conversations").insertOne(conversation);

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
