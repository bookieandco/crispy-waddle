import type { EvidenceObservation } from "./evidence-engine.js";
import { type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import {
  buildMusicalStructure,
  type MusicalSection,
  type MusicalStructure,
  type MusicalStructureObservation,
  type MusicalTimePoint,
} from "./musical-structure.js";
import type {
  RestorationPerceptionReceipt,
  RestorationRuntimeClient,
  RestorationRuntimeSource,
  RestorationStemRole,
} from "./runtime-contract.js";

export interface RestorationPerceptionResult {
  artifactId: string;
  receipt: RestorationPerceptionReceipt;
  evidence: EvidenceObservation[];
  structure: MusicalStructure;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function admittedSample(sample: number, sampleCount: number): boolean {
  return Number.isInteger(sample) && sample >= 0 && sample < sampleCount;
}

function confidence(receipt: RestorationPerceptionReceipt, key: "tempo" | "beat" | "downbeat" | "section", fallback: number): number {
  const value = receipt.confidences?.[key];
  return clamp01(typeof value === "number" && Number.isFinite(value) ? value : fallback);
}

function points(
  samples: number[],
  sampleCount: number,
  evidencePrefix: string,
  pointConfidence: number,
): MusicalTimePoint[] {
  return [...new Set(samples)]
    .filter(sample => admittedSample(sample, sampleCount))
    .sort((a, b) => a - b)
    .map(sample => ({
      sample,
      confidence: pointConfidence,
      evidenceIds: [`${evidencePrefix}:${sample}`],
    }));
}

function sections(
  receipt: RestorationPerceptionReceipt,
  sectionConfidence: number,
): MusicalSection[] {
  return receipt.sections
    .filter(section =>
      Number.isInteger(section.startSample) &&
      Number.isInteger(section.endSample) &&
      section.startSample >= 0 &&
      section.endSample > section.startSample &&
      section.endSample <= receipt.sampleCount,
    )
    .map((section, index) => ({
      id: `section:${receipt.sourceArtifactId}:${index}:${section.startSample}`,
      index,
      startSample: section.startSample,
      endSample: section.endSample,
      label: section.label,
      confidence: clamp01(section.confidence || sectionConfidence),
      evidenceIds: [`perception:${receipt.runtimeReceiptId}:section:${index}`],
    }));
}

function evidenceFromReceipt(receipt: RestorationPerceptionReceipt): EvidenceObservation[] {
  const region = { startSample: 0, endSample: receipt.sampleCount };
  const shared = {
    providerId: receipt.providerId,
    providerVersion: receipt.providerVersion,
    runtimeReceiptId: receipt.runtimeReceiptId,
  };
  const evidence: EvidenceObservation[] = [];

  if (receipt.tempoBpm !== undefined && Number.isFinite(receipt.tempoBpm) && receipt.tempoBpm > 0) {
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:tempo`,
      kind: "music.tempo",
      confidence: confidence(receipt, "tempo", 0.75),
      sourceArtifactId: receipt.sourceArtifactId,
      region,
      data: { ...shared, tempoBpm: receipt.tempoBpm },
    });
  }

  for (const sample of [...new Set(receipt.beatSamples)].filter(value => admittedSample(value, receipt.sampleCount))) {
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:beat:${sample}`,
      kind: "music.beat",
      confidence: confidence(receipt, "beat", 0.75),
      sourceArtifactId: receipt.sourceArtifactId,
      region: { startSample: sample, endSample: Math.min(receipt.sampleCount, sample + 1) },
      data: shared,
    });
  }

  for (const sample of [...new Set(receipt.downbeatSamples)].filter(value => admittedSample(value, receipt.sampleCount))) {
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:downbeat:${sample}`,
      kind: "music.downbeat",
      confidence: confidence(receipt, "downbeat", 0.55),
      sourceArtifactId: receipt.sourceArtifactId,
      region: { startSample: sample, endSample: Math.min(receipt.sampleCount, sample + 1) },
      data: shared,
    });
  }

  receipt.sections.forEach((section, index) => {
    if (section.endSample <= section.startSample) return;
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:section:${index}`,
      kind: "music.section",
      confidence: clamp01(section.confidence),
      sourceArtifactId: receipt.sourceArtifactId,
      region: { startSample: section.startSample, endSample: section.endSample },
      data: {
        ...shared,
        label: section.label ?? "unlabeled",
      },
    });
  });

  receipt.transients.forEach((transient, index) => {
    if (!admittedSample(transient.sample, receipt.sampleCount)) return;
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:transient:${index}:${transient.sample}`,
      kind: "music.transient",
      confidence: clamp01(transient.confidence),
      sourceArtifactId: receipt.sourceArtifactId,
      region: {
        startSample: transient.sample,
        endSample: Math.min(receipt.sampleCount, transient.sample + 1),
      },
      data: {
        ...shared,
        strength: transient.strength,
      },
    });
  });

  if (receipt.spectralCentroidHz !== undefined && Number.isFinite(receipt.spectralCentroidHz)) {
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:spectral-centroid`,
      kind: "audio.spectral-centroid",
      confidence: 0.9,
      sourceArtifactId: receipt.sourceArtifactId,
      region,
      data: { ...shared, spectralCentroidHz: receipt.spectralCentroidHz },
    });
  }

  if (receipt.rms !== undefined && Number.isFinite(receipt.rms)) {
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:rms`,
      kind: "audio.rms",
      confidence: 0.95,
      sourceArtifactId: receipt.sourceArtifactId,
      region,
      data: { ...shared, rms: receipt.rms },
    });
  }

  if (receipt.role) {
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:role:${receipt.role}`,
      kind: "music.instrument-role",
      confidence: receipt.role === "unknown" ? 0.25 : 0.9,
      sourceArtifactId: receipt.sourceArtifactId,
      region,
      data: { ...shared, role: receipt.role },
    });
  }

  if (receipt.vocal) {
    evidence.push({
      id: `perception:${receipt.runtimeReceiptId}:vocal`,
      kind: "music.vocal-activity",
      confidence: clamp01(receipt.vocal.confidence),
      sourceArtifactId: receipt.sourceArtifactId,
      region,
      data: {
        ...shared,
        voicedFraction: receipt.vocal.voicedFraction,
        medianF0Hz: receipt.vocal.medianF0Hz ?? 0,
        minimumF0Hz: receipt.vocal.minimumF0Hz ?? 0,
        maximumF0Hz: receipt.vocal.maximumF0Hz ?? 0,
      },
    });
  }

  return evidence;
}

/**
 * MUSIC-RESTORE.3 runtime bridge.
 *
 * Real provider output is normalized into evidence and musical structure. The
 * receipt remains descriptive: it cannot authorize a restoration edit.
 */
export async function perceiveRestorationArtifact(input: {
  ownerUserId: string;
  artifact: StoredRestorationArtifact;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  role?: RestorationStemRole;
}): Promise<RestorationPerceptionResult> {
  if (input.artifact.ownerUserId !== input.ownerUserId) {
    throw new Error("Perception artifact owner mismatch.");
  }

  const runtimeUri = await input.store.resolveRuntimeUri(input.ownerUserId, input.artifact.id);
  const source: RestorationRuntimeSource = {
    artifactId: input.artifact.id,
    uri: runtimeUri,
    sha256: input.artifact.contentHash,
    mimeType: input.artifact.mimeType,
  };
  const receipt = await input.runtime.perceive({ source, role: input.role });

  if (receipt.sampleRate !== input.artifact.sampleRate) {
    throw new Error("Perception receipt sample rate does not match the registered artifact.");
  }
  if (receipt.sampleCount !== input.artifact.sampleCount) {
    throw new Error("Perception receipt sample count does not match the registered artifact.");
  }

  const beatConfidence = confidence(receipt, "beat", 0.75);
  const downbeatConfidence = confidence(receipt, "downbeat", 0.55);
  const sectionConfidence = confidence(receipt, "section", 0.6);
  const structureObservation: MusicalStructureObservation = {
    sourceArtifactId: input.artifact.id,
    sampleRate: receipt.sampleRate,
    beats: points(
      receipt.beatSamples,
      receipt.sampleCount,
      `perception:${receipt.runtimeReceiptId}:beat`,
      beatConfidence,
    ),
    downbeats: points(
      receipt.downbeatSamples,
      receipt.sampleCount,
      `perception:${receipt.runtimeReceiptId}:downbeat`,
      downbeatConfidence,
    ),
    sections: sections(receipt, sectionConfidence),
    tempoBpm: receipt.tempoBpm,
    meter: receipt.downbeatSamples.length >= 2
      ? { numerator: 4, denominator: 4, confidence: downbeatConfidence }
      : undefined,
    providerId: receipt.providerId,
    providerVersion: receipt.providerVersion,
  };

  return {
    artifactId: input.artifact.id,
    receipt,
    evidence: evidenceFromReceipt(receipt),
    structure: buildMusicalStructure({
      sourceArtifactId: input.artifact.id,
      sampleRate: receipt.sampleRate,
      observations: [structureObservation],
    }),
  };
}
