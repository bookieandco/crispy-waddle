import { NextResponse } from "next/server";

/**
 * PlacementOS server route boundary.
 *
 * Deliberately refuses to execute until the deployment supplies the real
 * authenticated composition. This prevents an unauthenticated browser request
 * from becoming a privileged staffing mutation.
 */
export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const configured = process.env.PLACEMENTOS_COMMANDS_ENABLED === "true";

  if (!configured) {
    return NextResponse.json(
      {
        error: "PLACEMENT_COMMAND_NOT_CONFIGURED",
        message: "PlacementOS server composition is not enabled in this deployment.",
        requestId,
      },
      { status: 503, headers: { "x-request-id": requestId } },
    );
  }

  // The production composition is intentionally injected here only after the
  // app's authenticated Supabase/Jhadina context is available. Never accept
  // userId, organizationId, role, or authorization claims from request JSON.
  return NextResponse.json(
    {
      error: "PLACEMENT_COMMAND_COMPOSITION_MISSING",
      message: "Authenticated PlacementOS composition must be supplied by the deployment adapter.",
      requestId,
    },
    { status: 503, headers: { "x-request-id": requestId } },
  );
}
