import { describe, expect, it } from 'vitest';
import { InMemoryVoiceMemoryStore, createVoiceCorrection } from './voice-memory.js';

describe('voice memory', () => {
  it('keeps corrections gated until approved', () => {
    const memory = createVoiceCorrection({ id: 'vm:1' as never, text: 'too corporate', polarity: 'negative', createdAt: '2026-08-30T00:00:00Z' });
    const store = new InMemoryVoiceMemoryStore().add(memory);
    expect(store.retrieve('corporate')).toHaveLength(0);
    const approved = store.approve(memory.id);
    expect(approved.retrieve('corporate')).toHaveLength(1);
  });

  it('supports negative voice examples without deleting provenance', () => {
    const memory = createVoiceCorrection({ id: 'vm:2' as never, text: 'I would never say this', polarity: 'negative', createdAt: '2026-08-30T00:00:00Z', evidence: ['draft:2' as never] });
    expect(memory.polarity).toBe('negative');
    expect(memory.evidence).toEqual(['draft:2']);
  });
});
