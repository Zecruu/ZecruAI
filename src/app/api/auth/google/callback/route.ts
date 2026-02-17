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
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const errorParam = req.nextUrl.searchParams.get("error");
  const origin = getOrigin(req);

  console.log(`[google callback] origin=${origin} code=${code ? "present" : "missing"} error=${errorParam || "none"}`);

  if (errorParam || !code) {
    return NextResponse.redirect(`${origin}/login?error=google_denied`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?error=google_not_configured`);
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  console.log(`[google callback] Exchanging code, redirect_uri=${redirectUri}`);

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

    const tokenBody = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error(`[google callback] Token exchange failed:`, JSON.stringify(tokenBody));
      return NextResponse.redirect(`${origin}/login?error=google_token_failed`);
    }

    const tokens: GoogleTokenResponse = tokenBody;

    // Get user info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      console.error(`[google callback] Userinfo failed: ${userRes.status}`);
      return NextResponse.redirect(`${origin}/login?error=google_userinfo_failed`);
    }

    const googleUser: GoogleUserInfo = await userRes.json();
    console.log(`[google callback] Got user: ${googleUser.email}`);

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
        passwordHash: null,
        googleId: googleUser.email,
        pairingCode,
        dangerousMode: false,
        createdAt: Date.now(),
      });

      user = { _id: result.insertedId, email, pairingCode };
      console.log(`[google callback] Created new user: ${email}`);
    } else {
      console.log(`[google callback] Existing user: ${email}`);
    }

    // Set auth cookie and redirect to app
    await setAuthCookie(user._id.toString());

    return NextResponse.redirect(`${origin}/`);
  } catch (err) {
    console.error(`[google callback] Error:`, err);
    return NextResponse.redirect(`${origin}/login?error=google_failed`);
  }
}
