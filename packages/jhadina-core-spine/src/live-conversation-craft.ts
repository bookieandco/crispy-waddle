import { decideBehavior, type BehavioralKernelContext } from './behavioral-kernel.js';
import { advanceBanterBit, type BanterBitRuntime } from './banter-bit-engine.js';
import { selectEvidenceBackedCallback, type CallbackUsageRecord } from './callback-provenance.js';
import { planExpression } from './expression-kernel.js';
import { runQuipFastLane, type QuipCandidateGenerator } from './quip-engine.js';
import { createSessionExpressionState, updateSessionExpressionState, type SessionExpressionState } from './session-expression.js';
import type {
  DecisionDisposition, ExpressionDirective, LiveConversationTurnContext, PersonalityState,
} from './types.js';

export interface LiveConversationCraftInput {
  personality: PersonalityState;
  behaviorContext: BehavioralKernelContext;
  currentTurn: string;
  semanticAnswer: string;
  disposition: DecisionDisposition;
  recentTurns?: readonly LiveConversationTurnContext[];
  generator?: QuipCandidateGenerator;
  now?: string;
  /** Presentation sampling only: does not control actions or model semantics. */
  selectionSeed?: string;
}

export interface LiveConversationCraftResult {
  directive: ExpressionDirective;
  session: SessionExpressionState;
  status: 'suppressed' | 'no-provider' | 'no-quip' | 'quip-selected';
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

/** A user's explicit dislike of a bit always wins over historic familiarity. */
export function detectDiscomfort(text: string): boolean {
  return /\b(?:stop (?:joking|kidding|teasing)|not funny|isn['’]t funny|don['’]t (?:joke|tease|roast)|no more jokes|please be serious|cut the jokes)\b/i.test(text);
}

/**
 * Only the bounded recent-turn transcript is allowed to influence ephemeral
 * bit posture. No SessionBit from here can become a durable callback.
 */
export function sessionFromRecentConversation(
  currentTurn: string,
  recentTurns: readonly LiveConversationTurnContext[] = [],
): SessionExpressionState {
  const recent = recentTurns.slice(-4);
  const previousAssistant = [...recent].reverse().find((turn) => turn.speaker === 'jhadina');
  const responseIsRecent = previousAssistant && recent.indexOf(previousAssistant) >= recent.length - 2;
  const userBuildingBit = Boolean(
    responseIsRecent &&
    /(?:\b(?:keep (?:the joke|it going)|continue (?:the joke|the bit)|and then what|that['’]s funny|lmao|lol)\b|😂|🤣)/i.test(currentTurn),
  );
  const discomfortDetected = detectDiscomfort(currentTurn);
  const state = createSessionExpressionState();
  return updateSessionExpressionState(state, {
    userBuildingBit: !discomfortDetected && userBuildingBit,
    discomfortDetected,
    role: userBuildingBit && !discomfortDetected ? 'play' : 'balanced',
    conversationTemperature: discomfortDetected ? 0 : userBuildingBit ? 0.8 : 0.5,
  });
}

function callbackUsage(callback: string, turns: readonly LiveConversationTurnContext[]): CallbackUsageRecord[] {
  const matching = turns.filter(
    (turn) => turn.speaker === 'jhadina' &&
      normalized(turn.text).includes(normalized(callback)) &&
      Number.isFinite(Date.parse(turn.createdAt)),
  );
  const latest = matching.at(-1);
  return latest
    ? [{ callback, lastUsedAt: latest.createdAt, usesWithinWindow: matching.length }]
    : [];
}

/** Stable per-turn sampling, so an ordinary conversation does not force a joke on every answer. */
export function chooseQuipAttempt(seed: string, frequency: number): boolean {
  if (!Number.isFinite(frequency) || frequency <= 0) return false;
  if (frequency >= 1) return true;
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000 < frequency;
}

const SPONTANEOUS_REGISTERS = new Set([
  'playful', 'social-reaction', 'cultural-salon', 'community-room', 'household-ops',
]);

/**
 * Post-decision presentation composition: no input may modify the semantic
 * proposal, its evidence, disposition, approval or action capabilities.
 *
 * Model-generated quips are optional. Contextual bans, negative feedback and
 * strict evidence modes outrank a provider response or a past personality trait.
 */
export async function composeLiveConversationCraft(
  input: LiveConversationCraftInput,
): Promise<LiveConversationCraftResult> {
  const decision = decideBehavior(input.personality, input.behaviorContext);
  const session = sessionFromRecentConversation(input.currentTurn, input.recentTurns);
  const strict = input.disposition !== 'PROCEED' ||
    decision.action === 'stay_serious' ||
    decision.posture.humor <= 0 ||
    !decision.posture.quipsAllowed ||
    session.discomfortDetected;
  let callback;
  if (!strict && input.personality.relationship) {
    for (const known of input.personality.relationship.recurringCallbacks.slice(0, 8)) {
      if (!known.trim()) continue;
      // No automatic unrelated callback, no legacy unproven callback. The
      // reference must be topical and backed by at least two independent
      // immutable observations even after correction/forget reconciliation.
      if (!normalized(input.currentTurn).includes(normalized(known))) continue;
      const managed = input.personality.relationship.callbackEvidence?.find(
        (item) => normalized(item.callback) === normalized(known),
      );
      if (!managed || new Set(managed.evidence.filter((ref) => ref.immutable).map((ref) => ref.id)).size < 2) continue;
      callback = selectEvidenceBackedCallback({
        personality: input.personality,
        callback: known,
        usage: callbackUsage(known, input.recentTurns ?? []),
        now: input.now ?? new Date().toISOString(),
      });
      if (callback) break;
    }
  }

  // Reconstruct a tiny ephemeral bit stage from actual recent dialogue.
  // This affects presentation only: nothing is stored in durable Memory.
  let banter: BanterBitRuntime | undefined;
  let activeSession = session;
  if (!strict && session.userBuildingBit && input.recentTurns?.length) {
    const assistant = [...input.recentTurns].reverse().find((turn) => turn.speaker === 'jhadina');
    if (assistant?.text.trim()) {
      const continuations = input.recentTurns.filter((turn) =>
        turn.speaker === 'user' &&
        /(?:\b(?:keep (?:the joke|it going)|continue (?:the joke|the bit)|lmao|lol)\b|😂|🤣)/i.test(turn.text),
      ).length;
      const cap = (session.userBuildingBit && decision.posture.humor >= 0.75 ? 3 : 2) as 2 | 3;
      const rounds = Math.min(4, continuations + 1);
      for (let i = 0; i < rounds; i++) {
        const transition = advanceBanterBit(activeSession, banter, {
          turn: i + 1,
          bitId: assistant.id,
          phrase: assistant.text.slice(0, 100),
          origin: 'shared',
          humor: decision.posture.humor,
          strategyCap: cap,
        });
        activeSession = transition.session;
        banter = transition.runtime;
        if (transition.shouldReturnToTask) break;
      }
    }
  }
  const expressionContext = {
    session: activeSession,
    ...(callback ? { callback } : {}),
    ...(banter ? { banter } : {}),
  };
  const standardDirective = planExpression(decision, expressionContext);
  if (strict) return { directive: standardDirective, session, status: 'suppressed' };

  const expresslyPlayful = /(?:\b(?:joke|jokes|funny|banter|roast|riff|make me laugh)\b|😂|🤣)/i.test(input.currentTurn);
  const attempt = expresslyPlayful || session.userBuildingBit ||
    (SPONTANEOUS_REGISTERS.has(decision.posture.register) &&
      chooseQuipAttempt(input.selectionSeed ?? input.currentTurn, input.personality.voice?.quipFrequency ?? 0.2));
  if (!attempt) return { directive: standardDirective, session, status: 'no-quip' };
  if (!input.generator) return { directive: standardDirective, session, status: 'no-provider' };

  try {
    const quip = await runQuipFastLane(decision, input.generator, { session: activeSession, minimumScore: 0.62 });
    if (!quip) return { directive: standardDirective, session, status: 'no-quip' };
    return {
      directive: planExpression(decision, { ...expressionContext, quip }),
      session,
      status: 'quip-selected',
    };
  } catch {
    // Any provider timeout, malformed output or invalid proposal is no-joke,
    // never a failed user command or a substitute semantic answer.
    return { directive: standardDirective, session, status: 'no-provider' };
  }
}
