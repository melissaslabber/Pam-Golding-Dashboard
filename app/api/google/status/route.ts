import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const profileId =
    request.nextUrl.searchParams.get("profileId") || "";

  return NextResponse.json({
    connected: Boolean(profileId && (await readSession(profileId))),
  });
}
