import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { runPersistedInstrumentMidi } from "@/lib/music/restoration-midi-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const claimedUserId = request.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) return reply({ success: false, error: "Not signed in" }, 401);
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const body = await request.json() as { caseId?: unknown; parentArtifactId?: unknown };
    const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
    const parentArtifactId = typeof body.parentArtifactId === "string" ? body.parentArtifactId.trim() : "";
    if (!caseId || !parentArtifactId || caseId.length > 240 || parentArtifactId.length > 240) {
      return reply({ success: false, error: "Valid caseId and parentArtifactId are required" }, 400);
    }
    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const result = await runPersistedInstrumentMidi({
      client, ownerUserId: identity.userId, caseId, parentArtifactId,
    });
    return reply({ success: true, ...result }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "MIDI conversion unavailable";
    const status = /identity|session|signed in/i.test(message) ? 401
      : /NOT_FOUND/.test(message) ? 404
      : /ALREADY_TRANSCRIBED/.test(message) ? 409
      : /NOT_CONFIGURED|NOT_INSTALLED|NOT_ENABLED|UNAVAILABLE|not commissioned/.test(message) ? 503
      : 422;
    return reply({ success: false, error: message }, status);
  }
}
