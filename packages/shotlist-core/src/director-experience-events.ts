import type { ExperienceEvent } from '@jhadina/core-spine';

export interface DirectorTakeGeneratedInput {
  eventId: string;
  ownerId: string;
  projectId: string;
  shotId: string;
  takeId: string;
  provider: string;
  clipUri: string;
  occurredAt: string;
  controls: Record<string, string | number | boolean | null>;
}

export interface DirectorTakeFeedbackInput {
  eventId: string;
  ownerId: string;
  projectId: string;
  shotId: string;
  takeId: string;
  reaction: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  occurredAt: string;
  controls?: Record<string, string | number | boolean | null>;
}

export function createDirectorTakeGeneratedEvent(input: DirectorTakeGeneratedInput): ExperienceEvent {
  return {
    id: input.eventId, occurredAt: input.occurredAt, recordedAt: input.occurredAt,
    source: 'directoros', domain: 'directoros', actor: 'jhadina', content: `Generated take ${input.takeId} for shot ${input.shotId}.`,
    evidence: [], schemaVersion: 1, eventType: 'director.take.generated', outcome: 'completed', sensitivity: 'private',
    provenance: { sourceId: input.takeId, sourceType: 'director-take' }, scope: { type: 'user', ownerId: input.ownerId },
    metadata: { projectId: input.projectId, shotId: input.shotId, takeId: input.takeId, provider: input.provider, clipUri: input.clipUri, controls: JSON.stringify(input.controls) },
  };
}

export function createDirectorTakeFeedbackEvent(input: DirectorTakeFeedbackInput): ExperienceEvent {
  return {
    id: input.eventId, occurredAt: input.occurredAt, recordedAt: input.occurredAt,
    source: 'directoros', domain: 'directoros', actor: 'user', content: `Take ${input.takeId} feedback: ${input.reaction}.`,
    evidence: [], schemaVersion: 1, eventType: 'director.take.feedback', outcome: 'observed', sensitivity: 'private',
    provenance: { sourceId: input.takeId, sourceType: 'director-feedback' }, scope: { type: 'user', ownerId: input.ownerId },
    metadata: { projectId: input.projectId, shotId: input.shotId, takeId: input.takeId, reaction: input.reaction, controls: input.controls ? JSON.stringify(input.controls) : null },
  };
}
