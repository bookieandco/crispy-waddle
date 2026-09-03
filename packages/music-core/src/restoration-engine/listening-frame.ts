import type { MusicalEventObservation } from "./event-perception.js";
import type { MusicalStructure } from "./musical-structure.js";

export interface ListeningFrameRegion {
  startSample: number;
  endSample: number;
}

export interface ListeningSectionContext {
  sectionId?: string;
  phraseId?: string;
  barId?: string;
  beatSample?: number;
  confidence: number;
}

export interface ListeningRhythmEvidence {
  tempoBpm?: number;
  beatConfidence: number;
  grooveConfidence: number;
  timingDeviation?: number;
  evidenceIds: string[];
}

export interface ListeningHarmonyEvidence {
  key?: string;
  chord?: string;
  confidence: number;
  evidenceIds: string[];
  abstained: boolean;
}

export interface ListeningDynamicsEvidence {
  rms?: number;
  peak?: number;
  crestFactor?: number;
  loudness?: number;
  variation?: number;
  confidence: number;
  evidenceIds: string[];
}

export interface ListeningTimbreEvidence {
  descriptors: string[];
  brightness?: number;
  spectralCentroid?: number;
  spectralFlatness?: number;
  confidence: number;
  evidenceIds: string[];
}

export interface ListeningSpatialEvidence {
  channelBalance?: number;
  stereoWidth?: number;
  phaseRisk?: number;
  confidence: number;
  evidenceIds: string[];
}

export interface ListeningPerformanceEvidence {
  articulation?: string[];
  dynamicsVariation?: number;
  microtimingDeviation?: number;
  expressiveDescriptors?: string[];
  confidence: number;
  evidenceIds: string[];
}

export interface ListeningRecordingEvidence {
  noiseLevel?: number;
  distortionLevel?: number;
  tapeCharacter?: number;
  roomLevel?: number;
  confidence: number;
  evidenceIds: string[];
}

export interface ListeningAnomalyEvidence {
  damageEvidenceIds: string[];
  eventIds: string[];
  descriptors: string[];
  confidence: number;
}

/**
 * A structured listening snapshot. Facts, observations, and perceptual hypotheses
 * remain distinguishable so Jhadina can judge candidates without inventing edits.
 */
export interface ListeningFrame {
  id: string;
  version: string;
  sourceArtifactId: string;
  region: ListeningFrameRegion;
  structure: ListeningSectionContext;
  eventIds: string[];
  voices: string[];
  instruments: string[];
  rhythm: ListeningRhythmEvidence;
  harmony?: ListeningHarmonyEvidence;
  dynamics: ListeningDynamicsEvidence;
  timbre: ListeningTimbreEvidence;
  spatial: ListeningSpatialEvidence;
  performance: ListeningPerformanceEvidence;
  recording: ListeningRecordingEvidence;
  anomalies: ListeningAnomalyEvidence;
  perceptualDescriptors: Array<{ descriptor: string; confidence: number; evidenceIds: string[] }>;
  musicalIntentHypotheses: Array<{ hypothesis: string; confidence: number; evidenceIds: string[] }>;
  evidenceIds: string[];
  confidence: number;
  abstained: boolean;
  reasons: string[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const unique = (values: string[]): string[] => [...new Set(values)];

const validRegion = (region: ListeningFrameRegion): boolean =>
  Number.isInteger(region.startSample) &&
  Number.isInteger(region.endSample) &&
  region.startSample >= 0 &&
  region.endSample > region.startSample;

function structureContext(structure: MusicalStructure, region: ListeningFrameRegion): ListeningSectionContext {
  const sample = region.startSample;
  const section = structure.sections.find((item) => sample >= item.startSample && sample < item.endSample);
  const phrase = structure.phrases.find((item) => sample >= item.startSample && sample < item.endSample);
  const bar = structure.bars.find((item) => sample >= item.start.sample && sample < item.end.sample);
  const beat = structure.beats.find((item) => item.sample >= region.startSample && item.sample < region.endSample);

  return {
    sectionId: section?.id,
    phraseId: phrase?.id,
    barId: bar?.id,
    beatSample: beat?.sample,
    confidence: clamp01(Math.max(section?.confidence ?? 0, phrase?.confidence ?? 0, bar?.confidence ?? 0, beat?.confidence ?? 0)),
  };
}

/**
 * Builds a listening frame from already-derived evidence. It never authorizes
 * restoration, replacement, mixing, or mastering operations.
 */
export function buildListeningFrame(input: {
  sourceArtifactId: string;
  region: ListeningFrameRegion;
  structure: MusicalStructure;
  events: MusicalEventObservation[];
  rhythm?: Partial<ListeningRhythmEvidence>;
  harmony?: ListeningHarmonyEvidence;
  dynamics?: Partial<ListeningDynamicsEvidence>;
  timbre?: Partial<ListeningTimbreEvidence>;
  spatial?: Partial<ListeningSpatialEvidence>;
  performance?: Partial<ListeningPerformanceEvidence>;
  recording?: Partial<ListeningRecordingEvidence>;
  anomaly?: Partial<ListeningAnomalyEvidence>;
  voices?: string[];
  instruments?: string[];
  perceptualDescriptors?: Array<{ descriptor: string; confidence: number; evidenceIds: string[] }>;
  musicalIntentHypotheses?: Array<{ hypothesis: string; confidence: number; evidenceIds: string[] }>;
  evidenceIds?: string[];
}): ListeningFrame {
  if (input.sourceArtifactId !== input.structure.sourceArtifactId) {
    throw new Error("Listening frame source artifact does not match musical structure source artifact.");
  }
  if (!validRegion(input.region)) throw new Error("Listening frame region is invalid.");

  const events = input.events.filter((event) =>
    event.sourceArtifactId === input.sourceArtifactId &&
    event.region.startSample < input.region.endSample &&
    input.region.startSample < event.region.endSample,
  );
  const eventIds = events.map((event) => event.id);
  const evidenceIds = unique([
    ...eventIds.flatMap((id) => events.find((event) => event.id === id)?.evidenceIds ?? []),
    ...(input.evidenceIds ?? []),
    ...(input.rhythm?.evidenceIds ?? []),
    ...(input.dynamics?.evidenceIds ?? []),
    ...(input.timbre?.evidenceIds ?? []),
    ...(input.spatial?.evidenceIds ?? []),
    ...(input.performance?.evidenceIds ?? []),
    ...(input.recording?.evidenceIds ?? []),
    ...(input.anomaly?.damageEvidenceIds ?? []),
  ]);
  const structure = structureContext(input.structure, input.region);
  const confidenceInputs = [
    structure.confidence,
    input.rhythm?.beatConfidence,
    input.rhythm?.grooveConfidence,
    input.dynamics?.confidence,
    input.timbre?.confidence,
    input.spatial?.confidence,
    input.performance?.confidence,
    input.recording?.confidence,
  ].filter((value): value is number => typeof value === "number");
  const confidence = clamp01(confidenceInputs.length
    ? confidenceInputs.reduce((sum, value) => sum + clamp01(value), 0) / confidenceInputs.length
    : 0);

  const reasons: string[] = [
    "ListeningFrame is an evidence representation for comparison and judgment, not edit authorization.",
  ];
  if (!eventIds.length) reasons.push("No musical events were established in this region.");
  if (!structure.sectionId && !structure.phraseId && !structure.barId) reasons.push("No reliable structural context was established at the frame start.");
  if (!evidenceIds.length) reasons.push("No supporting evidence references were supplied.");

  return {
    id: `listen:${input.sourceArtifactId}:${input.region.startSample}:${input.region.endSample}`,
    version: "1.0.0",
    sourceArtifactId: input.sourceArtifactId,
    region: input.region,
    structure,
    eventIds: unique(eventIds),
    voices: unique(input.voices ?? []),
    instruments: unique(input.instruments ?? []),
    rhythm: {
      tempoBpm: input.rhythm?.tempoBpm ?? input.structure.tempoBpm,
      beatConfidence: clamp01(input.rhythm?.beatConfidence ?? (input.structure.beats.length ? input.structure.confidence : 0)),
      grooveConfidence: clamp01(input.rhythm?.grooveConfidence ?? 0),
      timingDeviation: input.rhythm?.timingDeviation,
      evidenceIds: unique(input.rhythm?.evidenceIds ?? []),
    },
    harmony: input.harmony ? {
      ...input.harmony,
      confidence: clamp01(input.harmony.confidence),
      evidenceIds: unique(input.harmony.evidenceIds),
    } : undefined,
    dynamics: {
      rms: input.dynamics?.rms,
      peak: input.dynamics?.peak,
      crestFactor: input.dynamics?.crestFactor,
      loudness: input.dynamics?.loudness,
      variation: input.dynamics?.variation,
      confidence: clamp01(input.dynamics?.confidence ?? 0),
      evidenceIds: unique(input.dynamics?.evidenceIds ?? []),
    },
    timbre: {
      descriptors: unique(input.timbre?.descriptors ?? []),
      brightness: input.timbre?.brightness,
      spectralCentroid: input.timbre?.spectralCentroid,
      spectralFlatness: input.timbre?.spectralFlatness,
      confidence: clamp01(input.timbre?.confidence ?? 0),
      evidenceIds: unique(input.timbre?.evidenceIds ?? []),
    },
    spatial: {
      channelBalance: input.spatial?.channelBalance,
      stereoWidth: input.spatial?.stereoWidth,
      phaseRisk: input.spatial?.phaseRisk,
      confidence: clamp01(input.spatial?.confidence ?? 0),
      evidenceIds: unique(input.spatial?.evidenceIds ?? []),
    },
    performance: {
      articulation: unique(input.performance?.articulation ?? []),
      dynamicsVariation: input.performance?.dynamicsVariation,
      microtimingDeviation: input.performance?.microtimingDeviation,
      expressiveDescriptors: unique(input.performance?.expressiveDescriptors ?? []),
      confidence: clamp01(input.performance?.confidence ?? 0),
      evidenceIds: unique(input.performance?.evidenceIds ?? []),
    },
    recording: {
      noiseLevel: input.recording?.noiseLevel,
      distortionLevel: input.recording?.distortionLevel,
      tapeCharacter: input.recording?.tapeCharacter,
      roomLevel: input.recording?.roomLevel,
      confidence: clamp01(input.recording?.confidence ?? 0),
      evidenceIds: unique(input.recording?.evidenceIds ?? []),
    },
    anomalies: {
      damageEvidenceIds: unique(input.anomaly?.damageEvidenceIds ?? []),
      eventIds: unique(input.anomaly?.eventIds ?? eventIds.filter((id) => events.find((event) => event.id === id)?.protected === false)),
      descriptors: unique(input.anomaly?.descriptors ?? []),
      confidence: clamp01(input.anomaly?.confidence ?? 0),
    },
    perceptualDescriptors: (input.perceptualDescriptors ?? []).map((item) => ({
      descriptor: item.descriptor,
      confidence: clamp01(item.confidence),
      evidenceIds: unique(item.evidenceIds),
    })),
    musicalIntentHypotheses: (input.musicalIntentHypotheses ?? []).map((item) => ({
      hypothesis: item.hypothesis,
      confidence: clamp01(item.confidence),
      evidenceIds: unique(item.evidenceIds),
    })),
    evidenceIds,
    confidence,
    abstained: confidence < 0.5,
    reasons,
  };
}
