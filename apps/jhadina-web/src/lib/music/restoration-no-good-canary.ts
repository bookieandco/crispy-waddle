import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_RESTORATION_SOURCE_BYTES,
  RestorationProvenanceLedger,
  RuntimeRestorationArtifactWriter,
  analyzeMixTranslationQc,
  analyzeRestorationSourceRecovery,
  analyzeStemIntegritySweep,
  analyzeVocalIntelligence,
  authorizeRestorationTrialRender,
  evaluateConservativeCanaryQc,
  ingestRestorationSource,
  promoteMeasuredRestorationTrial,
  renderRestorationTrial,
  selectConservativeCanaryCandidate,
  sha256Hex,
  type EvidenceObservation,
  type RestorationPlan,
  type StoredRestorationArtifact,
} from "@jhadina/music-core";
import { analyzeRestorationArtifact } from "./restoration-analysis-service";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";
import {
  MUSIC_RESTORATION_BUCKET,
  SupabaseMusicRestorationArtifactStore,
} from "./restoration-supabase-store";

export const NO_GOOD_BENCHMARK = Object.freeze({
  id: "MUSIC-RESTORE.AB-001",
  title: "No Good",
  repository: "bookieandco/music-restoration-intelligence",
  repositoryId: "1320611836",
  repositoryOwner: "bookieandco",
  repositoryOwnerId: "289295074",
  sourceCommit: "d282ec4994a821e02c0b3a93082630aea549114e",
  sourcePath: "No good.mp3",
  sourceMimeType: "audio/mpeg",
  workflowRef:
    "bookieandco/music-restoration-intelligence/.github/workflows/no-good-production-canary.yml@refs/heads/main",
  workflowAudience: "jhadina-music-restoration-canary",
  ref: "refs/heads/main",
} as const);

const STAGING_PREFIX = "_canary-staging/no-good/";
const HEX_64 = /^[a-f0-9]{64}$/i;

function safePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "run";
}

function exactProvenance(input: {
  repository?: string;
  sourceCommit?: string;
  sourcePath?: string;
}): void {
  if (input.repository !== NO_GOOD_BENCHMARK.repository) {
    throw new Error("MUSIC_RESTORATION_CANARY_REPOSITORY_MISMATCH");
  }
  if (input.sourceCommit !== NO_GOOD_BENCHMARK.sourceCommit) {
    throw new Error("MUSIC_RESTORATION_CANARY_SOURCE_COMMIT_MISMATCH");
  }
  if (input.sourcePath !== NO_GOOD_BENCHMARK.sourcePath) {
    throw new Error("MUSIC_RESTORATION_CANARY_SOURCE_PATH_MISMATCH");
  }
}

function assertStagingPath(path: string): void {
  if (!path.startsWith(STAGING_PREFIX) || path.includes("..") || path.includes("\\")) {
    throw new Error("MUSIC_RESTORATION_CANARY_STAGING_PATH_INVALID");
  }
}

async function resolveCanonicalAtwoodBookieOwner(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from("jhadina_music_projects")
    .select("user_id")
    .eq("artist_key", "atwood-bookie")
    .limit(2);
  if (error) throw new Error(`MUSIC_RESTORATION_CANARY_OWNER_LOOKUP_FAILED: ${error.message}`);
  const ownerIds = [...new Set((data ?? []).map((row) => String(row.user_id ?? "")).filter(Boolean))];
  if (ownerIds.length !== 1) {
    throw new Error(
      ownerIds.length === 0
        ? "MUSIC_RESTORATION_CANARY_CANONICAL_OWNER_MISSING"
        : "MUSIC_RESTORATION_CANARY_CANONICAL_OWNER_AMBIGUOUS",
    );
  }
  return ownerIds[0]!;
}

export async function prepareNoGoodCanaryUpload(input: {
  client: SupabaseClient;
  runId: string;
}) {
  const runId = safePart(input.runId);
  const stagingPath =
    `${STAGING_PREFIX}${runId}-${globalThis.crypto.randomUUID()}.mp3`;
  const { data, error } = await input.client.storage
    .from(MUSIC_RESTORATION_BUCKET)
    .createSignedUploadUrl(stagingPath);
  if (error || !data?.signedUrl) {
    throw new Error(
      `MUSIC_RESTORATION_CANARY_SIGNED_UPLOAD_FAILED: ${error?.message ?? "missing signed URL"}`,
    );
  }
  return {
    benchmarkId: NO_GOOD_BENCHMARK.id,
    stagingPath,
    signedUploadUrl: data.signedUrl,
    sourceCommit: NO_GOOD_BENCHMARK.sourceCommit,
    sourcePath: NO_GOOD_BENCHMARK.sourcePath,
  };
}

async function stagedBytes(input: {
  client: SupabaseClient;
  stagingPath: string;
  expectedSha256: string;
  expectedSizeBytes: number;
}): Promise<Uint8Array> {
  assertStagingPath(input.stagingPath);
  if (!HEX_64.test(input.expectedSha256)) {
    throw new Error("MUSIC_RESTORATION_CANARY_SHA256_INVALID");
  }
  if (
    !Number.isSafeInteger(input.expectedSizeBytes) ||
    input.expectedSizeBytes <= 0 ||
    input.expectedSizeBytes > MAX_RESTORATION_SOURCE_BYTES
  ) {
    throw new Error("MUSIC_RESTORATION_CANARY_SIZE_INVALID");
  }

  const { data, error } = await input.client.storage
    .from(MUSIC_RESTORATION_BUCKET)
    .download(input.stagingPath);
  if (error || !data) {
    throw new Error(
      `MUSIC_RESTORATION_CANARY_STAGING_DOWNLOAD_FAILED: ${error?.message ?? "missing bytes"}`,
    );
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength !== input.expectedSizeBytes) {
    throw new Error("MUSIC_RESTORATION_CANARY_STAGING_SIZE_MISMATCH");
  }
  const digest = await sha256Hex(bytes);
  if (digest.toLowerCase() !== input.expectedSha256.toLowerCase()) {
    throw new Error("MUSIC_RESTORATION_CANARY_STAGING_HASH_MISMATCH");
  }
  return bytes;
}

async function persistEvidence(
  store: SupabaseMusicRestorationArtifactStore,
  caseId: string,
  artifactId: string,
  observations: readonly EvidenceObservation[],
  runtimeReceiptId?: string,
): Promise<void> {
  await store.persistEvidence({
    caseId,
    artifactId,
    observations: observations.map((item) => ({
      ...item,
      data: { ...item.data },
    })),
    runtimeReceiptId,
  });
}

function requiredStems(artifacts: StoredRestorationArtifact[]): StoredRestorationArtifact[] {
  const roles = ["vocals", "drums", "bass", "other"] as const;
  return roles.map((role) => {
    const artifact = artifacts.find((item) => item.role === role);
    if (!artifact) throw new Error(`MUSIC_RESTORATION_CANARY_STEM_MISSING:${role}`);
    return artifact;
  });
}

export interface NoGoodCanaryExecutionInput {
  client: SupabaseClient;
  runId: string;
  stagingPath: string;
  expectedSha256: string;
  expectedSizeBytes: number;
  repository: string;
  sourceCommit: string;
  sourcePath: string;
}

export async function runNoGoodProductionCanary(input: NoGoodCanaryExecutionInput) {
  exactProvenance(input);
  assertStagingPath(input.stagingPath);
  const ownerUserId = await resolveCanonicalAtwoodBookieOwner(input.client);
  const bytes = await stagedBytes(input);
  const runtime = await createMusicRestorationRuntimeClient();
  const caseId =
    `music-restoration:canary:no-good:${safePart(input.runId)}:${globalThis.crypto.randomUUID()}`;
  const store = new SupabaseMusicRestorationArtifactStore(input.client, ownerUserId);

  try {
    const ingested = await ingestRestorationSource({
      ownerUserId,
      caseId,
      fileName: NO_GOOD_BENCHMARK.sourcePath,
      mimeType: NO_GOOD_BENCHMARK.sourceMimeType,
      bytes,
      runtime,
      store,
    });
    if (ingested.artifact.contentHash.toLowerCase() !== input.expectedSha256.toLowerCase()) {
      throw new Error("MUSIC_RESTORATION_CANARY_INGEST_HASH_MISMATCH");
    }

    await persistEvidence(
      store,
      caseId,
      ingested.artifact.id,
      [{
        id: `benchmark-source:${caseId}`,
        kind: "music.benchmark-source",
        confidence: 1,
        sourceArtifactId: ingested.artifact.id,
        region: { startSample: 0, endSample: ingested.artifact.sampleCount },
        data: {
          benchmarkId: NO_GOOD_BENCHMARK.id,
          repository: NO_GOOD_BENCHMARK.repository,
          sourceCommit: NO_GOOD_BENCHMARK.sourceCommit,
          sourcePath: NO_GOOD_BENCHMARK.sourcePath,
          sha256: ingested.artifact.contentHash,
          userRequestedBenchmark: true,
        },
      }],
      ingested.probe.runtimeReceiptId,
    );

    const analysis = await analyzeRestorationArtifact({
      client: input.client,
      ownerUserId,
      caseId,
      artifactId: ingested.artifact.id,
      separate: true,
    });
    if (!analysis.separation) {
      throw new Error("MUSIC_RESTORATION_CANARY_SEPARATION_REQUIRED");
    }

    const artifacts = await store.listArtifacts(caseId);
    const source = artifacts.find((item) => item.id === ingested.artifact.id);
    if (!source) throw new Error("MUSIC_RESTORATION_CANARY_SOURCE_MISSING_AFTER_INGEST");
    const stems = requiredStems(artifacts);
    const vocal = stems.find((item) => item.role === "vocals")!;

    const sourceRecovery = await analyzeRestorationSourceRecovery({
      ownerUserId,
      artifact: source,
      store,
      runtime,
    });
    await persistEvidence(
      store,
      caseId,
      source.id,
      sourceRecovery.evidence,
      sourceRecovery.receipt.runtimeReceiptId,
    );

    const [stemIntegrity, vocalIntelligence, sourceTranslation] = await Promise.all([
      analyzeStemIntegritySweep({
        ownerUserId,
        caseId,
        source,
        stems,
        runtime,
        store,
      }),
      analyzeVocalIntelligence({
        ownerUserId,
        caseId,
        vocal,
        referenceRelation: "same-source",
        runtime,
        store,
      }),
      analyzeMixTranslationQc({
        ownerUserId,
        caseId,
        source,
        stems,
        runtime,
        store,
      }),
    ]);
    await persistEvidence(store, caseId, source.id, stemIntegrity.evidence);
    await persistEvidence(store, caseId, vocal.id, vocalIntelligence.evidence, vocalIntelligence.receipt.runtimeReceiptId);
    await persistEvidence(
      store,
      caseId,
      source.id,
      sourceTranslation.evidence,
      sourceTranslation.receipt.runtimeReceiptId,
    );

    const selection = selectConservativeCanaryCandidate({
      sourceArtifactId: source.id,
      sampleRate: source.sampleRate,
      analysis: sourceRecovery.receipt,
      evidence: sourceRecovery.evidence,
    });
    if (!selection.candidate) {
      return {
        status: "abstained" as const,
        benchmarkId: NO_GOOD_BENCHMARK.id,
        caseId,
        sourceArtifactId: source.id,
        sourceSha256: source.contentHash,
        separationJobId: analysis.separation.jobId,
        repairCandidate: null,
        reasons: selection.reasons,
        humanReviewRequired: true,
        finalCertified: false,
      };
    }

    const candidate = selection.candidate;
    const plan: RestorationPlan = {
      id: `canary-plan:${caseId}`,
      caseId,
      sourceVersionId: ingested.restorationCase.sourceVersionId,
      evidenceIds: [...new Set([
        ...sourceRecovery.evidence.map((item) => item.id),
        ...stemIntegrity.evidence.map((item) => item.id),
        ...vocalIntelligence.evidence.map((item) => item.id),
        ...sourceTranslation.evidence.map((item) => item.id),
      ])],
      candidates: [candidate],
      requiresApproval: false,
    };
    const trialAuthorization = authorizeRestorationTrialRender({
      plan,
      candidateId: candidate.id,
    });
    if (!trialAuthorization.authorized) {
      throw new Error(
        `MUSIC_RESTORATION_CANARY_TRIAL_DENIED: ${trialAuthorization.reasons.join(" ")}`,
      );
    }

    const executionId =
      `music-canary-repair:${safePart(input.runId)}:${globalThis.crypto.randomUUID()}`;
    await store.createJob({
      id: executionId,
      caseId,
      kind: "repair",
      sourceArtifactId: source.id,
      metadata: {
        benchmarkId: NO_GOOD_BENCHMARK.id,
        candidateId: candidate.id,
        trialAuthorizationId: trialAuthorization.id,
        authorityScope: "render-only",
      },
    });

    try {
      const writer = new RuntimeRestorationArtifactWriter({
        ownerUserId,
        caseId,
        executionId,
        candidate,
        source,
        runtime,
        store,
      });
      const trial = await renderRestorationTrial({
        authorization: trialAuthorization,
        plan,
        candidate,
        source,
        writer,
      });
      const output = await store.get(ownerUserId, trial.artifact.id);
      if (!output) throw new Error("MUSIC_RESTORATION_CANARY_TRIAL_OUTPUT_NOT_REGISTERED");

      const [outputRecovery, outputTranslation] = await Promise.all([
        analyzeRestorationSourceRecovery({
          ownerUserId,
          artifact: output,
          store,
          runtime,
        }),
        analyzeMixTranslationQc({
          ownerUserId,
          caseId,
          source: output,
          runtime,
          store,
        }),
      ]);
      await persistEvidence(
        store,
        caseId,
        output.id,
        outputRecovery.evidence,
        outputRecovery.receipt.runtimeReceiptId,
      );
      await persistEvidence(
        store,
        caseId,
        output.id,
        outputTranslation.evidence,
        outputTranslation.receipt.runtimeReceiptId,
      );

      const qc = evaluateConservativeCanaryQc({
        candidate,
        sourceHash: source.contentHash,
        outputHash: output.contentHash,
        sourceAnalysis: sourceRecovery.receipt,
        outputAnalysis: outputRecovery.receipt,
        sourceTranslation: sourceTranslation.receipt,
        outputTranslation: outputTranslation.receipt,
      });
      const ledger = new RestorationProvenanceLedger();
      const promotion = promoteMeasuredRestorationTrial({
        executionId,
        trialAuthorization,
        plan,
        candidate,
        source,
        artifact: output,
        qc,
        ledger,
        createdAt: new Date().toISOString(),
      });
      await store.persistExecutionOutcome({
        caseId,
        receipt: promotion.receipt,
        version: promotion.version,
      });
      await store.completeJob({
        id: executionId,
        outputArtifactIds: [output.id],
        runtimeReceiptId: output.runtimeReceiptId ?? promotion.receipt.id,
        metadata: {
          benchmarkId: NO_GOOD_BENCHMARK.id,
          candidateId: candidate.id,
          trialAuthorizationId: trialAuthorization.id,
          promotionAuthorizationId: promotion.promotionAuthorization.id,
          measuredQcPassed: promotion.receipt.qc.passed,
          promoted: Boolean(promotion.version),
          versionId: promotion.version?.id ?? null,
        },
      });

      return {
        status: promotion.version ? "completed" as const : "blocked" as const,
        benchmarkId: NO_GOOD_BENCHMARK.id,
        caseId,
        sourceArtifactId: source.id,
        sourceSha256: source.contentHash,
        separationJobId: analysis.separation.jobId,
        repairJobId: executionId,
        repairCandidate: {
          id: candidate.id,
          operation: candidate.operation,
          operationClass: candidate.operationClass,
          provenance: candidate.provenance,
        },
        outputArtifactId: output.id,
        outputSha256: output.contentHash,
        measuredQc: promotion.receipt.qc,
        trialAuthorizationId: trialAuthorization.id,
        promotionAuthorizationId: promotion.promotionAuthorization.id,
        versionId: promotion.version?.id ?? null,
        reasons: promotion.version
          ? [...selection.reasons, ...promotion.receipt.qc.reasons]
          : [...selection.reasons, ...promotion.receipt.reasons],
        humanReviewRequired: true,
        finalCertified: false,
      };
    } catch (error) {
      await store.failJob(
        executionId,
        error instanceof Error ? error.message : "No Good canary repair failed",
      );
      throw error;
    }
  } finally {
    await input.client.storage
      .from(MUSIC_RESTORATION_BUCKET)
      .remove([input.stagingPath])
      .catch(() => undefined);
  }
}
