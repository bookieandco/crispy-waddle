import type { ExperienceEvent, ExperiencePort, ExperienceScope } from './experience.js';

export type MediaKind = 'movie' | 'show' | 'episode' | 'song' | 'book' | 'game';

export interface MediaObservation {
  id: string;
  kind: MediaKind;
  title: string;
  creator?: string;
  observedAt: string;
  completion?: number;
  reaction?: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  notes?: string;
  sourceId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface MediaExperiencePort {
  observe(media: MediaObservation, scope: ExperienceScope): Promise<{ event: ExperienceEvent; result: Awaited<ReturnType<ExperiencePort['append']>> }>;
}

export class ExperienceMediaAdapter implements MediaExperiencePort {
  constructor(private readonly experiences: ExperiencePort) {}

  async observe(media: MediaObservation, scope: ExperienceScope) {
    const event: ExperienceEvent = {
      id: `media:${media.kind}:${media.id}`,
      occurredAt: media.observedAt,
      recordedAt: new Date().toISOString(),
      source: 'media-experience',
      domain: 'media',
      actor: 'user',
      content: `${media.kind} observed: ${media.title}${media.reaction ? ` (${media.reaction})` : ''}.`,
      evidence: [],
      schemaVersion: 1,
      eventType: 'media.observed',
      outcome: 'observed',
      sensitivity: 'private',
      provenance: { sourceId: media.sourceId ?? media.id, sourceType: 'media-observation' },
      scope,
      metadata: {
        kind: media.kind,
        title: media.title,
        creator: media.creator ?? null,
        completion: media.completion ?? null,
        reaction: media.reaction ?? null,
        notes: media.notes ?? null,
        ...media.metadata,
      },
    };

    return { event, result: await this.experiences.append(event) };
  }
}
