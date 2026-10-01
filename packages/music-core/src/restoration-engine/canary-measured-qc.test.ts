import { describe, expect, it } from "vitest";
import {
  evaluateConservativeCanaryQc,
  selectConservativeCanaryCandidate,
} from "./canary-measured-qc.js";
import type {
  RestorationMixTranslationReceipt,
  RestorationSourceRecoveryAnalysisReceipt,
} from "./runtime-contract.js";
import type { RestorationEvidence } from "./types.js";

function analysis(overrides: Partial<RestorationSourceRecoveryAnalysisReceipt> = {}): RestorationSourceRecoveryAnalysisReceipt {
  return {
    sourceArtifactId: "source",
    sourceSha256: "a".repeat(64),
    sampleRate: 48000,
    channels: 2,
    sampleCount: 480000,
    durationSeconds: 10,
    analysisWindowSeconds: 2,
    bandLimit: { detected: false, cutoffHz: null, confidence: 0.2, edgeDropDb: 2, highBandEnergyRatio: 0.2 },
    reverberation: { tailPersistence: 0.2, excessReverbConfidence: 0.2, echoDelayMs: null, echoConfidence: 0, sustainConfoundPossible: true },
    analogTransfer: {
      humClass: "unresolved",
      humReferenceHz: null,
      humConfidence: 0.2,
      humDriftStdHz: 0,
      humDriftRangeHz: 0,
      programToneReferenceHz: null,
      programToneConfidence: 0,
      relativeDriftCorrelation: 0,
      wowModulationEnergyRatio: 0,
      flutterModulationEnergyRatio: 0,
      timebaseConfidence: 0,
      wowConfidence: 0,
      flutterConfidence: 0,
      corroborated: false,
      timebaseCorrectionEligible: false,
      rumbleRatio: 0,
      rumbleConfidence: 0,
      hissHighBandRatio: 0,
      hissSpectralFlatness: 0,
      hissConfidence: 0,
      channelDelayMs: null,
      channelDelayConfidence: 0,
      azimuthRisk: 0,
    },
    spatial: { stereoCorrelation: 0.6, sideToMidEnergyRatio: 0.25 },
    notes: [],
    providerId: "test",
    providerVersion: "1",
    runtimeReceiptId: "receipt-1",
    ...overrides,
  };
}

function translation(full = 10, failures = 0): RestorationMixTranslationReceipt {
  return {
    sourceArtifactId: "source",
    sourceSha256: "a".repeat(64),
    sampleRate: 48000,
    channels: 2,
    sampleCount: 480000,
    tonalBalance: {},
    bandCrestFactorDb: { full },
    maskingGraph: { edges: [], cumulative: {} },
    translations: {},
    translationFailureCount: failures,
    notes: [],
    providerId: "test",
    providerVersion: "1",
    runtimeReceiptId: "mix-1",
  };
}

describe("conservative real-song canary policy", () => {
  it("selects bounded dehum only for strong stationary mains-family evidence", () => {
    const source = analysis({
      analogTransfer: {
        ...analysis().analogTransfer,
        humClass: "stationary",
        humReferenceHz: 59.94,
        humConfidence: 0.88,
      },
    });
    const evidence: RestorationEvidence[] = [{
      id: "hum-e1",
      kind: "music.analog-transfer.hum-ridge",
      confidence: 0.88,
      sourceArtifactId: "source",
      data: {},
    }];
    const selected = selectConservativeCanaryCandidate({
      sourceArtifactId: "source",
      sampleRate: 48000,
      analysis: source,
      evidence,
    });
    expect(selected.candidate?.operation).toBe("dehum");
    expect(selected.candidate?.parameters.fundamentalHz).toBe(59.94);
    expect(selected.candidate?.parameters.reductionDb).toBe(18);
  });

  it("selects spectral recovery only at the stronger canary band-limit threshold", () => {
    const source = analysis({
      bandLimit: { detected: true, cutoffHz: 8000, confidence: 0.9, edgeDropDb: 24, highBandEnergyRatio: 0.01 },
    });
    const evidence: RestorationEvidence[] = [{
      id: "band-e1",
      kind: "music.source-recovery.band-limit",
      confidence: 0.9,
      sourceArtifactId: "source",
      data: { detected: true, cutoffHz: 8000, edgeDropDb: 24, highBandEnergyRatio: 0.01 },
    }];
    const selected = selectConservativeCanaryCandidate({
      sourceArtifactId: "source",
      sampleRate: 48000,
      analysis: source,
      evidence,
    });
    expect(selected.candidate?.operation).toBe("spectral-recovery");
    expect(selected.candidate?.operationClass).toBe("source-recovery");
    expect(selected.candidate?.provenance).toBe("reconstructed");
  });

  it("abstains instead of inventing a repair when evidence is ambiguous", () => {
    const selected = selectConservativeCanaryCandidate({
      sourceArtifactId: "source",
      sampleRate: 48000,
      analysis: analysis(),
      evidence: [],
    });
    expect(selected.candidate).toBeUndefined();
    expect(selected.reasons.join(" ")).toMatch(/evidence-only/i);
  });

  it("passes dehum promotion only after measured hum reduction and translation conservation", () => {
    const before = analysis({
      analogTransfer: {
        ...analysis().analogTransfer,
        humClass: "stationary",
        humReferenceHz: 60,
        humConfidence: 0.9,
      },
    });
    const after = analysis({
      sourceArtifactId: "output",
      sourceSha256: "b".repeat(64),
      analogTransfer: {
        ...analysis().analogTransfer,
        humClass: "unresolved",
        humReferenceHz: 60,
        humConfidence: 0.35,
      },
    });
    const candidate = selectConservativeCanaryCandidate({
      sourceArtifactId: "source",
      sampleRate: 48000,
      analysis: before,
      evidence: [],
    }).candidate!;
    const qc = evaluateConservativeCanaryQc({
      candidate,
      sourceHash: "a".repeat(64),
      outputHash: "b".repeat(64),
      sourceAnalysis: before,
      outputAnalysis: after,
      sourceTranslation: translation(10, 0),
      outputTranslation: { ...translation(11, 0), sourceArtifactId: "output", sourceSha256: "b".repeat(64) },
    });
    expect(qc.passed).toBe(true);
    expect(qc.reasons).toContain("measured-post-render-canary-qc-passed");
  });

  it("blocks promotion when translation failures increase even if the repair effect is measurable", () => {
    const before = analysis({
      analogTransfer: {
        ...analysis().analogTransfer,
        humClass: "stationary",
        humReferenceHz: 60,
        humConfidence: 0.9,
      },
    });
    const after = analysis({
      sourceArtifactId: "output",
      sourceSha256: "b".repeat(64),
      analogTransfer: {
        ...analysis().analogTransfer,
        humClass: "unresolved",
        humReferenceHz: 60,
        humConfidence: 0.3,
      },
    });
    const candidate = selectConservativeCanaryCandidate({
      sourceArtifactId: "source",
      sampleRate: 48000,
      analysis: before,
      evidence: [],
    }).candidate!;
    const qc = evaluateConservativeCanaryQc({
      candidate,
      sourceHash: "a".repeat(64),
      outputHash: "b".repeat(64),
      sourceAnalysis: before,
      outputAnalysis: after,
      sourceTranslation: translation(10, 0),
      outputTranslation: { ...translation(10, 1), sourceArtifactId: "output", sourceSha256: "b".repeat(64) },
    });
    expect(qc.passed).toBe(false);
    expect(qc.conservationPassed).toBe(false);
    expect(qc.reasons).toContain("translation-failures-increased");
  });
});
