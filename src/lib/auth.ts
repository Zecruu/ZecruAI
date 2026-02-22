import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { getDb } from "./mongodb";

function getJwtSecret(): string {
  return process.env.JWT_SECRET || "dev-secret-change-in-production";
}

const COOKIE_NAME = "zecru-token";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { userId: string };
  } catch {
    return null;
  }
}

export async function setAuthCookie(userId: string) {
  const token = signToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(payload.userId) },
      { projection: { passwordHash: 0 } }
    );

    if (!user) return null;

    return {
      id: user._id.toString(),
      email: user.email,
      pairingCode: user.pairingCode,
      dangerousMode: user.dangerousMode || false,
      createdAt: user.createdAt,
      hasRailwayToken: !!user.railwayToken,
      hasVercelToken: !!user.vercelToken,
      hasAnthropicKey: !!user.anthropicApiKey,
      overseerEnabled: user.overseerEnabled || false,
    };
  } catch {
    return null;
  }
}

export function generatePairingCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
