import { describe, expect, it } from 'vitest';
import { mergeAttributeTasteIntoProfile } from './director-taste-attribute-bridge.js';

describe('mergeAttributeTasteIntoProfile', () => {
  it('maps lighting to mood and preserves other directing controls as style', () => {
    const result = mergeAttributeTasteIntoProfile({ signals: [] }, [
      { attribute: 'framing', subject: 'close-up', sentiment: 90, confidence: 70, sourceExperienceIds: ['e1'] },
      { attribute: 'lightingMood', subject: 'moody', sentiment: 80, confidence: 65, sourceExperienceIds: ['e2'] },
    ]);
    expect(result.signals).toEqual([
      { subject: 'close-up', category: 'style', sentiment: 90, confidence: 70, sourceExperienceIds: ['e1'] },
      { subject: 'moody', category: 'mood', sentiment: 80, confidence: 65, sourceExperienceIds: ['e2'] },
    ]);
  });
});
