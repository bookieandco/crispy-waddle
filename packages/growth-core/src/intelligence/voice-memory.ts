import type { GrowthId } from '../domain/types.js';

export type VoiceMemoryPolarity = 'positive' | 'negative';
export type VoiceMemoryStatus = 'candidate' | 'approved' | 'rejected';

export interface VoiceMemory {
  readonly id: GrowthId;
  readonly text: string;
  readonly polarity: VoiceMemoryPolarity;
  readonly status: VoiceMemoryStatus;
  readonly source: 'director' | 'approved_content' | 'correction' | 'experiment';
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly evidence: readonly GrowthId[];
}

export interface VoiceMemoryStore {
  readonly memories: readonly VoiceMemory[];
  add(memory: VoiceMemory): VoiceMemoryStore;
  approve(id: GrowthId): VoiceMemoryStore;
  reject(id: GrowthId): VoiceMemoryStore;
  retrieve(query: string, limit?: number): readonly VoiceMemory[];
}

export class InMemoryVoiceMemoryStore implements VoiceMemoryStore {
  constructor(readonly memories: readonly VoiceMemory[] = []) {}

  add(memory: VoiceMemory): VoiceMemoryStore {
    return new InMemoryVoiceMemoryStore([...this.memories, memory]);
  }

  approve(id: GrowthId): VoiceMemoryStore {
    return new InMemoryVoiceMemoryStore(this.memories.map((memory) => memory.id === id ? { ...memory, status: 'approved' } : memory));
  }

  reject(id: GrowthId): VoiceMemoryStore {
    return new InMemoryVoiceMemoryStore(this.memories.map((memory) => memory.id === id ? { ...memory, status: 'rejected' } : memory));
  }

  retrieve(query: string, limit = 8): readonly VoiceMemory[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.memories
      .filter((memory) => memory.status === 'approved')
      .map((memory) => ({ memory, score: terms.reduce((score, term) => score + (memory.text.toLowerCase().includes(term) ? 1 : 0), 0) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ memory }) => memory);
  }
}

export function createVoiceCorrection(input: { id: GrowthId; text: string; polarity: VoiceMemoryPolarity; createdAt: string; evidence?: readonly GrowthId[] }): VoiceMemory {
  return { id: input.id, text: input.text, polarity: input.polarity, status: 'candidate', source: 'correction', tags: [], createdAt: input.createdAt, evidence: input.evidence ?? [] };
}
