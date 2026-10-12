import { NextResponse } from "next/server";
import { MusicInputError } from "./music-catalog-operations";
import { MusicAuthRequiredError, MusicBackendUnavailableError } from "./music-request-scope";

export function musicRouteError(error: unknown) {
  if (error instanceof MusicInputError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  if (error instanceof MusicAuthRequiredError) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  if (error instanceof MusicBackendUnavailableError) return NextResponse.json({ success: false, error: "Music service temporarily unavailable" }, { status: 503 });
  // Do not leak SQL, auth claims, signed URLs, or storage/provider internals to clients.
  return NextResponse.json({ success: false, error: "Music service unavailable" }, { status: 503 });
}
