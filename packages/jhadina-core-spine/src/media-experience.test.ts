import { describe, expect, it } from 'vitest';
import { mediaToExperience, proposeMediaLearning } from './media-experience.js';

describe('media experience learning', () => {
  it('converts a watched movie into an experience without treating it as permanent personality', () => {
    const media = {
      id: 'movie-1', mediaType: 'movie' as const, title: 'Example Film', occurredAt: '2026-08-27T00:00:00.000Z',
      source: 'directoros', reaction: 'loved' as const, evidence: [{ id: 'e1', source: 'player', observedAt: '2026-08-27T00:00:00.000Z', summary: 'Playback completed' }],
    };
    const experience = mediaToExperience(media);
    const proposal = proposeMediaLearning(media);

    expect(experience.domain).toBe('media');
    expect(experience.content).toContain('Example Film');
    expect(proposal.personalityTraits[0].status).toBe('candidate');
    expect(proposal.personalityTraits[0].confidence).toBeLessThan(100);
  });
});
