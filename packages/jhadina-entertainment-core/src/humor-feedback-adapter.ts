import type { HumorFeedback, HumorMode } from './humor.js';

export interface HumorEmission {
  candidateId: string;
  relationshipId?: string;
  mode: HumorMode;
  line: string;
  emittedAt: string;
}

export interface HumorReactionObservation {
  text: string;
  explicitSignal?: HumorFeedback['signal'];
  explicit?: boolean;
  at: string;
}

/**
 * Converts observable conversational reactions into bounded humor feedback.
 * It is deliberately conservative: inferred signals are weaker than explicit
 * feedback and ambiguous responses remain neutral.
 */
export function inferHumorFeedback(
  emission: HumorEmission,
  reaction: HumorReactionObservation,
): HumorFeedback {
  if (reaction.explicitSignal) {
    return {
      candidateId: emission.candidateId,
      signal: reaction.explicitSignal,
      explicit: reaction.explicit ?? true,
      at: reaction.at,
      reason: 'Explicit humor feedback supplied by the interaction.',
    };
  }

  const text = reaction.text.trim().toLowerCase();
  if (!text) return neutral(emission, reaction.at, 'No observable reaction.');

  const positive = /\b(lol|lmao|lmfao|haha|hahaha|😂|🤣|funny|hilarious|good one|that got me|dead|i'?m dead|crying)\b/i.test(text);
  const negative = /\b(not funny|unfunny|corny|cringe|stop|too soon|too much|don't joke|dont joke|seriously\??)\b/i.test(text);
  if (positive && !negative) {
    return { candidateId: emission.candidateId, signal: 'positive', explicit: false, at: reaction.at, reason: 'Observable positive reaction matched.' };
  }
  if (negative && !positive) {
    return { candidateId: emission.candidateId, signal: 'negative', explicit: false, at: reaction.at, reason: 'Observable negative reaction matched.' };
  }
  return neutral(emission, reaction.at, 'Reaction was ambiguous; no humor preference inferred.');
}

function neutral(emission: HumorEmission, at: string, reason: string): HumorFeedback {
  return { candidateId: emission.candidateId, signal: 'neutral', explicit: false, at, reason };
}
