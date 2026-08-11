import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  // Authentication and concrete repository/event-bus adapters are injected here next.
  // Do not persist or publish from the route itself; the API must call Staffing Core.
  return NextResponse.json({
    error: "Staffing API adapter not configured",
    received: body,
  }, { status: 501 });
}
