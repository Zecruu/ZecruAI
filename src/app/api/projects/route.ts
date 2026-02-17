import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const projects = await db
    .collection("projects")
    .find({ userId: user.id })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      workingDirectory: p.workingDirectory,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, workingDirectory } = await req.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const db = await getDb();
  const result = await db.collection("projects").insertOne({
    _id: new ObjectId(),
    userId: user.id,
    name,
    workingDirectory: workingDirectory || "",
    createdAt: Date.now(),
  });

  return NextResponse.json({
    project: {
      id: result.insertedId.toString(),
      name,
      workingDirectory: workingDirectory || "",
      createdAt: Date.now(),
    },
  });
}
