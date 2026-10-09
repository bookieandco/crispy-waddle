import { describe, expect, it } from "vitest";
import {
  admitInstrumentClassification,
  INSTRUMENT_CLASSIFIER_REFERENCES,
  type InstrumentClassificationPrediction,
  type InstrumentClassifierRelease,
} from "./instrument-classifier-admission.js";
import { rankInstrumentDonors } from "./instrument-donor-discovery.js";
import type { InstrumentFingerprint } from "../instrument-replacement.js";

const hash = "c".repeat(64);
const basePrediction: InstrumentClassificationPrediction = {
  modelId: "ivy-mfcc-svm-research",
  label: "piano",
  sourceArtifactId: "source-one",
  sourceAudioSha256: hash,
  calibratedProbability: 0.99,
  confidenceMeasure: "raw-score",
  inputDomain: "isolated-single-note",
  estimatedOctave: 4,
  evidenceId: "research-score-one",
  regionStartMs: 100,
  regionEndMs: 310,
};
const args = {
  prediction: basePrediction,
  expectedSourceArtifactId: "source-one",
  expectedSourceSha256: hash,
  ownerUserId: "owner-one",
};

describe("musical instrument classifier research admission", () => {
  it("records correct supported labels and explicitly excludes both guitar types", () => {
    const ivy = INSTRUMENT_CLASSIFIER_REFERENCES[0];
    const dhivya = INSTRUMENT_CLASSIFIER_REFERENCES[1];
    expect(ivy.supportedLabels).toEqual(["cello", "clarinet", "flute", "violin", "piano"]);
    expect(dhivya.supportedLabels).toContain("saxophone");
    expect(ivy.supportedLabels).not.toContain("electric-guitar");
    expect(dhivya.supportedLabels).not.toContain("acoustic-guitar");
    expect(ivy.status).toBe("research-only");
  });

  it("classifies an Ivy prediction only as research, not production evidence", () => {
    const result = admitInstrumentClassification(args);
    expect(result.state).toBe("research-only");
    expect(result.mappedFamily).toBe("piano");
    expect(result.identity).toBeUndefined();
    expect(result.replacementApproved).toBe(false);
  });

  it("refuses guitar tags, polyphonic mixes, wrong octave and mismatched parent SHA", () => {
    expect(admitInstrumentClassification({ ...args, prediction: { ...basePrediction, label: "electric-guitar" } }).state).toBe("abstain");
    expect(admitInstrumentClassification({ ...args, prediction: { ...basePrediction, inputDomain: "mixed-polyphonic" } }).state).toBe("abstain");
    expect(admitInstrumentClassification({ ...args, prediction: { ...basePrediction, estimatedOctave: 3 } }).state).toBe("abstain");
    expect(admitInstrumentClassification({ ...args, expectedSourceSha256: "b".repeat(64) }).state).toBe("abstain");
  });

  it("permits only an identified, rights-cleared, calibrated future model with owner review", () => {
    const prediction: InstrumentClassificationPrediction = {
      ...basePrediction,
      modelId: "jhadina-instrument-family-v1",
      label: "electric-guitar",
      inputDomain: "isolated-instrument-phrase",
      estimatedOctave: undefined,
      calibratedProbability: 0.91,
      confidenceMeasure: "calibrated-probability",
    };
    const release: InstrumentClassifierRelease = {
      modelId: prediction.modelId,
      trustedWorkerAdmission: true,
      modelArtifactSha256: "a".repeat(64),
      sourceAudioSha256: hash,
      licenseReviewEvidenceId: "approved-license",
      trainingDataRightsEvidenceId: "approved-training",
      heldOutCalibrationEvidenceId: "calibration-fixture",
      instrumentClassBenchmarkEvidenceId: "held-out-guitar",
      deployedModelVersion: "1.0.0",
    };
    const options = { ...args, prediction, release, expectedFamily: "electric-guitar" as const };
    expect(admitInstrumentClassification(options).state).toBe("human-review-required");
    expect(admitInstrumentClassification({
      ...options, prediction: { ...prediction, confidenceMeasure: "classification-margin" },
    }).state).toBe("abstain");
    expect(admitInstrumentClassification({
      ...options, release: { ...release, licenseReviewEvidenceId: "" },
    }).state).toBe("abstain");
    const withReview = admitInstrumentClassification({
      ...options,
      review: { approved: true, reviewerUserId: "owner-one", reviewedArtifactId: "source-one",
        reviewEvidenceId: "owner-approved-electric-guitar" },
    });
    expect(withReview.state).toBe("reviewed-identity");
    expect(withReview.identity?.family).toBe("electric-guitar");
    expect(withReview.identity?.origin).toBe("model-classification-with-review");
    expect(withReview.replacementApproved).toBe(false);
  });

  it("never lets research output approve an instrument donor or reconstruction", () => {
    const uncertain = admitInstrumentClassification(args);
    expect(uncertain.identity).toBeUndefined();
    const guitar: InstrumentFingerprint = {
      family: "electric-guitar", spectralCentroidHz: 1200, spectralSpreadHz: 850,
      lowEnergyRatio: 0.3, midEnergyRatio: 0.6, highEnergyRatio: 0.1,
      transientStrength: 0.5, harmonicity: 0.7,
    };
    const outcome = rankInstrumentDonors({
      sourceArtifactId: "source-one", sourceUserId: "owner-one", caseId: "case-one",
      canonicalRecordingId: "recording-one", observedFingerprint: guitar,
      observedIdentity: {
        family: "electric-guitar", origin: "model-classification-with-review",
        reviewed: false, evidenceIds: [], confidence: 0.99,
      },
      damage: {
        repairability: "unrepairable", confidence: 0.9, evidenceIds: ["broken-hit"],
        repairCandidatePassed: false,
      },
      donors: [],
    });
    expect(outcome.disposition).toBe("abstain");
    expect(outcome.replacementPerformed).toBe(false);
  });

  it("rejects output classes the reference cannot distinguish", () => {
    const prediction: InstrumentClassificationPrediction = {
      ...basePrediction, modelId: "dhivya-mel-cnn-research",
      label: "violin",
      estimatedOctave: undefined,
    };
    expect(admitInstrumentClassification({ ...args, prediction }).state).toBe("abstain");
    expect(admitInstrumentClassification({
      ...args, prediction: { ...prediction, label: "viola" },
    }).state).toBe("research-only");
  });
});
