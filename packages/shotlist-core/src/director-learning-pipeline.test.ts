import { describe, expect, it } from 'vitest';
import { buildDirectorTasteProfile, feedbackToScopedObservations } from './director-learning-pipeline.js';

describe('director learning pipeline', () => {
  it('only learns from the requested owner and project', () => {
    const profile = buildDirectorTasteProfile('owner-a', 'project-a', [
      { ownerId: 'owner-a', projectId: 'project-a', attribute: 'framing', subject: 'close-up', sentiment: 100, confidence: 40, experienceId: 'e1' },
      { ownerId: 'owner-b', projectId: 'project-a', attribute: 'framing', subject: 'wide', sentiment: 100, confidence: 40, experienceId: 'e2' },
      { ownerId: 'owner-a', projectId: 'project-b', attribute: 'framing', subject: 'wide', sentiment: 100, confidence: 40, experienceId: 'e3' },
    ]);
    expect(profile.signals).toHaveLength(1);
    expect(profile.signals[0]).toMatchObject({ subject: 'close-up', sentiment: 100 });
  });

  it('emits owner/project-scoped observations from a feedback recipe', () => {
    expect(feedbackToScopedObservations(
      { takeId: 't1', shotId: 's1', reaction: 'like', observedAt: '2026-08-27T00:00:00.000Z' },
      { controls: { framing: 'close-up', lightingMood: 'moody' } },
      'owner-a', 'project-a',
    )).toMatchObject([
      { ownerId: 'owner-a', projectId: 'project-a', attribute: 'framing', subject: 'close-up', sentiment: 60 },
      { ownerId: 'owner-a', projectId: 'project-a', attribute: 'lightingMood', subject: 'moody', sentiment: 60 },
    ]);
  });
});
