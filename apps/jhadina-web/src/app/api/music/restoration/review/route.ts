import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { reviewRestorationArtifact } from "@/lib/music/restoration-review-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const PRIVATE_JSON_HEADERS = { "Cache-Control": "private, no-store" };

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_JSON_HEADERS });
}

interface ReviewBody {
  caseId?: string;
  artifactId?: string;
  comparisonArtifactId?: string;
  decision?: "approved" | "rejected";
  note?: string;
}

export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) {
    return privateJson({ success: false, error: "Not signed in" }, 401);
  }

  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const body = await req.json() as ReviewBody;
    const caseId = body.caseId?.trim() ?? "";
    const artifactId = body.artifactId?.trim() ?? "";
    if (!caseId || !artifactId || (body.decision !== "approved" && body.decision !== "rejected")) {
      return privateJson({
        success: false,
        error: "caseId, artifactId and a valid review decision are required",
      }, 400);
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const result = await reviewRestorationArtifact({
      client,
      ownerUserId: identity.userId,
      caseId,
      artifactId,
      comparisonArtifactId: body.comparisonArtifactId?.trim() || undefined,
      decision: body.decision,
      note: body.note,
    });
    return privateJson({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restoration review failed";
    const status = /identity|session|signed in/i.test(message)
      ? 401
      : /NOT_FOUND|not found/i.test(message)
        ? 404
        : /QC_REQUIRED|SOURCE_CANNOT|VERIFIED_QC/i.test(message)
          ? 409
          : /NOT_CONFIGURED|not configured/i.test(message)
            ? 503
            : 422;
    return privateJson({ success: false, error: message }, status);
  }
}
