import type { QuipGenerationCandidate, QuipGenerator } from '@jhadina/entertainment-core';
import type { HumorContextState, VoiceContextState } from './types.js';

export interface QuipRuntimeInput {
  text: string;
  humor?: HumorContextState;
  voice?: VoiceContextState;
}

export interface QuipRuntimeResult {
  used: boolean;
  fallback: boolean;
  confidence: number;
  candidate?: QuipGenerationCandidate;
  reason: string;
}

export class QuipRuntime {
  constructor(private readonly generator: QuipGenerator, private readonly confidenceFloor = 0.62) {}

  async tryFastPath(input: QuipRuntimeInput): Promise<QuipRuntimeResult> {
    if (!input.humor?.shouldHumor) return { used: false, fallback: true, confidence: 0, reason: 'humor not suitable' };
    if (!input.voice || input.voice.quipiness < 0.35) return { used: false, fallback: true, confidence: input.voice?.quipiness ?? 0, reason: 'quipiness below fast-path threshold' };
    const expression = {
      register: input.voice.register,
      quipiness: input.voice.quipiness,
      profanityAllowed: input.voice.profanityAllowed,
      profanityIntensity: input.voice.profanityIntensity,
      reason: 'runtime fast-path',
    };
    const candidates = await this.generator.generate({ userText: input.text, expression, maxCandidates: 3 });
    const candidate = candidates[0];
    if (!candidate || candidate.score < this.confidenceFloor || !candidate.text) {
      return { used: false, fallback: true, confidence: candidate?.score ?? 0, candidate, reason: 'fast-path confidence below floor' };
    }
    return { used: true, fallback: false, confidence: candidate.score, candidate, reason: 'fast-path accepted' };
  }
}
