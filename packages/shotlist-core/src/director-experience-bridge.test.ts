import { describe, expect, it, vi } from 'vitest';
import { createDirectorExperienceBridge } from './director-experience-bridge.js';

describe('createDirectorExperienceBridge', () => {
  it('writes canonical generated events', async () => {
    const append = vi.fn().mockResolvedValue({ status: 'accepted' });
    const bridge = createDirectorExperienceBridge({ append });
    await bridge.appendGenerated({ eventId: 'e1', ownerId: 'o1', projectId: 'p1', shotId: 's1', takeId: 't1', provider: 'test', clipUri: 'clip://1', occurredAt: '2026-08-27T00:00:00.000Z', controls: { framing: 'close-up' } });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'director.take.generated', scope: { type: 'user', ownerId: 'o1' }, metadata: expect.objectContaining({ projectId: 'p1', takeId: 't1' }) }));
  });

  it('writes canonical feedback events', async () => {
    const append = vi.fn().mockResolvedValue({ status: 'accepted' });
    const bridge = createDirectorExperienceBridge({ append });
    await bridge.appendFeedback({ eventId: 'e2', ownerId: 'o1', projectId: 'p1', shotId: 's1', takeId: 't1', reaction: 'love', occurredAt: '2026-08-27T00:00:00.000Z' });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'director.take.feedback', metadata: expect.objectContaining({ projectId: 'p1', reaction: 'love' }) }));
  });
});
