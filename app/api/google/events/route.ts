import { NextRequest, NextResponse } from "next/server";
import { googleRequest } from "@/lib/google-calendar";

const profile = (request: NextRequest) =>
  request.headers.get("x-profile-id") || "";

const fail = (error: unknown) =>
  NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Google Calendar request failed.",
    },
    { status: 400 },
  );

export async function GET(request: NextRequest) {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 45);

    const query = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      timeZone: "Africa/Johannesburg",
    });

    const result = await googleRequest(
      profile(request),
      `/calendars/primary/events?${query}`,
    );

    return NextResponse.json({
      events: result.items || [],
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = await googleRequest(
      profile(request),
      "/calendars/primary/events",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const eventId = encodeURIComponent(body.eventId);
    delete body.eventId;

    const result = await googleRequest(
      profile(request),
      `/calendars/primary/events/${eventId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const eventId = encodeURIComponent(
      request.nextUrl.searchParams.get("eventId") || "",
    );

    await googleRequest(
      profile(request),
      `/calendars/primary/events/${eventId}`,
      { method: "DELETE" },
    );

    return NextResponse.json({
      deleted: true,
    });
  } catch (error) {
    return fail(error);
  }
}
