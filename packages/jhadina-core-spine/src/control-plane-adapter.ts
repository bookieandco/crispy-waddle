import type { Experience, SpineRunResult } from './types.js';
import type { JhadinaSpine } from './spine.js';

export interface ControlPlaneExperienceRequest {
  id: string;
  occurredAt: string;
  source: string;
  actor?: Experience['actor'];
  content: string;
  domain?: string;
  evidence?: Experience['evidence'];
}

export interface ControlPlaneRunResponse {
  requestId: string;
  run: SpineRunResult;
}

/**
 * Translation boundary from an external control surface into Core Spine.
 * It intentionally performs no planning, policy, or action execution itself.
 */
export class CoreSpineControlPlaneAdapter {
  constructor(private readonly spine: JhadinaSpine) {}

  async run(request: ControlPlaneExperienceRequest): Promise<ControlPlaneRunResponse> {
    const experience: Experience = {
      id: request.id,
      occurredAt: request.occurredAt,
      source: request.source,
      actor: request.actor ?? 'user',
      content: request.content,
      ...(request.domain ? { domain: request.domain } : {}),
      evidence: request.evidence ?? [],
    };

    return {
      requestId: request.id,
      run: await this.spine.run(experience),
    };
  }
}
