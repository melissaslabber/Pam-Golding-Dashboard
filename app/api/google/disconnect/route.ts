import { NextResponse } from "next/server";
import { clearSession } from "@/lib/google-calendar";

export async function POST() {
  await clearSession();

  return NextResponse.json({
    connected: false,
  });
}
