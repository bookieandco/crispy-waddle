import { NextRequest, NextResponse } from "next/server";
import type { VocalRepairSegment } from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { runVocalRestoration } from "@/lib/music/restoration-vocal-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

interface VocalRestoreBody {
  caseId?: string;
  sourceArtifactId?: string;
  segments?: VocalRepairSegment[];
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
    if (!caseId || !sourceArtifactId) {
      return NextResponse.json({
        success: false,
        error: "caseId and sourceArtifactId are required",
      }, { status: 400 });
    }
    if (!Array.isArray(body.segments) || !body.segments.length) {
      return NextResponse.json({
        success: false,
        error: "at least one vocal restoration segment is required",
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
      segments: body.segments,
      evidenceIds: Array.isArray(body.evidenceIds) ? body.evidenceIds.map(String) : [],
      approved: true,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      restoration: {
        requestId: result.request.requestId,
        sourceArtifactId: result.request.sourceArtifactId,
        segments: result.request.segments,
        approval: result.request.approval,
        outputArtifactId: result.result.storedArtifact.id,
        outputSha256: result.result.storedArtifact.contentHash,
        runtimeReceiptId: result.result.runtimeReceipt.runtimeReceiptId,
        preservation: result.result.runtimeReceipt.preservation,
        qc: result.result.qc,
        requiresAudition: true,
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
          : /NOT_CONFIGURED|not configured/i.test(message)
            ? 503
            : 422;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
