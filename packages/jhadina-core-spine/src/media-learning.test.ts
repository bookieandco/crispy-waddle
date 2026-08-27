import { describe, expect, it, vi } from 'vitest';
import { recordMediaExperience } from './media-learning.js';
import type { ExperiencePort } from './experience.js';
import type { MediaExperience } from './media-experience.js';

const media: MediaExperience = {
  id: 'film-001', mediaType: 'movie', title: 'Example Film', occurredAt: '2026-08-27T00:00:00.000Z',
  source: 'test', completion: 100, reaction: 'loved', evidence: [],
};

describe('recordMediaExperience', () => {
  it('persists the observation and returns candidate learning evidence', async () => {
    const append = vi.fn().mockResolvedValue({ accepted: true, duplicate: false, conflict: false, eventId: 'media:film-001' });
    const result = await recordMediaExperience(media, { append } as unknown as ExperiencePort, { type: 'user', ownerId: 'owner-a' });

    expect(append).toHaveBeenCalledOnce();
    expect(append.mock.calls[0][0]).toMatchObject({ id: 'media:film-001', eventType: 'media.observed', scope: { ownerId: 'owner-a' } });
    expect(result.proposal.personalityTraits[0]?.status).toBe('candidate');
    expect(result.proposal.personalityTraits[0]?.confidence).toBe(55);
  });

  it('does not promote a single observation directly into permanent personality', async () => {
    const append = vi.fn().mockResolvedValue({ accepted: true, duplicate: false, conflict: false, eventId: 'media:film-001' });
    const result = await recordMediaExperience(media, { append } as unknown as ExperiencePort, { type: 'user', ownerId: 'owner-b' });
    expect(result.proposal.personalityTraits[0]?.status).toBe('candidate');
    expect(result.proposal.memory.reason).toContain('evidence');
  });
});
