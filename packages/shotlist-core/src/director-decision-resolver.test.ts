import { describe, expect, it } from 'vitest';
import { resolveDirectorDecision } from './director-decision-resolver.js';

describe('resolveDirectorDecision', () => {
  it('keeps explicit human direction above situational and learned preferences', () => {
    const result = resolveDirectorDecision({
      explicit: { framing: 'wide' },
      defaults: { cameraMovement: 'static' },
      taste: { signals: [{ subject: 'close-up', category: 'style', sentiment: 100, confidence: 90, sourceExperienceIds: ['e1'] }] },
      behavior: { mode: 'serious', sliders: { humor: 5, seriousness: 100 }, domain: 'directoros' },
      situation: { emotionalWeight: 100, storyIntent: 'drama' },
    });
    expect(result.controls.framing).toBe('wide');
    expect(result.sources.framing).toBe('explicit');
  });
});
