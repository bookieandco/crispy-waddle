import type { EvidenceRef } from '@jhadina/core-spine';
import type { IntelligenceModality, IntelligencePrivacyClass } from './intelligence-fabric.js';

export type PerceptionModality = Exclude<IntelligenceModality, 'text' | 'code'>;

export interface PerceptionAsset {
  readonly id: string;
  readonly modality: PerceptionModality;
  readonly mediaType: string;
  readonly privacyClass: IntelligencePrivacyClass;
  /** Opaque reference resolved by a governed provider/worker; never executable input. */
  readonly assetRef: string;
}

export interface PerceptionObservation {
  readonly assetId: string;
  readonly modality: PerceptionModality;
  readonly evidence: readonly EvidenceRef[];
  readonly uncertainty: readonly string[];
}

export interface PerceptionProvider {
  readonly name: string;
  readonly modalities: readonly PerceptionModality[];
  readonly maxPrivacyClass: IntelligencePrivacyClass;
  understand(asset: PerceptionAsset): Promise<PerceptionObservation>;
}

/**
 * Read-only multimodal understanding bridge. Generation/editing is explicitly
 * out of scope and remains a governed Director capability.
 */
export class MultimodalPerceptionRouter {
  constructor(private readonly providers: readonly PerceptionProvider[]) {}

  async understand(asset: PerceptionAsset): Promise<PerceptionObservation> {
    const provider = this.providers.find((p) =>
      p.modalities.includes(asset.modality) && privacyAllows(p.maxPrivacyClass, asset.privacyClass));
    if (!provider) throw new PerceptionUnavailableError(asset.modality, asset.privacyClass);
    const observation = await provider.understand(asset);
    if (observation.assetId !== asset.id || observation.modality !== asset.modality) {
      throw new Error('PERCEPTION_PROVIDER_RESULT_MISMATCH');
    }
    return Object.freeze({
      ...observation,
      evidence: Object.freeze(observation.evidence.map((ref) => Object.freeze({ ...ref }))),
      uncertainty: Object.freeze([...observation.uncertainty]),
    });
  }
}

export class PerceptionUnavailableError extends Error {
  constructor(modality: PerceptionModality, privacy: IntelligencePrivacyClass) {
    super(`PERCEPTION_PROVIDER_UNAVAILABLE:${modality}:${privacy}`);
    this.name = 'PerceptionUnavailableError';
  }
}

const rank:Record<IntelligencePrivacyClass,number>={public:0,internal:1,sensitive:2,restricted:3};
function privacyAllows(max:IntelligencePrivacyClass, requested:IntelligencePrivacyClass){return rank[requested]<=rank[max];}
