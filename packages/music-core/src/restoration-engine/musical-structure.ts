export type StructureLevel = "beat" | "bar" | "phrase" | "segment" | "section";

export interface MusicalTimePoint {
  sample: number;
  confidence: number;
  evidenceIds: string[];
}

export interface MusicalBar {
  id: string;
  index: number;
  start: MusicalTimePoint;
  end: MusicalTimePoint;
  beatCount: number;
  confidence: number;
}

export interface MusicalPhrase {
  id: string;
  index: number;
  startSample: number;
  endSample: number;
  confidence: number;
  evidenceIds: string[];
}

export interface MusicalSegment {
  id: string;
  index: number;
  startSample: number;
  endSample: number;
  label?: string;
  confidence: number;
  evidenceIds: string[];
}

export interface MusicalSection {
  id: string;
  index: number;
  startSample: number;
  endSample: number;
  label?: string;
  confidence: number;
  evidenceIds: string[];
}

export interface MusicalStructure {
  version: string;
  sourceArtifactId: string;
  sampleRate: number;
  beats: MusicalTimePoint[];
  downbeats: MusicalTimePoint[];
  bars: MusicalBar[];
  phrases: MusicalPhrase[];
  segments: MusicalSegment[];
  sections: MusicalSection[];
  tempoBpm?: number;
  meter?: { numerator: number; denominator: number; confidence: number };
  confidence: number;
  abstained: boolean;
  reasons: string[];
}

export interface MusicalStructureObservation {
  sourceArtifactId: string;
  sampleRate: number;
  beats?: MusicalTimePoint[];
  downbeats?: MusicalTimePoint[];
  sections?: MusicalSection[];
  tempoBpm?: number;
  meter?: { numerator: number; denominator: number; confidence: number };
  providerId: string;
  providerVersion: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const validSample = (sample: number): boolean => Number.isInteger(sample) && sample >= 0;

const normalizePoint = (point: MusicalTimePoint): MusicalTimePoint => ({
  sample: Math.max(0, Math.floor(point.sample)),
  confidence: clamp01(point.confidence),
  evidenceIds: [...new Set(point.evidenceIds)],
});

const uniqueSortedPoints = (points: MusicalTimePoint[]): MusicalTimePoint[] =>
  [...points].map(normalizePoint).sort((a, b) => a.sample - b.sample)
    .filter((point, index, all) => index === 0 || point.sample !== all[index - 1].sample);

/**
 * Converts independent structure observations into one conservative evidence model.
 * Structure is descriptive: it never authorizes an audio edit.
 */
export function buildMusicalStructure(input: {
  sourceArtifactId: string;
  sampleRate: number;
  observations: MusicalStructureObservation[];
}): MusicalStructure {
  const observations = input.observations.filter((item) => item.sourceArtifactId === input.sourceArtifactId);
  const beats = uniqueSortedPoints(observations.flatMap((item) => item.beats ?? []));
  const downbeats = uniqueSortedPoints(observations.flatMap((item) => item.downbeats ?? []));

  const sections = observations.flatMap((item) => item.sections ?? [])
    .filter((section) => section.endSample > section.startSample)
    .map((section, index) => ({ ...section, index, confidence: clamp01(section.confidence), evidenceIds: [...new Set(section.evidenceIds)] }))
    .sort((a, b) => a.startSample - b.startSample);

  const bars: MusicalBar[] = [];
  for (let i = 0; i < downbeats.length; i += 1) {
    const start = downbeats[i];
    const end = downbeats[i + 1];
    if (!end || end.sample <= start.sample) continue;
    const beatCount = beats.filter((beat) => beat.sample >= start.sample && beat.sample < end.sample).length;
    bars.push({
      id: `bar:${input.sourceArtifactId}:${i}:${start.sample}`,
      index: i,
      start,
      end,
      beatCount,
      confidence: clamp01((start.confidence + end.confidence) / 2),
    });
  }

  const phrases: MusicalPhrase[] = [];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    phrases.push({
      id: `phrase:${input.sourceArtifactId}:${i}:${section.startSample}`,
      index: i,
      startSample: section.startSample,
      endSample: section.endSample,
      confidence: section.confidence,
      evidenceIds: section.evidenceIds,
    });
  }

  const tempoValues = observations.map((item) => item.tempoBpm).filter((value): value is number => typeof value === "number" && value > 0);
  const tempoBpm = tempoValues.length ? tempoValues.reduce((sum, value) => sum + value, 0) / tempoValues.length : undefined;
  const meter = observations.find((item) => item.meter)?.meter;
  const providerConfidence = observations.length
    ? observations.reduce((sum, item) => sum + (item.beats?.length ? 1 : 0), 0) / observations.length
    : 0;
  const confidence = clamp01(0.5 * (beats.length ? providerConfidence : 0) + 0.5 * (downbeats.length ? 1 : 0));
  const reasons: string[] = ["Musical structure is evidence for listening and alignment, not edit authorization."];

  if (!observations.length) reasons.push("No structure observations were supplied.");
  if (!beats.length) reasons.push("No beat grid was established.");
  if (!downbeats.length) reasons.push("No downbeat grid was established.");
  if (sections.length === 0) reasons.push("No section boundaries were established.");

  return {
    version: "1.0.0",
    sourceArtifactId: input.sourceArtifactId,
    sampleRate: input.sampleRate,
    beats,
    downbeats,
    bars,
    phrases,
    segments: [],
    sections,
    tempoBpm,
    meter,
    confidence,
    abstained: confidence < 0.5,
    reasons,
  };
}

/** Returns the structure interval containing a sample, without inventing one. */
export function locateStructureAtSample(structure: MusicalStructure, sample: number): {
  section?: MusicalSection;
  phrase?: MusicalPhrase;
  bar?: MusicalBar;
} {
  if (!validSample(sample)) return {};
  const section = structure.sections.find((item) => sample >= item.startSample && sample < item.endSample);
  const phrase = structure.phrases.find((item) => sample >= item.startSample && sample < item.endSample);
  const bar = structure.bars.find((item) => sample >= item.start.sample && sample < item.end.sample);
  return { section, phrase, bar };
}
