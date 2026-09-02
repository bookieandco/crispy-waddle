import type { ExpressionDecision } from './expression.js';
import type { HumorMode } from './humor.js';
import type { SharedJoke } from './callback-memory.js';

export interface QuipGenerationInput {
  userText: string;
  expression: ExpressionDecision;
  callbacks?: SharedJoke[];
  maxCandidates?: number;
}

export interface QuipGenerationCandidate {
  text: string;
  mode: HumorMode;
  score: number;
  callbackId?: string;
}

export interface QuipGenerator {
  generate(input: QuipGenerationInput): Promise<QuipGenerationCandidate[]>;
}

/** Adapter boundary for a fast local/small model. The model generates language; ranking remains deterministic. */
export class FastQuipGenerator implements QuipGenerator {
  constructor(private readonly generateText: (prompt: string, maxCandidates: number) => Promise<string[]>) {}

  async generate(input: QuipGenerationInput): Promise<QuipGenerationCandidate[]> {
    const max = Math.max(1, Math.min(3, input.maxCandidates ?? 3));
    const callback = input.callbacks?.find((item) => item.status === 'accepted');
    const prompt = [
      'Generate short conversational quips only.',
      `Register: ${input.expression.register}.`,
      `Quipiness: ${input.expression.quipiness.toFixed(2)}.`,
      `Profanity allowed: ${input.expression.profanityAllowed}.`,
      callback ? `Optional callback phrase: ${callback.phrase}.` : '',
      `User said: ${input.userText}`,
      'No explanation. One line per candidate.',
    ].filter(Boolean).join('\n');

    const texts = await this.generateText(prompt, max);
    return texts.slice(0, max).map((text, index) => ({
      text: text.trim(),
      mode: callback && index === 0 ? 'callback' : input.expression.profanityAllowed ? 'teasing' : 'deadpan',
      score: Math.max(0, Math.min(1, input.expression.quipiness - index * 0.05)),
      callbackId: callback && index === 0 ? callback.id : undefined,
    }));
  }
}
