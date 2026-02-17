import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashPassword, setAuthCookie, generatePairingCode } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const db = await getDb();

    // Check if user exists
    const existing = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Generate unique pairing code
    let pairingCode = generatePairingCode();
    while (await db.collection("users").findOne({ pairingCode })) {
      pairingCode = generatePairingCode();
    }

    const passwordHash = await hashPassword(password);
    const result = await db.collection("users").insertOne({
      email: email.toLowerCase(),
      passwordHash,
      pairingCode,
      dangerousMode: false,
      createdAt: Date.now(),
    });

    await setAuthCookie(result.insertedId.toString());

    return NextResponse.json({
      user: {
        id: result.insertedId.toString(),
        email: email.toLowerCase(),
        pairingCode,
        dangerousMode: false,
      },
    });
  } catch (error: unknown) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
