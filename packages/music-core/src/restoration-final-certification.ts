export type RestorationFinalStatus = "certified" | "blocked";

export type RestorationFinalCheckId =
  | "runtime-ready"
  | "immutable-source"
  | "separation-receipt"
  | "perception-receipts"
  | "consequential-repair"
  | "human-review"
  | "current-version"
  | "qc-receipt"
  | "artifact-hashes"
  | "daw-bundle";

export interface RestorationFinalJobEvidence {
  id: string;
  kind: string;
  status: string;
  sourceArtifactId?: string;
  outputArtifactIds: string[];
  runtimeReceiptId?: string;
}

export interface RestorationFinalVersionEvidence {
  id: string;
  outputArtifactId: string;
  candidateId?: string;
  qcPassed: boolean;
}

export interface RestorationFinalReviewEvidence {
  id: string;
  artifactId: string;
  decision: string;
  qcReceiptId?: string;
  qcReceiptKind?: string;
}

export interface RestorationFinalEvidence {
  runtimeProductionReady: boolean;
  sourceArtifact?: {
    id: string;
    kind: string;
    sha256: string;
  };
  requiredStemArtifactIds: Partial<Record<"vocals" | "drums" | "bass" | "other", string>>;
  jobs: RestorationFinalJobEvidence[];
  evidenceCount: number;
  evidenceRuntimeReceiptCount: number;
  currentVersion?: RestorationFinalVersionEvidence;
  approvedReview?: RestorationFinalReviewEvidence;
  currentOutputQcVerified: boolean;
  artifactHashesVerified: boolean;
  dawBundleSha256?: string;
}

export interface RestorationFinalCheck {
  id: RestorationFinalCheckId;
  passed: boolean;
  reason: string;
}

export interface RestorationFinalCertificationDecision {
  status: RestorationFinalStatus;
  checks: RestorationFinalCheck[];
  reasons: string[];
}

const HEX_64 = /^[a-f0-9]{64}$/i;
const STEM_ROLES = ["vocals", "drums", "bass", "other"] as const;
const CONSEQUENTIAL_JOB_KINDS = new Set(["repair", "reconstruct", "vocal-restore"]);

function check(id: RestorationFinalCheckId, passed: boolean, reason: string): RestorationFinalCheck {
  return { id, passed, reason };
}

/**
 * Fail-closed MUSIC-RESTORE.FINAL certification evaluator.
 *
 * The evaluator never infers that a missing receipt "probably happened".
 * A final certification requires live runtime readiness, immutable/source
 * lineage, separation + perception receipts, a consequential repair,
 * hash/QC verified human promotion, and a hash-verified DAW bundle.
 */
export function evaluateRestorationFinalCertification(
  evidence: RestorationFinalEvidence,
): RestorationFinalCertificationDecision {
  const source = evidence.sourceArtifact;
  const immutableSourcePassed = Boolean(
    source &&
    source.kind === "source" &&
    HEX_64.test(source.sha256),
  );

  const stemIds = STEM_ROLES
    .map(role => evidence.requiredStemArtifactIds[role])
    .filter((value): value is string => Boolean(value));
  const allStemsPresent = stemIds.length === STEM_ROLES.length;

  const separation = evidence.jobs.find(job =>
    job.kind === "separate" &&
    job.status === "completed" &&
    Boolean(job.runtimeReceiptId) &&
    STEM_ROLES.every(role => {
      const id = evidence.requiredStemArtifactIds[role];
      return Boolean(id && job.outputArtifactIds.includes(id));
    }),
  );

  const perceptionTargets = [
    source?.id,
    ...stemIds,
  ].filter((value): value is string => Boolean(value));
  const perceptionPassed =
    allStemsPresent &&
    evidence.evidenceCount > 0 &&
    evidence.evidenceRuntimeReceiptCount > 0 &&
    perceptionTargets.every(artifactId =>
      evidence.jobs.some(job =>
        job.kind === "perceive" &&
        job.status === "completed" &&
        job.sourceArtifactId === artifactId &&
        Boolean(job.runtimeReceiptId),
      ),
    );

  const currentOutputId = evidence.currentVersion?.outputArtifactId;
  const consequentialRepair = currentOutputId
    ? evidence.jobs.find(job =>
        CONSEQUENTIAL_JOB_KINDS.has(job.kind) &&
        job.status === "completed" &&
        Boolean(job.runtimeReceiptId) &&
        job.outputArtifactIds.includes(currentOutputId),
      )
    : undefined;

  const reviewPassed = Boolean(
    evidence.approvedReview &&
    evidence.approvedReview.decision === "approved" &&
    currentOutputId &&
    evidence.approvedReview.artifactId === currentOutputId &&
    evidence.currentVersion?.candidateId === evidence.approvedReview.id,
  );

  const versionPassed = Boolean(
    evidence.currentVersion &&
    evidence.currentVersion.qcPassed &&
    currentOutputId,
  );

  const bundlePassed = Boolean(
    evidence.dawBundleSha256 &&
    HEX_64.test(evidence.dawBundleSha256),
  );

  const checks: RestorationFinalCheck[] = [
    check(
      "runtime-ready",
      evidence.runtimeProductionReady,
      evidence.runtimeProductionReady
        ? "Production restoration runtime reports ready."
        : "Production restoration runtime is not ready; RunPod/runtime commissioning remains unresolved.",
    ),
    check(
      "immutable-source",
      immutableSourcePassed,
      immutableSourcePassed
        ? "Immutable source artifact has a valid SHA-256."
        : "Immutable source artifact or source hash is missing.",
    ),
    check(
      "separation-receipt",
      Boolean(separation),
      separation
        ? "Completed separation receipt covers vocals, drums, bass and other stems."
        : "A completed hash/receipt-bound four-stem separation is missing.",
    ),
    check(
      "perception-receipts",
      perceptionPassed,
      perceptionPassed
        ? "Source and required stems have completed perception receipts and persisted evidence."
        : "Perception receipts/evidence are incomplete for source and required stems.",
    ),
    check(
      "consequential-repair",
      Boolean(consequentialRepair),
      consequentialRepair
        ? "The approved current output was produced by a completed consequential repair/reconstruction job."
        : "The approved current output is not bound to a completed repair/reconstruction job.",
    ),
    check(
      "human-review",
      reviewPassed,
      reviewPassed
        ? "Human approval is bound to the current output and version."
        : "Current output lacks matching governed human approval.",
    ),
    check(
      "current-version",
      versionPassed,
      versionPassed
        ? "Current restoration version exists and records QC pass."
        : "Current restoration version is missing or not QC-passed.",
    ),
    check(
      "qc-receipt",
      evidence.currentOutputQcVerified,
      evidence.currentOutputQcVerified
        ? "Current output has a verified passed QC receipt."
        : "Current output lacks a verified passed QC receipt.",
    ),
    check(
      "artifact-hashes",
      evidence.artifactHashesVerified,
      evidence.artifactHashesVerified
        ? "All DAW-package artifacts were re-downloaded and independently SHA-256 verified."
        : "Artifact-byte re-verification has not completed.",
    ),
    check(
      "daw-bundle",
      bundlePassed,
      bundlePassed
        ? "Self-contained DAW bundle was built and SHA-256 fingerprinted."
        : "A hash-verified self-contained DAW bundle has not been produced.",
    ),
  ];

  const reasons = checks.filter(item => !item.passed).map(item => item.reason);
  return {
    status: reasons.length ? "blocked" : "certified",
    checks,
    reasons,
  };
}
