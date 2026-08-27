import { describe, expect, it } from 'vitest';
import { experienceToDirectorObservation, tasteProfileFromExperienceEvents } from './director-experience-learning.js';

const feedback = (id: string, ownerId: string, projectId: string, reaction: 'love' | 'like' | 'neutral' | 'dislike' | 'hate', framing: string) => ({
  id,
  occurredAt: '2026-08-27T00:00:00.000Z',
  recordedAt: '2026-08-27T00:00:01.000Z',
  source: 'directoros',
  domain: 'directoros',
  actor: 'user',
  content: 'take feedback',
  evidence: [],
  schemaVersion: 1,
  eventType: 'director.take.feedback',
  outcome: reaction,
  sensitivity: 'private',
  provenance: { sourceId: id, sourceType: 'director-take-feedback' },
  scope: { type: 'user', ownerId },
  metadata: { takeId: id, shotId: `shot-${id}`, reaction, controls: { framing }, projectId },
} as any);

describe('director experience learning', () => {
  it('derives scoped observations from canonical feedback events', () => {
    const observations = experienceToDirectorObservation(feedback('e1', 'a', 'p', 'love', 'close-up'));
    expect(observations).toMatchObject([{ ownerId: 'a', projectId: 'p', attribute: 'framing', subject: 'close-up', sentiment: 100, experienceId: 'e1' }]);
  });

  it('prevents another owner or project from influencing the profile', () => {
    const profile = tasteProfileFromExperienceEvents('a', 'p', [
      feedback('e1', 'a', 'p', 'love', 'close-up'),
      feedback('e2', 'b', 'p', 'love', 'wide'),
      feedback('e3', 'a', 'other', 'love', 'wide'),
    ]);
    expect(profile.signals).toHaveLength(1);
    expect(profile.signals[0]).toMatchObject({ subject: 'close-up', sentiment: 100 });
  });
});
