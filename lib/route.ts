import { NextRequest, NextResponse } from "next/server";
import { consumeState, googleClientId, googleRedirectUri, saveSession } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") || "";
  const code = request.nextUrl.searchParams.get("code") || "";
  const profileId = await consumeState(state);
  if (!profileId || !code) return NextResponse.redirect(new URL("/?google=error", request.url));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: googleClientId(), client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: googleRedirectUri(request.nextUrl.origin), grant_type: "authorization_code" }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) return NextResponse.redirect(new URL("/?google=error", request.url));
  await saveSession({ accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000, profileId });
  return NextResponse.redirect(new URL("/?google=connected", request.url));
}
