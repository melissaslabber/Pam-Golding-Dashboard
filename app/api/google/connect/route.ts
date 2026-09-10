import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  googleClientId,
  googleRedirectUri,
  saveState,
} from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const profileId =
    request.nextUrl.searchParams.get("profileId") || "local-profile";
  const state = crypto.randomBytes(24).toString("base64url");

  await saveState(state, profileId);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: googleRedirectUri(request.nextUrl.origin),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    state,
    scope: "https://www.googleapis.com/auth/calendar.events",
  }).toString();

  return NextResponse.redirect(url);
}
