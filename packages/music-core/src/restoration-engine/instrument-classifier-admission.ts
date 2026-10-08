import type { InstrumentFamily } from "../instrument-replacement.js";
import type { InstrumentIdentityEvidence } from "./instrument-donor-discovery.js";

/**
 * MUSIC-RESTORE-HARDEN.5 — musical instrument classifier admission.
 *
 * The external repos below are unlicensed/uncommissioned research references,
 * NOT live ML providers. No Python 2 code, pickle/joblib objects or notebooks
 * are loaded by this module. A production-classifying Jhadina model needs
 * independently verified weights, held-out calibration, allowed training data,
 * and human review before its output can influence sound replacement.
 */
export type InstrumentClassifierModelId =
  | "ivy-mfcc-svm-research"
  | "dhivya-mel-cnn-research"
  | "jhadina-instrument-family-v1";

export type InstrumentClassifierInputDomain =
  | "isolated-single-note"
  | "isolated-instrument-phrase"
  | "mixed-polyphonic";

export interface InstrumentClassifierReference {
  modelId: InstrumentClassifierModelId;
  status: "research-only" | "uncommissioned-production-contract";
  repoUrl: string;
  supportedLabels: readonly string[];
  inputDomain: InstrumentClassifierInputDomain;
  /** Mean-magnitude MFCCs for Ivy; Mel-spectrogram CNN for Dhivya. */
  featureDesign: "mfcc20-linear-svm" | "mel-spectrogram-cnn" | "versioned-audio-features";
  limitations: string[];
}

export const INSTRUMENT_CLASSIFIER_REFERENCES: readonly InstrumentClassifierReference[] = [
  {
    modelId: "ivy-mfcc-svm-research",
    status: "research-only",
    repoUrl: "https://github.com/IvyZX/music-instrument-classifier",
    supportedLabels: ["cello", "clarinet", "flute", "violin", "piano"],
    inputDomain: "isolated-single-note",
    featureDesign: "mfcc20-linear-svm",
    limitations: [
      "Only single notes from the fourth octave were evaluated.",
      "The supplied legacy Python 2 sklearn pickle is not admitted for execution.",
      "No guitar class, modern calibration, or explicit repository license verified.",
    ],
  },
  {
    modelId: "dhivya-mel-cnn-research",
    status: "research-only",
    repoUrl: "https://github.com/dhivyasreedhar/Music-Instrument-Recognition",
    supportedLabels: ["flute", "viola", "cello", "oboe", "trumpet", "saxophone"],
    inputDomain: "isolated-single-note",
    featureDesign: "mel-spectrogram-cnn",
    limitations: [
      "Published notebook uses isolated monophonic musical material, not polyphonic songs.",
      "No downloadable production model weights or calibrated inference service verified.",
      "No guitar class or explicit repository license verified.",
    ],
  },
  {
    modelId: "jhadina-instrument-family-v1",
    status: "uncommissioned-production-contract",
    repoUrl: "https://github.com/bookieandco/crispy-waddle",
    supportedLabels: [
      "acoustic-guitar", "electric-guitar", "piano", "organ", "strings",
      "brass", "woodwinds", "drums", "bass", "percussion", "synth",
    ],
    inputDomain: "isolated-instrument-phrase",
    featureDesign: "versioned-audio-features",
    limitations: [
      "No trained production weights or independently verified benchmark available on this branch.",
      "Supported labels are a required future training target, NOT implemented detection ability.",
    ],
  },
] as const;

const HEX_256 = /^[0-9a-f]{64}$/i;

export interface InstrumentClassificationPrediction {
  modelId: InstrumentClassifierModelId;
  label: string;
  sourceArtifactId: string;
  sourceAudioSha256: string;
  /** This is only a calibrated class probability, never an SVM margin or training accuracy. */
  calibratedProbability: number;
  confidenceMeasure: "calibrated-probability" | "raw-score" | "classification-margin";
  inputDomain: InstrumentClassifierInputDomain;
  estimatedOctave?: number;
  evidenceId: string;
  regionStartMs: number;
  regionEndMs: number;
}

export interface InstrumentClassifierRelease {
  modelId: InstrumentClassifierModelId;
  /** Must originate from trusted worker/release registry, never client-submitted JSON. */
  trustedWorkerAdmission: boolean;
  modelArtifactSha256: string;
  sourceAudioSha256: string;
  licenseReviewEvidenceId: string;
  trainingDataRightsEvidenceId: string;
  heldOutCalibrationEvidenceId: string;
  instrumentClassBenchmarkEvidenceId: string;
  deployedModelVersion: string;
}

export interface InstrumentClassificationHumanReview {
  approved: boolean;
  reviewerUserId: string;
  reviewedArtifactId: string;
  reviewEvidenceId: string;
}

export interface InstrumentClassifierAdmission {
  state: "abstain" | "research-only" | "human-review-required" | "reviewed-identity";
  mappedFamily?: InstrumentFamily;
  identity?: InstrumentIdentityEvidence;
  reasons: string[];
  modelId: InstrumentClassifierModelId;
  sourceArtifactId: string;
  isAudioSeparatedEnough: boolean;
  replacementApproved: false;
}

/** Map labels to broad instrument families only; acoustic versus electric guitar
 * cannot be inferred from cello/violin or woodwind predictions. */
const MUSICAL_FAMILY_BY_LABEL: Readonly<Record<string, InstrumentFamily>> = {
  cello: "strings",
  violin: "strings",
  viola: "strings",
  clarinet: "woodwinds",
  flute: "woodwinds",
  oboe: "woodwinds",
  saxophone: "woodwinds",
  trumpet: "brass",
  piano: "piano",
  "acoustic-guitar": "acoustic-guitar",
  "electric-guitar": "electric-guitar",
  organ: "organ",
  strings: "strings",
  brass: "brass",
  woodwinds: "woodwinds",
  drums: "drums",
  bass: "bass",
  percussion: "percussion",
  synth: "synth",
};

/** Production acceptance requires a calibrated, owned model AND an owner review.
 * Upstream research references are hard-coded as RESEARCH ONLY until separately
 * licensed, retrained and independently certified.
 */
export function admitInstrumentClassification(input: {
  prediction: InstrumentClassificationPrediction;
  release?: InstrumentClassifierRelease;
  review?: InstrumentClassificationHumanReview;
  expectedSourceArtifactId: string;
  expectedSourceSha256: string;
  ownerUserId: string;
  expectedFamily?: InstrumentFamily;
  minimumCalibratedProbability?: number;
}): InstrumentClassifierAdmission {
  const { prediction } = input;
  const result: InstrumentClassifierAdmission = {
    state: "abstain",
    reasons: [],
    modelId: prediction.modelId,
    sourceArtifactId: prediction.sourceArtifactId,
    isAudioSeparatedEnough: prediction.inputDomain !== "mixed-polyphonic",
    replacementApproved: false,
  };
  const reference = INSTRUMENT_CLASSIFIER_REFERENCES.find(item => item.modelId === prediction.modelId);
  if (!reference || !input.ownerUserId.trim()) {
    result.reasons.push("Unknown classifier ID or missing owner scope.");
    return result;
  }
  if (prediction.sourceArtifactId !== input.expectedSourceArtifactId ||
      !HEX_256.test(prediction.sourceAudioSha256) ||
      !HEX_256.test(input.expectedSourceSha256) ||
      prediction.sourceAudioSha256.toLowerCase() !== input.expectedSourceSha256.toLowerCase() ||
      !prediction.evidenceId.trim() ||
      !Number.isFinite(prediction.regionStartMs) ||
      !Number.isFinite(prediction.regionEndMs) ||
      prediction.regionStartMs < 0 ||
      prediction.regionEndMs <= prediction.regionStartMs) {
    result.reasons.push("Classification is not proven against the expected audio bytes and region.");
    return result;
  }
  if (prediction.inputDomain === "mixed-polyphonic" ||
      (reference.inputDomain === "isolated-single-note" && prediction.inputDomain !== "isolated-single-note")) {
    result.reasons.push("Source violates the instrument classifier training domain.");
    return result;
  }
  if (reference.modelId === "ivy-mfcc-svm-research" && prediction.estimatedOctave !== 4) {
    result.reasons.push("Ivy reference was validated only for fourth-octave single notes.");
    return result;
  }
  if (!reference.supportedLabels.includes(prediction.label) ||
      !MUSICAL_FAMILY_BY_LABEL[prediction.label]) {
    result.reasons.push("Instrument label is not supported by this model.");
    return result;
  }
  result.mappedFamily = MUSICAL_FAMILY_BY_LABEL[prediction.label];
  if (input.expectedFamily && result.mappedFamily !== input.expectedFamily) {
    result.reasons.push("Predicted family does not match expected instrument identity.");
    return result;
  }
  if (reference.status === "research-only") {
    result.state = "research-only";
    result.reasons.push("Research reference only: no production model or rights admission.");
    return result;
  }
  const release = input.release;
  if (!release || release.modelId !== prediction.modelId || !release.trustedWorkerAdmission ||
      !HEX_256.test(release.modelArtifactSha256) ||
      release.sourceAudioSha256.toLowerCase() !== prediction.sourceAudioSha256.toLowerCase() ||
      !release.licenseReviewEvidenceId.trim() ||
      !release.trainingDataRightsEvidenceId.trim() ||
      !release.heldOutCalibrationEvidenceId.trim() ||
      !release.instrumentClassBenchmarkEvidenceId.trim() ||
      !release.deployedModelVersion.trim()) {
    result.reasons.push("Trained/cleared worker model, weights and held-out calibration not commissioned.");
    return result;
  }
  const minimum = input.minimumCalibratedProbability ?? 0.85;
  if (minimum < 0.75 || minimum > 1 || !Number.isFinite(minimum) ||
      prediction.confidenceMeasure !== "calibrated-probability" ||
      !Number.isFinite(prediction.calibratedProbability) ||
      prediction.calibratedProbability < minimum ||
      prediction.calibratedProbability > 1) {
    result.reasons.push("No accepted calibrated instrument prediction.");
    return result;
  }
  const review = input.review;
  if (!review || !review.approved || review.reviewerUserId !== input.ownerUserId ||
      review.reviewedArtifactId !== prediction.sourceArtifactId ||
      !review.reviewEvidenceId.trim()) {
    result.state = "human-review-required";
    result.reasons.push("Model prediction is a hypothesis until the owner confirms instrument identity.");
    return result;
  }
  result.state = "reviewed-identity";
  result.identity = {
    family: result.mappedFamily,
    origin: "model-classification-with-review",
    reviewed: true,
    confidence: prediction.calibratedProbability,
    evidenceIds: [
      prediction.evidenceId,
      release.licenseReviewEvidenceId,
      release.trainingDataRightsEvidenceId,
      release.heldOutCalibrationEvidenceId,
      release.instrumentClassBenchmarkEvidenceId,
      review.reviewEvidenceId,
      "model-sha256:" + release.modelArtifactSha256.toLowerCase(),
      "audio-sha256:" + prediction.sourceAudioSha256.toLowerCase(),
    ],
  };
  result.reasons.push("Owner-reviewed instrument identity only; donor selection, pitch/phase and replacement require separate gates.");
  return result;
}
