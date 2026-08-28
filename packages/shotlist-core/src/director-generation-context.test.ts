import { describe, expect, it } from 'vitest';
import { buildDirectorGenerationContext, mergeDirectorGenerationControls } from './director-generation-context.js';

describe('director generation context', () => {
  it('translates decision context into generation guidance', () => {
    const guidance = buildDirectorGenerationContext({
      projectId: 'p1', shot: { id: 's1', director: {} } as any,
      decisionContext: {
        sliders: { humor: 90, playfulness: 90, curiosity: 80, boldness: 90, warmth: 80, formality: 20 },
        mode: 'serious',
        taste: { signals: [{ category: 'style', subject: 'film-noir', sentiment: 90, confidence: 80, sourceExperienceIds: ['e1'] }] },
        storyIntent: 'serious character moment',
      },
    } as any);
    expect(guidance).toMatchObject({ tone: 'serious', jokePermission: 0, creativeRisk: 45 });
  });

  it('lets explicit shot controls override learned guidance', () => {
    expect(mergeDirectorGenerationControls({ framing: 'wide' } as any, { controls: { framing: 'close-up', lookPreset: 'film-noir' } } as any))
      .toMatchObject({ framing: 'wide', lookPreset: 'film-noir' });
  });
});
