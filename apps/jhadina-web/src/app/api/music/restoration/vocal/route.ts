import { NextRequest, NextResponse } from "next/server";
import type { VocalRestorationProfile } from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { runVocalRestoration } from "@/lib/music/restoration-vocal-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

interface VocalRestoreBody {
  caseId?: string;
  sourceArtifactId?: string;
  profile?: VocalRestorationProfile;
  evidenceIds?: string[];
  approved?: boolean;
}

export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }

  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const body = await req.json() as VocalRestoreBody;
    const caseId = body.caseId?.trim() ?? "";
    const sourceArtifactId = body.sourceArtifactId?.trim() ?? "";
    if (!caseId || !sourceArtifactId || !body.profile) {
      return NextResponse.json({
        success: false,
        error: "caseId, sourceArtifactId and profile are required",
      }, { status: 400 });
    }
    if (body.approved !== true) {
      return NextResponse.json({
        success: false,
        error: "Explicit human approval is required before vocal restoration",
      }, { status: 409 });
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const result = await runVocalRestoration({
      client,
      ownerUserId: identity.userId,
      caseId,
      sourceArtifactId,
      profile: body.profile,
      evidenceIds: Array.isArray(body.evidenceIds) ? body.evidenceIds.map(String) : [],
      approved: true,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      vocalRestoration: {
        requestId: result.request.requestId,
        sourceArtifactId: result.request.sourceArtifactId,
        outputArtifactId: result.result.storedArtifact.id,
        outputSha256: result.result.storedArtifact.contentHash,
        runtimeReceiptId: result.result.runtimeReceipt.runtimeReceiptId,
        identity: result.result.runtimeReceipt.comparison,
        qc: result.result.qc,
        requiresAudition: true,
        directorReadyVocalStem: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vocal restoration failed";
    const status = /identity|session|signed in/i.test(message)
      ? 401
      : /NOT_FOUND|not found/i.test(message)
        ? 404
        : /EXPLICIT_APPROVAL|approval/i.test(message)
          ? 409
          : /VOCAL_STEM_REQUIRED/i.test(message)
            ? 422
            : /NOT_CONFIGURED|not configured/i.test(message)
              ? 503
              : 422;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
