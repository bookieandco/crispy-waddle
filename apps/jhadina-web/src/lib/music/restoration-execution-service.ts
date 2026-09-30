import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authorizeCompiledRestorationPlan,
  executeVerifiedRestoration,
  evaluateRestorationGate,
  RestorationProvenanceLedger,
  RuntimeRestorationArtifactWriter,
  type MusicDirectorJudgment,
  type RestorationCandidate,
  type RestorationPlan,
  type RestorationQcResult,
} from "@jhadina/music-core";
import { createRequestMusicRestorationRuntimeClient } from "./restoration-runtime-server";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

export interface GovernedRestorationExecutionInput {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  sourceArtifactId: string;
  plan: RestorationPlan;
  candidateId: string;
  judgment: MusicDirectorJudgment;
  qc: RestorationQcResult;
  humanApproved?: boolean;
}

function candidateFor(plan: RestorationPlan, candidateId: string): RestorationCandidate {
  const candidate = plan.candidates.find(item => item.id === candidateId);
  if (!candidate) throw new Error("MUSIC_RESTORATION_CANDIDATE_NOT_FOUND");
  return candidate;
}

/**
 * Server-only MUSIC-RESTORE.4 boundary.
 *
 * Callers cannot submit an "authorized" boolean. The existing deterministic
 * plan gate and Director judgment are recomposed here, then the verified
 * execution envelope controls whether the durable worker output is promoted.
 */
export async function executeGovernedRestoration(input: GovernedRestorationExecutionInput) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const source = await store.get(input.ownerUserId, input.sourceArtifactId);
  if (!source || source.caseId !== input.caseId) {
    throw new Error("MUSIC_RESTORATION_SOURCE_NOT_FOUND");
  }
  if (input.plan.caseId !== input.caseId) {
    throw new Error("MUSIC_RESTORATION_PLAN_CASE_MISMATCH");
  }

  const candidate = candidateFor(input.plan, input.candidateId);
  if (candidate.inputArtifactId !== source.id) {
    throw new Error("MUSIC_RESTORATION_CANDIDATE_SOURCE_MISMATCH");
  }

  const gate = evaluateRestorationGate(input.plan, input.candidateId, input.qc);
  const authorization = authorizeCompiledRestorationPlan({
    plan: input.plan,
    candidateId: input.candidateId,
    judgment: input.judgment,
    qc: input.qc,
    humanApproved: input.humanApproved,
  });
  if (!authorization.authorized) {
    throw new Error(`MUSIC_RESTORATION_EXECUTION_DENIED: ${authorization.reasons.join(" ")}`);
  }

  const executionId = `music-repair:${globalThis.crypto.randomUUID()}`;
  await store.createJob({
    id: executionId,
    caseId: input.caseId,
    kind: "repair",
    sourceArtifactId: source.id,
    metadata: {
      planId: input.plan.id,
      candidateId: candidate.id,
      authorizationId: authorization.id,
    },
  });

  try {
    const ledger = new RestorationProvenanceLedger();
    ledger.registerArtifact(source);
    const writer = new RuntimeRestorationArtifactWriter({
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      executionId,
      candidate,
      source,
      runtime,
      store,
    });
    const result = await executeVerifiedRestoration({
      executionId,
      authorization,
      plan: input.plan,
      candidate,
      ledger,
      writer,
      gate,
      qc: input.qc,
      createdAt: new Date().toISOString(),
    });

    if (result.status !== "completed") {
      await store.persistExecutionOutcome({
        caseId: input.caseId,
        receipt: result.receipt,
      });
      await store.failJob(executionId, result.receipt.reasons.join(" ") || "Restoration execution failed");
      return { authorization, ...result };
    }

    await store.persistExecutionOutcome({
      caseId: input.caseId,
      receipt: result.receipt,
      version: result.version,
    });
    await store.completeJob({
      id: executionId,
      outputArtifactIds: result.artifact ? [result.artifact.id] : [],
      runtimeReceiptId: result.artifact && "runtimeReceiptId" in result.artifact
        ? String(result.artifact.runtimeReceiptId ?? "")
        : result.receipt.id,
      metadata: {
        authorizationId: authorization.id,
        qcReceiptId: result.receipt.id,
        versionId: result.version?.id ?? null,
        hashVerified: result.receipt.hashVerified,
        promoted: Boolean(result.version),
      },
    });
    return { authorization, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Music restoration execution failed";
    await store.failJob(executionId, message);
    throw error;
  }
}
