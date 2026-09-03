import type { RestorationEvidence } from "./types.js";

export interface EvidenceObservation {
  id: string;
  kind: string;
  confidence: number;
  sourceArtifactId?: string;
  region?: { startSample: number; endSample: number };
  data: Record<string, string | number | boolean | null>;
}

export interface EvidenceBundle {
  id: string;
  sourceArtifactId: string;
  observations: RestorationEvidence[];
  overallConfidence: number;
}

export interface EvidenceProvider {
  readonly id: string;
  observe(input: {
    sourceArtifactId: string;
    region?: { startSample: number; endSample: number };
  }): EvidenceObservation[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export class RestorationEvidenceEngine {
  constructor(private readonly providers: EvidenceProvider[] = []) {}

  collect(input: {
    sourceArtifactId: string;
    region?: { startSample: number; endSample: number };
  }): EvidenceBundle {
    const observations = this.providers
      .flatMap((provider) => provider.observe(input))
      .map((observation) => ({
        id: observation.id,
        kind: observation.kind,
        confidence: clamp01(observation.confidence),
        sourceArtifactId: observation.sourceArtifactId ?? input.sourceArtifactId,
        region: observation.region ?? input.region,
        data: observation.data,
      }));

    const overallConfidence = observations.length
      ? observations.reduce((sum, item) => sum + item.confidence, 0) / observations.length
      : 0;

    return {
      id: `evidence:${input.sourceArtifactId}:${observations.length}`,
      sourceArtifactId: input.sourceArtifactId,
      observations,
      overallConfidence,
    };
  }
}
