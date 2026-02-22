import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { verifyToken as verifyVercel } from "@/lib/deploy/vercel";
import { verifyToken as verifyRailway } from "@/lib/deploy/railway";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    railway: user.hasRailwayToken || false,
    vercel: user.hasVercelToken || false,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, token } = await req.json();
  if (!provider || !token) {
    return NextResponse.json({ error: "provider and token required" }, { status: 400 });
  }
  if (provider !== "railway" && provider !== "vercel") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  // Verify the token works
  try {
    let verified: { name?: string; username?: string; email: string };
    if (provider === "vercel") {
      verified = await verifyVercel(token);
    } else {
      verified = await verifyRailway(token);
    }

    const db = await getDb();
    const field = provider === "vercel" ? "vercelToken" : "railwayToken";
    await db.collection("users").updateOne(
      { _id: new ObjectId(user.id) },
      { $set: { [field]: token } }
    );

    return NextResponse.json({ success: true, verified });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Token verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await req.json();
  if (provider !== "railway" && provider !== "vercel") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const db = await getDb();
  const field = provider === "vercel" ? "vercelToken" : "railwayToken";
  await db.collection("users").updateOne(
    { _id: new ObjectId(user.id) },
    { $unset: { [field]: "" } }
  );

  return NextResponse.json({ success: true });
}
