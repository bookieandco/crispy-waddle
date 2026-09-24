import type { GrowthId } from '../domain/types.js';

export interface VoiceSample { readonly id: GrowthId; readonly text: string; readonly approved: boolean; readonly source: 'post' | 'comment' | 'caption' | 'reply' | 'edit'; }
export interface VoiceDNA { readonly id: GrowthId; readonly version: number; readonly traits: Readonly<Record<string, number>>; readonly preferredPhrases: readonly string[]; readonly avoidPhrases: readonly string[]; readonly rhythm: 'short' | 'mixed' | 'long'; readonly humor: number; readonly sarcasm: number; readonly boldness: number; readonly warmth: number; readonly profanity: number; readonly evidence: readonly GrowthId[]; }
export interface PersonaDelta { readonly accountId: GrowthId; readonly platform: string; readonly tone: 'playful' | 'witty' | 'supportive' | 'bold' | 'professional'; readonly traitAdjustments?: Readonly<Record<string, number>>; readonly vocabularyAdditions?: readonly string[]; readonly vocabularyRemovals?: readonly string[]; readonly characterDescription: string; }
export interface CompiledSocialPersona { readonly accountId: GrowthId; readonly platform: string; readonly baseVoiceId: GrowthId; readonly traits: Readonly<Record<string, number>>; readonly vocabulary: readonly string[]; readonly tone: PersonaDelta['tone']; readonly characterDescription: string; }

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const count = (text: string, terms: readonly string[]) => terms.reduce((n, term) => n + (text.toLowerCase().includes(term) ? 1 : 0), 0);

export function compileVoiceDNA(samples: readonly VoiceSample[], id: GrowthId = 'voice-dna:base' as GrowthId): VoiceDNA {
  const approved = samples.filter((sample) => sample.approved && sample.text.trim());
  const texts = approved.map((sample) => sample.text.trim());
  const words = texts.flatMap((text) => text.split(/\s+/));
  const avgWords = words.length / Math.max(1, texts.length);
  const humorTerms = ['lol', 'lmao', '😂', '🤣', 'funny', 'damn', 'hell'];
  const sarcasmTerms = ['sure', 'right', 'obviously', 'apparently', 'yeah'];
  const boldTerms = ['nah', 'fuck', 'shit', 'listen', 'period'];
  const warmthTerms = ['love', 'beautiful', 'proud', 'thank', 'appreciate'];
  const profanityTerms = ['fuck', 'shit', 'damn', 'ass', 'bitch'];
  return {
    id, version: 1,
    traits: { humor: clamp(count(texts.join(' '), humorTerms) / Math.max(1, approved.length * 2)), sarcasm: clamp(count(texts.join(' '), sarcasmTerms) / Math.max(1, approved.length * 2)), boldness: clamp(count(texts.join(' '), boldTerms) / Math.max(1, approved.length * 2)), warmth: clamp(count(texts.join(' '), warmthTerms) / Math.max(1, approved.length * 2)) },
    preferredPhrases: [], avoidPhrases: [], rhythm: avgWords < 12 ? 'short' : avgWords > 30 ? 'long' : 'mixed',
    humor: clamp(count(texts.join(' '), humorTerms) / Math.max(1, approved.length * 2)),
    sarcasm: clamp(count(texts.join(' '), sarcasmTerms) / Math.max(1, approved.length * 2)),
    boldness: clamp(count(texts.join(' '), boldTerms) / Math.max(1, approved.length * 2)),
    warmth: clamp(count(texts.join(' '), warmthTerms) / Math.max(1, approved.length * 2)),
    profanity: clamp(count(texts.join(' '), profanityTerms) / Math.max(1, approved.length * 2)),
    evidence: approved.map((sample) => sample.id),
  };
}

export function compileAccountPersona(base: VoiceDNA, delta: PersonaDelta): CompiledSocialPersona {
  const traits = { ...base.traits, ...delta.traitAdjustments };
  return { accountId: delta.accountId, platform: delta.platform, baseVoiceId: base.id, traits, vocabulary: [...(delta.vocabularyAdditions ?? [])].filter((word) => !(delta.vocabularyRemovals ?? []).includes(word)), tone: delta.tone, characterDescription: delta.characterDescription };
}
