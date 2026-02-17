import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { setAuthCookie, generatePairingCode } from "@/lib/auth";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

function getOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const origin = getOrigin(req);

  if (error || !code) {
    return NextResponse.redirect(`${origin}/login?error=google_denied`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?error=google_not_configured`);
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${origin}/login?error=google_token_failed`);
    }

    const tokens: GoogleTokenResponse = await tokenRes.json();

    // Get user info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${origin}/login?error=google_userinfo_failed`);
    }

    const googleUser: GoogleUserInfo = await userRes.json();

    if (!googleUser.email) {
      return NextResponse.redirect(`${origin}/login?error=google_no_email`);
    }

    const db = await getDb();
    const email = googleUser.email.toLowerCase();

    // Find existing user or create new one
    let user = await db.collection("users").findOne({ email });

    if (!user) {
      // Generate unique pairing code
      let pairingCode = generatePairingCode();
      while (await db.collection("users").findOne({ pairingCode })) {
        pairingCode = generatePairingCode();
      }

      const result = await db.collection("users").insertOne({
        email,
        passwordHash: null, // Google users don't have a password
        googleId: googleUser.email,
        pairingCode,
        dangerousMode: false,
        createdAt: Date.now(),
      });

      user = { _id: result.insertedId, email, pairingCode };
    }

    // Set auth cookie and redirect to app
    await setAuthCookie(user._id.toString());

    return NextResponse.redirect(`${origin}/`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=google_failed`);
  }
}
