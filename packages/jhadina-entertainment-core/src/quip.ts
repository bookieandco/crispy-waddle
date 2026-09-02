import type { ExpressionDecision } from './expression.js';
import type { HumorMode } from './humor.js';
import type { SharedJoke } from './callback-memory.js';

export interface QuipInput {
  text: string;
  humorOpportunity: number;
  expression: ExpressionDecision;
  callbacks?: SharedJoke[];
}

export interface QuipCandidate {
  text: string;
  mode: HumorMode;
  score: number;
  callbackId?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Fast-path selector for short conversational quips. It never performs actions or overrides policy. */
export function selectQuip(input: QuipInput): QuipCandidate | null {
  if (input.humorOpportunity < 0.45 || input.expression.quipiness < 0.35) return null;
  const callback = input.callbacks?.[0];
  if (callback && callback.status === 'accepted') {
    return { text: callback.phrase, mode: 'callback', score: clamp(0.7 + callback.confidence * 0.3), callbackId: callback.id };
  }
  const mode: HumorMode = input.expression.profanityAllowed && input.expression.profanityIntensity > 0.55 ? 'teasing' : 'deadpan';
  return { text: input.text.trim(), mode, score: clamp(input.humorOpportunity * input.expression.quipiness) };
}
