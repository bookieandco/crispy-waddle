import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { runPersistedDeepDrums } from "@/lib/music/restoration-deep-stems-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) return json({ success: false, error: "Not signed in" }, 401);
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const body = await req.json() as { caseId?: unknown; parentArtifactId?: unknown };
    const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
    const parentArtifactId = typeof body.parentArtifactId === "string" ? body.parentArtifactId.trim() : "";
    if (!caseId || !parentArtifactId || caseId.length > 240 || parentArtifactId.length > 240) {
      return json({ success: false, error: "A valid caseId and parentArtifactId are required" }, 400);
    }
    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const result = await runPersistedDeepDrums({
      client, ownerUserId: identity.userId, caseId, parentArtifactId,
    });
    return json({ success: true, ...result }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deep drum separation unavailable";
    const status = /identity|session|signed in/i.test(message) ? 401
      : /NOT_FOUND/i.test(message) ? 404
      : /ALREADY_EXTRACTED/i.test(message) ? 409
      : /NOT_CONFIGURED|NOT_INSTALLED|UNAVAILABLE|not commissioned/i.test(message) ? 503
      : 422;
    return json({ success: false, error: message }, status);
  }
}
