import { describe, expect, it } from 'vitest';
import { deriveDirectorTasteGuidance } from './director-taste.js';

describe('director taste', () => {
  it('turns strong learned mood/style preferences into directing guidance', () => {
    const guidance = deriveDirectorTasteGuidance({ signals: [
      { subject: '35mm-portrait', category: 'style', sentiment: 90, confidence: 80, sourceExperienceIds: ['m1', 'm2'] },
      { subject: 'tense nocturnal', category: 'mood', sentiment: 80, confidence: 70, sourceExperienceIds: ['m3', 'm4'] },
      { subject: 'horror', category: 'genre', sentiment: 75, confidence: 65, sourceExperienceIds: ['m5'] },
    ] });
    expect(guidance.controls.lookPreset).toBe('35mm-portrait');
    expect(guidance.controls.lightingMood).toBe('tense nocturnal');
    expect(guidance.promptNotes).toHaveLength(3);
    expect(guidance.evidenceIds).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
  });

  it('ignores weak signals so one movie cannot dictate the directing style', () => {
    const guidance = deriveDirectorTasteGuidance({ signals: [
      { subject: 'experimental', category: 'style', sentiment: 90, confidence: 40, sourceExperienceIds: ['m1'] },
    ] });
    expect(guidance.controls).toEqual({});
    expect(guidance.promptNotes).toEqual([]);
  });
});
