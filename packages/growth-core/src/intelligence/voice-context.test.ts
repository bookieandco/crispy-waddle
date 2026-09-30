import { describe, expect, it } from 'vitest';
import { buildVoiceContext } from './voice-context.js';
import { InMemoryVoiceMemoryStore } from './voice-memory.js';

describe('voice context', () => {
  it('combines canonical voice, account persona, platform and retrieved memories', () => {
    const memory = { id: 'vm:1' as never, text: 'keep it playful', polarity: 'positive' as const, status: 'approved' as const, source: 'director' as const, tags: ['tone'], createdAt: '2026-08-30T00:00:00Z', evidence: [] };
    const store = new InMemoryVoiceMemoryStore([memory]);
    const voice = { id: 'voice:base' as never, version: 1, traits: { humor: 0.8 }, preferredPhrases: [], avoidPhrases: [], rhythm: 'short' as const, humor: 0.8, sarcasm: 0.5, boldness: 0.7, warmth: 0.7, profanity: 0.2, evidence: [] };
    const persona = { accountId: 'acct:pupson' as never, platform: 'instagram', baseVoiceId: voice.id, traits: voice.traits, vocabulary: ['paws'], tone: 'playful' as const, characterDescription: 'voice plus dog mascot' };
    const context = buildVoiceContext({ accountId: persona.accountId, platform: 'instagram', conversation: 'keep it playful', persona, voice }, store);
    expect(context.baseVoiceId).toBe('voice:base');
    expect(context.relevantMemories).toHaveLength(1);
    expect(context.instructions.join(' ')).toContain('keep it playful');
  });
});
