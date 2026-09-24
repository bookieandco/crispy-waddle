import { describe, expect, it } from 'vitest';
import { compileAccountPersona, compileVoiceDNA } from './voice-dna.js';

describe('voice DNA', () => {
  it('learns only approved samples', () => {
    const dna = compileVoiceDNA([
      { id: 's1' as never, text: 'lol this is funny', approved: true, source: 'comment' },
      { id: 's2' as never, text: 'ignore this', approved: false, source: 'comment' },
    ]);
    expect(dna.evidence).toEqual(['s1']);
    expect(dna.humor).toBeGreaterThan(0);
  });

  it('compiles multiple account personas from one base voice', () => {
    const dna = compileVoiceDNA([{ id: 's1' as never, text: 'lol that is funny', approved: true, source: 'post' }]);
    const dog = compileAccountPersona(dna, { accountId: 'acct:dog' as never, platform: 'instagram', tone: 'playful', vocabularyAdditions: ['paws', 'zoomies'], characterDescription: 'The base voice wearing a mischievous dog mascot.' });
    const pro = compileAccountPersona(dna, { accountId: 'acct:pro' as never, platform: 'linkedin', tone: 'professional', characterDescription: 'The base voice presented professionally.' });
    expect(dog.baseVoiceId).toBe(pro.baseVoiceId);
    expect(dog.vocabulary).toContain('paws');
    expect(pro.tone).toBe('professional');
  });
});
