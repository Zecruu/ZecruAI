import { NextRequest, NextResponse } from "next/server";

function getOrigin(req: NextRequest): string {
  // Railway/proxies may send comma-separated values like "https,http"
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }

  const origin = getOrigin(req);
  const redirectUri = `${origin}/api/auth/google/callback`;

  console.log(`[google] Redirecting to Google OAuth, redirect_uri=${redirectUri}`);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
