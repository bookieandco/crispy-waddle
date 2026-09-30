import { NextRequest, NextResponse } from "next/server";
import type {
  InstrumentDonorEventKind,
  InstrumentDonorFamily,
} from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { runInstrumentDonorSearch } from "@/lib/music/restoration-donor-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

interface DonorSearchBody {
  caseId?: string;
  sourceArtifactId?: string;
  instrumentFamily?: InstrumentDonorFamily;
  eventKind?: InstrumentDonorEventKind;
  targetStartMs?: number;
  targetEndMs?: number;
  maxCandidates?: number;
}

export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }

  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const body = await req.json() as DonorSearchBody;
    const caseId = body.caseId?.trim() ?? "";
    const sourceArtifactId = body.sourceArtifactId?.trim() ?? "";
    if (!caseId || !sourceArtifactId || !body.instrumentFamily) {
      return NextResponse.json({
        success: false,
        error: "caseId, sourceArtifactId and instrumentFamily are required",
      }, { status: 400 });
    }
    if (!Number.isFinite(body.targetStartMs) || !Number.isFinite(body.targetEndMs)) {
      return NextResponse.json({
        success: false,
        error: "targetStartMs and targetEndMs are required",
      }, { status: 400 });
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const result = await runInstrumentDonorSearch({
      client,
      ownerUserId: identity.userId,
      caseId,
      sourceArtifactId,
      instrumentFamily: body.instrumentFamily,
      eventKind: body.eventKind,
      targetStartMs: Number(body.targetStartMs),
      targetEndMs: Number(body.targetEndMs),
      maxCandidates: body.maxCandidates,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      sourceArtifactId: result.sourceArtifactId,
      runtimeReceiptId: result.runtimeReceiptId,
      authority: "EVIDENCE_ONLY",
      candidates: result.candidates.map(candidate => ({
        candidateId: candidate.candidateId,
        artifactId: candidate.artifactId,
        sourceStartMs: candidate.sourceStartMs,
        sourceEndMs: candidate.sourceEndMs,
        similarityScore: candidate.similarityScore,
        qualityScore: candidate.qualityScore,
        contextScore: candidate.contextScore,
        searchScore: candidate.searchScore,
        damageScore: candidate.damageScore,
        expectedGain: candidate.expectedGain,
        sha256: candidate.artifact.contentHash,
        role: candidate.artifact.role,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instrument donor search failed";
    const status = /identity|session|signed in/i.test(message)
      ? 401
      : /NOT_FOUND|not found/i.test(message)
        ? 404
        : /NOT_CONFIGURED|not configured|RUNTIME_UNAVAILABLE/i.test(message)
          ? 503
          : 422;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
