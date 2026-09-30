import type { GrowthId } from '../domain/types.js';
import type { CompiledSocialPersona, VoiceDNA } from './voice-dna.js';
import type { VoiceMemory, VoiceMemoryStore } from './voice-memory.js';

export interface VoiceContextRequest {
  readonly accountId: GrowthId;
  readonly platform: string;
  readonly conversation: string;
  readonly persona: CompiledSocialPersona;
  readonly voice: VoiceDNA;
  readonly limit?: number;
}

export interface VoiceContext {
  readonly accountId: GrowthId;
  readonly platform: string;
  readonly baseVoiceId: GrowthId;
  readonly persona: CompiledSocialPersona;
  readonly relevantMemories: readonly VoiceMemory[];
  readonly instructions: readonly string[];
}

export function buildVoiceContext(request: VoiceContextRequest, memoryStore: VoiceMemoryStore): VoiceContext {
  const relevantMemories = memoryStore.retrieve(request.conversation, request.limit ?? 6);
  return {
    accountId: request.accountId,
    platform: request.platform,
    baseVoiceId: request.voice.id,
    persona: request.persona,
    relevantMemories,
    instructions: [
      `Use base voice ${request.voice.id} as the canonical personality source.`,
      `Adapt delivery to ${request.platform} without changing the underlying personality.`,
      `Use account persona ${request.persona.accountId} and its tone: ${request.persona.tone}.`,
      ...relevantMemories.filter((memory) => memory.polarity === 'positive').map((memory) => `Positive voice example: ${memory.text}`),
      ...relevantMemories.filter((memory) => memory.polarity === 'negative').map((memory) => `Avoid voice pattern: ${memory.text}`),
      'Do not claim to be the human source of the voice; operate as the configured account persona.',
    ],
  };
}
