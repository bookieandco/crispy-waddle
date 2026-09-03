import type { RestorationEvidence } from "./types.js";
import type { RestorationAudioInput } from "./audio-input.js";

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
  providerIds: string[];
  analysisVersions: string[];
}

export interface EvidenceProvider {
  readonly id: string;
  readonly version?: string;
  observe(input: RestorationAudioInput): EvidenceObservation[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export class RestorationEvidenceEngine {
  constructor(private readonly providers: EvidenceProvider[] = []) {}

  collect(input: RestorationAudioInput): EvidenceBundle {
    const observations = this.providers.flatMap((provider) =>
      provider.observe(input).map((observation) => ({
        ...observation,
        confidence: clamp01(observation.confidence),
        sourceArtifactId: observation.sourceArtifactId ?? input.sourceArtifactId,
        region: observation.region ?? {
          startSample: input.startSample ?? 0,
          endSample: (input.startSample ?? 0) + (input.channels[0]?.length ?? 0),
        },
        data: {
          ...observation.data,
          providerId: provider.id,
          providerVersion: provider.version ?? null,
        },
      })),
    );

    const overallConfidence = observations.length
      ? observations.reduce((sum, item) => sum + item.confidence, 0) / observations.length
      : 0;

    return {
      id: `evidence:${input.sourceArtifactId}:${observations.length}`,
      sourceArtifactId: input.sourceArtifactId,
      observations,
      overallConfidence,
      providerIds: this.providers.map((provider) => provider.id),
      analysisVersions: this.providers
        .map((provider) => provider.version)
        .filter((version): version is string => Boolean(version)),
    };
  }
}
