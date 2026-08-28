import { describe, expect, it, vi } from 'vitest';
import { createDirectorActionHandlers } from './jhadina-adapter.js';

describe('DirectorOS Jhadina decision context', () => {
  it('passes serious-mode guidance and learned taste into generation', async () => {
    const generateClip = vi.fn().mockResolvedValue({ shotId: 'asset-1', uri: 'https://example.test/take.mp4', provider: 'test' });
    const [handler] = createDirectorActionHandlers({ name: 'test', generateClip } as any);

    await handler.execute({
      projectId: 'p1',
      shot: { id: 's1', action: 'Character enters the room.', director: {} } as any,
      decisionContext: {
        sliders: { humor: 90, playfulness: 90, curiosity: 80, boldness: 90, warmth: 80, formality: 20 },
        mode: 'serious',
        taste: { signals: [{ category: 'style', subject: 'film-noir', sentiment: 90, confidence: 80, sourceExperienceIds: ['e1'] }] },
        storyIntent: 'serious character moment',
      },
    });

    expect(generateClip).toHaveBeenCalledOnce();
    const [, prompt] = generateClip.mock.calls[0];
    expect(prompt).toContain('Situational mode: serious');
    expect(prompt).toContain('Jhadina directing guidance');
    expect(prompt).toContain('film-noir');
  });
});
