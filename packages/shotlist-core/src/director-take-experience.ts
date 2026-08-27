import type { ExperienceEvent, ExperiencePort } from '../../packages/jhadina-core-spine/src/experience.js';
import type { DirectorTakeFeedback } from './director-taste-feedback.js';

export async function recordDirectorTakeExperience(
  feedback: DirectorTakeFeedback,
  experiences: ExperiencePort,
  ownerId: string,
): Promise<Awaited<ReturnType<ExperiencePort['append']>>> {
  const event: ExperienceEvent = {
    id: `director:take:${feedback.takeId}:feedback`,
    occurredAt: feedback.observedAt,
    recordedAt: new Date().toISOString(),
    source: 'directoros',
    domain: 'directoros',
    actor: 'user',
    content: `Director take ${feedback.takeId} evaluated as ${feedback.reaction}.${feedback.notes ? ` ${feedback.notes}` : ''}`,
    evidence: [],
    schemaVersion: 1,
    eventType: 'director.take.feedback',
    outcome: feedback.reaction,
    sensitivity: 'private',
    provenance: { sourceId: feedback.takeId, sourceType: 'director-take-feedback' },
    scope: { type: 'user', ownerId },
    metadata: { shotId: feedback.shotId, reaction: feedback.reaction, notes: feedback.notes ?? null },
  };
  return experiences.append(event);
}
