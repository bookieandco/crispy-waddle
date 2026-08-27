import { describe, expect, it, vi } from 'vitest';
import { ExperienceMediaAdapter, type MediaObservation } from './media-experience-adapter.js';
import type { ExperienceEvent, ExperiencePort } from './experience.js';

const media: MediaObservation = {
  id: 'movie-001', kind: 'movie', title: 'Example Film', creator: 'Example Director',
  observedAt: '2026-08-27T00:00:00.000Z', completion: 100, reaction: 'love', notes: 'Great cinematography',
};

describe('ExperienceMediaAdapter', () => {
  it('persists a movie observation through the existing ExperiencePort', async () => {
    const append = vi.fn().mockResolvedValue({ accepted: true, duplicate: false, conflict: false, eventId: 'media:movie:movie-001' });
    const port = { append } as unknown as ExperiencePort;
    const result = await new ExperienceMediaAdapter(port).observe(media, { type: 'user', ownerId: 'owner-a' });

    expect(append).toHaveBeenCalledOnce();
    expect(append.mock.calls[0][0]).toMatchObject({
      id: 'media:movie:movie-001', eventType: 'media.observed', domain: 'media',
      scope: { type: 'user', ownerId: 'owner-a' },
      metadata: { kind: 'movie', title: 'Example Film', completion: 100, reaction: 'love' },
    });
    expect(result.result.accepted).toBe(true);
  });

  it('preserves duplicate/conflict results from persistence', async () => {
    const port = { append: vi.fn().mockResolvedValue({ accepted: true, duplicate: true, conflict: false, eventId: 'media:movie:movie-001' }) } as unknown as ExperiencePort;
    const result = await new ExperienceMediaAdapter(port).observe(media, { type: 'user', ownerId: 'owner-b' });
    expect(result.result.duplicate).toBe(true);
    expect((result.event as ExperienceEvent).scope.ownerId).toBe('owner-b');
  });
});
