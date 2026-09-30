import { NextRequest, NextResponse } from "next/server";
import type {
  InstrumentFamily,
  ReconstructionSegment,
} from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { runInstrumentReconstruction } from "@/lib/music/restoration-reconstruction-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

interface ReconstructBody {
  caseId?: string;
  sourceArtifactId?: string;
  replacementArtifactId?: string;
  instrumentFamily?: InstrumentFamily;
  segments?: ReconstructionSegment[];
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
    const body = await req.json() as ReconstructBody;
    const caseId = body.caseId?.trim() ?? "";
    const sourceArtifactId = body.sourceArtifactId?.trim() ?? "";
    const replacementArtifactId = body.replacementArtifactId?.trim() ?? "";
    if (!caseId || !sourceArtifactId || !replacementArtifactId) {
      return NextResponse.json({
        success: false,
        error: "caseId, sourceArtifactId and replacementArtifactId are required",
      }, { status: 400 });
    }
    if (!body.instrumentFamily || !Array.isArray(body.segments) || !body.segments.length) {
      return NextResponse.json({
        success: false,
        error: "instrumentFamily and segments are required",
      }, { status: 400 });
    }
    if (body.approved !== true) {
      return NextResponse.json({
        success: false,
        error: "Explicit human approval is required before instrument reconstruction",
      }, { status: 409 });
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const result = await runInstrumentReconstruction({
      client,
      ownerUserId: identity.userId,
      caseId,
      sourceArtifactId,
      replacementArtifactId,
      instrumentFamily: body.instrumentFamily,
      segments: body.segments,
      evidenceIds: Array.isArray(body.evidenceIds) ? body.evidenceIds.map(String) : [],
      approved: true,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      decision: result.decision,
      assessment: {
        runtimeReceiptId: result.assessment.runtimeReceiptId,
        observedFingerprint: result.assessment.observedFingerprint,
        replacementFingerprint: result.assessment.replacementFingerprint,
        gainEvidence: result.assessment.gainEvidence,
        diagnostics: result.assessment.diagnostics,
      },
      reconstruction: {
        requestId: result.request.requestId,
        sourceArtifactId: result.request.sourceArtifactId,
        replacementArtifactId: result.request.replacementArtifactId,
        instrumentFamily: result.request.instrumentFamily,
        segments: result.request.segments,
        approval: result.request.approval,
        outputArtifactId: result.result.storedArtifact.id,
        outputSha256: result.result.storedArtifact.contentHash,
        runtimeReceiptId: result.result.runtimeReceipt.runtimeReceiptId,
        qc: result.result.qc,
        requiresAudition: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instrument reconstruction failed";
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
