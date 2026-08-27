import { describe, expect, it } from 'vitest';
import { applyDirectorTasteToControls } from './director-taste-controls.js';

describe('applyDirectorTasteToControls', () => {
  const profile = { version: 1, signals: [
    { category: 'framing', subject: 'close-up', sentiment: 90, confidence: 70 },
    { category: 'lightingMood', subject: 'moody', sentiment: 80, confidence: 65 },
    { category: 'style', subject: 'film-noir', sentiment: 85, confidence: 75 },
  ] } as any;

  it('fills missing controls from sufficiently confident taste signals', () => {
    expect(applyDirectorTasteToControls({}, profile)).toMatchObject({
      framing: 'close-up', lightingMood: 'moody', lookPreset: 'film-noir',
    });
  });

  it('never overrides an explicit director instruction', () => {
    expect(applyDirectorTasteToControls({ framing: 'wide', lightingMood: 'bright' }, profile)).toMatchObject({
      framing: 'wide', lightingMood: 'bright', lookPreset: 'film-noir',
    });
  });
});
