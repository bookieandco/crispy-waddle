import { describe, expect, it } from 'vitest';
import { emptyPersonalityState } from './personality-core.js';
import { selectEvidenceBackedCallback } from './callback-provenance.js';
import { composeLiveConversationCraft, chooseQuipAttempt, sessionFromRecentConversation } from './live-conversation-craft.js';
import type { QuipCandidateGenerator } from './quip-engine.js';
import type { LiveConversationTurnContext } from './types.js';

const personality = () => {
  const state = emptyPersonalityState('2026-10-08T00:00:00.000Z');
  return { ...state, voice: { ...state.voice!, humor: 0.9, quipFrequency: 1 } };
};
const generator = (count: { calls: number }): QuipCandidateGenerator => ({
  generate: async () => {
    count.calls += 1;
    return [{
      id: 'original',
      text: 'Even the toaster needs a vacation from all that heat.',
      naturalness: 1, timing: 1, contextFit: 1,
      relationshipFit: 1, personalityFit: 1, truthCompatibility: 1,
    }];
  },
});
const base = {
  personality: personality(),
  behaviorContext: { register: 'playful' as const, banterEligible: true },
  currentTurn: 'Make a funny joke about the toaster.',
  semanticAnswer: 'The toaster keeps burning toast.',
  disposition: 'PROCEED' as const,
};

describe('JHADINA-PERSONALITY.LIVE production-facing conversation craft', () => {
  it('selects a model-proposed optional quip without changing semantic truth', async () => {
    const count = { calls: 0 };
    const result = await composeLiveConversationCraft({ ...base, generator: generator(count) });
    expect(result.status).toBe('quip-selected');
    expect(result.directive.quip?.text).toContain('toaster');
    expect(count.calls).toBe(1);
  });

  it('does not force a joke when a provider is unavailable or returns no candidates', async () => {
    expect((await composeLiveConversationCraft(base)).status).toBe('no-provider');
    const noJoke = await composeLiveConversationCraft({
      ...base,
      generator: { generate: async () => [] },
    });
    expect(noJoke.status).toBe('no-quip');
    expect(noJoke.directive.quip).toBeUndefined();
  });

  it('suppresses any model call under distress, precision, refusal or discomfort', async () => {
    const count = { calls: 0 };
    const gen = generator(count);
    for (const override of [
      { behaviorContext: { register: 'playful' as const, distress: true } },
      { behaviorContext: { register: 'playful' as const, requiresPrecision: true } },
      { disposition: 'DECLINE' as const },
      { currentTurn: "Stop joking. I'm not finding this funny." },
    ]) {
      const result = await composeLiveConversationCraft({ ...base, ...override, generator: gen });
      expect(result.directive.quip).toBeUndefined();
      expect(result.status).toBe('suppressed');
    }
    expect(count.calls).toBe(0);
  });

  it('never invents callback lore; only admitted recurring reference with evidence passes', async () => {
    const start = personality();
    const withNoEvidence = {
      ...start,
      relationship: { ...start.relationship!, recurringCallbacks: ['red chair'] },
    };
    const missing = await composeLiveConversationCraft({
      ...base, currentTurn: 'Tell me the red chair joke', personality: withNoEvidence, generator: { generate: async () => [] },
    });
    expect(missing.directive.callback).toBeUndefined();

    const admitted = {
      ...withNoEvidence,
      relationship: {
        ...withNoEvidence.relationship!,
        callbackEvidence: [{
          callback: 'red chair',
          evidence: [
            { id: 'episode-1', source: 'conversation', observedAt: '2026-10-02T00:00:00Z', summary: 'red chair gag repeated', immutable: true },
            { id: 'episode-2', source: 'conversation', observedAt: '2026-10-04T00:00:00Z', summary: 'red chair gag continued', immutable: true },
          ],
        }],
      },
    };
    const direct = selectEvidenceBackedCallback({ personality: admitted, callback: 'red chair', now: '2026-10-08T00:00:00Z' });
    expect(direct?.value).toBe('red chair');
    const good = await composeLiveConversationCraft({
      ...base, currentTurn: 'Tell me the red chair joke', personality: admitted, generator: { generate: async () => [] },
      now: '2026-10-08T00:00:00Z',
    });
    expect(good.directive.callback).toBe('red chair');
    expect(good.directive.callbackProvenance).toHaveLength(2);

    const turns: LiveConversationTurnContext[] = [
      { id: '1', speaker: 'jhadina', text: 'Red chair joke again!', createdAt: '2026-10-08T00:01:00Z' },
      { id: '2', speaker: 'jhadina', text: 'Red chair joke AGAIN!', createdAt: '2026-10-08T00:02:00Z' },
    ];
    const fatigued = await composeLiveConversationCraft({
      ...base, currentTurn: 'Tell me the red chair joke', personality: admitted, recentTurns: turns,
      now: '2026-10-08T00:03:00Z',
      generator: { generate: async () => [] },
    });
    expect(fatigued.directive.callback).toBeUndefined();
  });

  it('makes recent user-led bits session-only and stops when asked', () => {
    const turns: LiveConversationTurnContext[] = [
      { id: '1', speaker: 'jhadina', text: 'I made a joke about the toaster.', createdAt: '2026-10-08T00:01:00Z' },
    ];
    const continuation = sessionFromRecentConversation('LOL keep it going', turns);
    expect(continuation.userBuildingBit).toBe(true);
    expect(continuation.bits).toHaveLength(0);
    const count = { calls: 0 };
    // The production composition gets its ephemeral bit marker from the
    // previous Jhadina turn; the marker is never durable Personality evidence.
    void count;
    const stopped = sessionFromRecentConversation("Stop joking, please be serious", turns);
    expect(stopped.discomfortDetected).toBe(true);
    expect(stopped.userBuildingBit).toBe(false);
  });

  it('keeps quip-frequency sampling deterministic and optional', () => {
    expect(chooseQuipAttempt('some turn', 0)).toBe(false);
    expect(chooseQuipAttempt('some turn', 1)).toBe(true);
    expect(chooseQuipAttempt('some turn', 0.4)).toBe(chooseQuipAttempt('some turn', 0.4));
  });
});
