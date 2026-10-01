import { buildSourceRecoveryCandidates } from "./source-recovery-candidates.js";
import type {
  RestorationMixTranslationReceipt,
  RestorationSourceRecoveryAnalysisReceipt,
} from "./runtime-contract.js";
import type {
  RestorationCandidate,
  RestorationEvidence,
  RestorationQcResult,
} from "./types.js";

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export interface ConservativeCanaryCandidateSelection {
  candidate?: RestorationCandidate;
  reasons: string[];
}

/**
 * Narrow real-song canary selector.
 *
 * This deliberately does not try to solve every detected defect. It admits only
 * stationary mains-family hum with strong evidence or a strongly measured
 * band-limit that is explicitly labeled reconstructed source-recovery.
 */
export function selectConservativeCanaryCandidate(input: {
  sourceArtifactId: string;
  sampleRate: number;
  analysis: RestorationSourceRecoveryAnalysisReceipt;
  evidence: readonly RestorationEvidence[];
}): ConservativeCanaryCandidateSelection {
  const hum = input.analysis.analogTransfer;
  if (
    hum.humClass === "stationary" &&
    hum.humConfidence >= 0.75 &&
    finite(hum.humReferenceHz) &&
    hum.humReferenceHz >= 45 &&
    hum.humReferenceHz <= 65
  ) {
    const evidenceId =
      input.evidence
        .filter((item) => item.kind === "music.analog-transfer.hum-ridge")
        .sort((a, b) => b.confidence - a.confidence)[0]?.id ??
      `source-recovery:${input.sourceArtifactId}:hum-ridge`;
    return {
      candidate: {
        id: `canary:${input.sourceArtifactId}:dehum`,
        operation: "dehum",
        operationClass: "correction",
        status: "proposed",
        inputArtifactId: input.sourceArtifactId,
        parameters: {
          fundamentalHz: hum.humReferenceHz,
          harmonics: 4,
          q: 30,
          reductionDb: 18,
        },
        evidenceIds: [evidenceId],
        provenance: "derived",
      },
      reasons: ["Strong stationary mains-family hum evidence admitted a bounded dehum trial."],
    };
  }

  if (input.analysis.bandLimit.detected && input.analysis.bandLimit.confidence >= 0.85) {
    const candidates = buildSourceRecoveryCandidates({
      sourceArtifactId: input.sourceArtifactId,
      sampleRate: input.sampleRate,
      evidence: input.evidence,
    });
    const spectral = candidates.find((item) => item.operation === "spectral-recovery");
    if (spectral) {
      return {
        candidate: spectral,
        reasons: [
          "Strong band-limit evidence admitted an explicitly reconstructed spectral-recovery trial.",
          "Reconstructed high-frequency material is never represented as authenticated original content.",
        ],
      };
    }
  }

  return {
    reasons: [
      "No canary-safe deterministic defect met the automatic trial threshold.",
      "Ambiguous reverb, timebase, rumble, hiss, phase, and impulse findings remain evidence-only.",
    ],
  };
}

function fullCrest(receipt?: RestorationMixTranslationReceipt): number | undefined {
  const value = receipt?.bandCrestFactorDb.full;
  return finite(value) ? value : undefined;
}

export function evaluateConservativeCanaryQc(input: {
  candidate: RestorationCandidate;
  sourceHash: string;
  outputHash: string;
  sourceAnalysis: RestorationSourceRecoveryAnalysisReceipt;
  outputAnalysis: RestorationSourceRecoveryAnalysisReceipt;
  sourceTranslation?: RestorationMixTranslationReceipt;
  outputTranslation?: RestorationMixTranslationReceipt;
}): RestorationQcResult {
  const reasons: string[] = [];
  const sameGeometry =
    input.sourceAnalysis.sampleRate === input.outputAnalysis.sampleRate &&
    input.sourceAnalysis.channels === input.outputAnalysis.channels &&
    input.sourceAnalysis.sampleCount === input.outputAnalysis.sampleCount;
  if (!sameGeometry) reasons.push("signal-geometry-changed");

  const changedBytes =
    Boolean(input.sourceHash) &&
    Boolean(input.outputHash) &&
    input.sourceHash.toLowerCase() !== input.outputHash.toLowerCase();
  if (!changedBytes) reasons.push("output-identical-to-source");

  const sourceFailures = input.sourceTranslation?.translationFailureCount ?? 0;
  const outputFailures = input.outputTranslation?.translationFailureCount ?? sourceFailures;
  const translationConserved = outputFailures <= sourceFailures;
  if (!translationConserved) reasons.push("translation-failures-increased");

  const sourceCrest = fullCrest(input.sourceTranslation);
  const outputCrest = fullCrest(input.outputTranslation);
  const crestConserved =
    sourceCrest === undefined ||
    outputCrest === undefined ||
    Math.abs(outputCrest - sourceCrest) <= 6;
  if (!crestConserved) reasons.push("full-range-crest-drift-exceeded-6db");

  let effectEstablished = false;
  let authenticityPassed = false;

  if (input.candidate.operation === "dehum") {
    const before = input.sourceAnalysis.analogTransfer;
    const after = input.outputAnalysis.analogTransfer;
    const sourceEligible =
      before.humClass === "stationary" &&
      before.humConfidence >= 0.75 &&
      finite(before.humReferenceHz) &&
      before.humReferenceHz >= 45 &&
      before.humReferenceHz <= 65;
    effectEstablished =
      sourceEligible &&
      after.humClass !== "drifting" &&
      (after.humConfidence <= 0.5 || after.humConfidence <= before.humConfidence - 0.1);
    authenticityPassed =
      input.candidate.operationClass === "correction" &&
      input.candidate.provenance === "derived";
    if (!effectEstablished) reasons.push("stationary-hum-reduction-not-established");
  } else if (input.candidate.operation === "spectral-recovery") {
    const before = input.sourceAnalysis.bandLimit;
    const after = input.outputAnalysis.bandLimit;
    const sourceEligible = before.detected && before.confidence >= 0.85;
    effectEstablished =
      sourceEligible &&
      after.highBandEnergyRatio > before.highBandEnergyRatio &&
      after.edgeDropDb < before.edgeDropDb - 1;
    authenticityPassed =
      input.candidate.operationClass === "source-recovery" &&
      input.candidate.provenance === "reconstructed";
    if (!effectEstablished) reasons.push("reconstructed-high-band-improvement-not-established");
  } else {
    reasons.push("operation-not-admitted-by-real-song-canary-policy");
  }

  if (!authenticityPassed) reasons.push("restoration-provenance-not-conservative");
  const conservationPassed = sameGeometry && translationConserved && crestConserved;
  const artifactFree = conservationPassed && effectEstablished;
  const passed = changedBytes && conservationPassed && authenticityPassed && artifactFree;

  if (passed) {
    reasons.push("measured-post-render-canary-qc-passed");
  }

  return {
    passed,
    conservationPassed,
    authenticityPassed,
    artifactFree,
    reasons: [...new Set(reasons)],
  };
}
