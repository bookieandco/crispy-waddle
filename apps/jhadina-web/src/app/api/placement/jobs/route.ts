import { NextResponse } from "next/server";

/**
 * Thin HTTP boundary for the first PlacementOS command.
 * The application wiring is intentionally kept behind a composition root so
 * authentication, authorization, persistence, and policy cannot be bypassed
 * by the browser.
 */
export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  return NextResponse.json(
    {
      error: "PLACEMENT_COMMAND_NOT_WIRED",
      message: "PlacementOS command composition is not configured in this deployment yet.",
      requestId,
    },
    { status: 501, headers: { "x-request-id": requestId } },
  );
}
