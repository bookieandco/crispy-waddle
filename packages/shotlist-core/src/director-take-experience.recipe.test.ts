import { describe, expect, it, vi } from 'vitest';
import { recordGeneratedDirectorTakeExperience } from './director-take-experience.js';

describe('recordGeneratedDirectorTakeExperience recipe persistence', () => {
  it('persists project scope and resolved controls', async () => {
    const append = vi.fn().mockResolvedValue({ status: 'accepted' });
    await recordGeneratedDirectorTakeExperience({
      takeId: 't1', shotId: 's1', clipUri: 'clip://1', provider: 'test',
      occurredAt: '2026-08-27T00:00:00.000Z', projectId: 'p1',
      controls: { framing: 'close-up', lightingMood: 'moody' } as any,
    }, { append } as any, 'o1');
    const event = append.mock.calls[0][0];
    expect(event.metadata).toMatchObject({ projectId: 'p1', shotId: 's1', takeId: 't1', controls: { framing: 'close-up', lightingMood: 'moody' } });
  });
});
