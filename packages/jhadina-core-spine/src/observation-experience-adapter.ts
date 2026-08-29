import type { Experience, SpineRunResult } from './types.js';
import type { JhadinaSpine } from './spine.js';

export interface ObservationExperience {
  id: string;
  occurredAt: string;
  source: string;
  actor?: Experience['actor'];
  content: string;
  domain?: string;
  evidence?: Experience['evidence'];
  observation: {
    modality: 'screen' | 'audio' | 'file' | 'url' | 'video' | 'text' | 'image' | 'other';
    summary: string;
    contentRef?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ObservationExperienceResult {
  experience: Experience;
  run: SpineRunResult;
}

/** Converts a sensory/tool observation into the canonical Spine experience.
 * No memory, personality, policy, or action decisions are made here.
 */
export class ObservationExperienceAdapter {
  constructor(private readonly spine: JhadinaSpine) {}

  async ingest(observation: ObservationExperience): Promise<ObservationExperienceResult> {
    const experience: Experience = {
      id: observation.id,
      occurredAt: observation.occurredAt,
      source: observation.source,
      actor: observation.actor ?? 'user',
      content: observation.content,
      ...(observation.domain ? { domain: observation.domain } : {}),
      evidence: observation.evidence ?? [],
    };

    return { experience, run: await this.spine.run(experience) };
  }
}
